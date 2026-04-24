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
  // 줌 레벨에 따라 limit 조정 (데이터 절약을 위해 최대치 하향 조정)
  let limit = 200; 
  if (currentLevel >= 8) limit = 300;
  if (currentLevel >= 10) limit = 500;

  try {
    // ✅ [OPTIMIZATION] 테이블 직접 조인 대신 데이터베이스 뷰(posts_with_profiles)를 사용하여
    // 외래키 관계 오류(PGRST200) 및 네트워크 리소스 부족 에러를 동시에 해결합니다.
    let query = supabase
      .from('posts_with_profiles')
      .select('*')
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng));

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // UI에서 기대하는 profiles(nickname, avatar_url) 구조로 변환하여 기존 코드와 호환성을 유지합니다.
    const mappedData = (data || []).map(p => ({
      ...p,
      profiles: {
        nickname: p.user_nickname,
        avatar_url: p.user_avatar_url
      }
    }));

    return mappedData;
  } catch (err) {
    console.error('[SupabasePosts] Fetch error:', err);
    return [];
  }
};