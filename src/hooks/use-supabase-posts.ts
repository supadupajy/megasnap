"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/types";
import { getYoutubeThumbnail } from "@/lib/utils";
import { remapUnsplashDisplayUrl } from "@/lib/mock-data";
import { sanitizeYoutubeMedia } from "@/utils/youtube-utils";

const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  if (val < 0.01) return 'diamond';
  if (val < 0.03) return 'gold';
  if (val < 0.07) return 'silver';
  if (val < 0.15) return 'popular';
  return 'none';
};

const mapDbToPost = async (rawPost: any): Promise<Post> => {
  const p = await sanitizeYoutubeMedia(rawPost);
  const likes = Number(p.likes || 0);
  const isAd = p.content?.trim().startsWith('[AD]');
  const borderType = isAd ? 'none' : getTierFromId(p.id);
  
  const cleanContent = p.content?.replace(/^\[AD\]\s*/, '') || '';
  
  const finalImage = p.youtube_url
    ? (getYoutubeThumbnail(p.youtube_url) || p.image_url)
    : remapUnsplashDisplayUrl(p.image_url, p.id, isAd ? 'food' : (p.category || 'general')) || p.image_url;

  return {
    id: p.id,
    isAd: p.is_ad || false,
    isGif: false,
    isInfluencer: borderType === 'gold' || borderType === 'diamond',
    user: {
      id: p.user_id,
      name: p.user_name || '익명 사용자',
      avatar: p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`,
    },
    content: p.content || '',
    location: p.location_name || '',
    lat: p.latitude,
    lng: p.longitude,
    latitude: p.latitude,
    longitude: p.longitude,
    likes: Number(p.likes || 0),
    commentsCount: 0,
    comments: [],
    image: p.image_url || '',
    image_url: p.image_url || '',
    images: p.images || (p.image_url ? [p.image_url] : []),
    isLiked: false,
    youtubeUrl: p.youtube_url,
    videoUrl: p.video_url,
    category: p.category || 'none',
    createdAt: new Date(p.created_at),
    borderType: borderType,
  };
};

export const usePosts = (limit: number = 10) => {
  return useQuery({
    queryKey: ['posts', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return Promise.all((data || []).map(mapDbToPost));
    },
  });
};

/**
 * Fetches posts within the given geographical bounds with a limit.
 * Optimized to fetch more posts when zoomed out and prioritize center-weighted data.
 */
export const fetchPostsInBounds = async (
  sw: { lat: number, lng: number }, 
  ne: { lat: number, lng: number },
  currentLevel: number = 6,
  center?: { lat: number; lng: number }
) => {
  // 줌 레벨에 따라 limit 조정
  let limit = 300; 
  if (currentLevel >= 8) limit = 500;
  if (currentLevel >= 10) limit = 800;

  try {
    let query = supabase
      .from('posts')
      .select('id, content, latitude, longitude, category, likes, created_at, video_url, youtube_url, image_url, user_id')
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng));

    // ✅ [FIX] 중심점이 있을 경우, 중심점 기준 거리가 가까운 순으로 정렬하기 위해 
    // PostGIS distance 함수(st_distance)를 사용하거나, 차선책으로 rpc를 호출해야 함.
    // 하지만 현재 테이블 구조에서 가장 간단하면서 효과적인 방법은 '최신순 + 중심점 필터링'의 조화입니다.
    // 기존의 무조건 최신순(order by created_at) 방식은 멀리 있는 최신글을 먼저 가져올 수 있으므로,
    // 정렬 조건을 제거하거나 위치 기반 정렬 기능을 추가하는 것이 좋습니다.
    
    // 만약 데이터베이스에 st_distance 연산이 가능한 익스텐션이 깔려있다면 rpc가 베스트입니다.
    // 여기서는 기본 쿼리에서 order('created_at')을 유지하되, 
    // fetchPostsInBounds를 호출하는 쪽(Index.tsx)에서 중심점 가중치 계산을 하도록 유도합니다.

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabasePosts] Fetch error:', err);
    return [];
  }
};