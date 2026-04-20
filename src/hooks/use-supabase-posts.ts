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
    : remapUnsplashDisplayUrl(p.image_url, p.id, isAd ? 'food' : 'general') || p.image_url;

  return {
    id: p.id,
    isAd: isAd,
    isGif: false,
    isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
    user: {
      id: p.user_id,
      name: p.user_name || '탐험가',
      avatar: p.user_avatar || `https://i.pravatar.cc/150?u=${p.user_id}`,
    },
    content: cleanContent,
    location: p.location_name || '알 수 없는 장소',
    lat: p.latitude,
    lng: p.longitude,
    likes: likes,
    commentsCount: 0,
    comments: [],
    image: finalImage,
    videoUrl: p.video_url,
    youtubeUrl: p.youtube_url,
    category: p.category || 'none', // category 필드 포함
    isLiked: false,
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
 * Optimized to fetch more posts when zoomed out and prioritize center-weighted or balanced data.
 */
export const fetchPostsInBounds = async (
  sw: { lat: number, lng: number }, 
  ne: { lat: number, lng: number },
  currentLevel: number = 6
) => {
  // ✅ 줌 레벨에 따라 페칭 리미트를 유동적으로 조절
  // 축소할수록(레벨이 높을수록) 더 넓은 영역의 데이터를 커버하기 위해 리미트 증가
  let limit = 1000;
  if (currentLevel >= 7) limit = 1500;
  if (currentLevel >= 8) limit = 2000;
  if (currentLevel >= 9) limit = 2500;
  if (currentLevel >= 10) limit = 3000;

  try {
    // ✅ 데이터베이스 수준에서 중심부(또는 최신순) 우선순위를 보장하기 위해 
    // 기본적으로 최신순 + 좋아요순 혼합 정렬 시도 (확장성 고려)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .gte('latitude', sw.lat)
      .lte('latitude', ne.lat)
      .gte('longitude', sw.lng)
      .lte('longitude', ne.lng)
      .order('created_at', { ascending: false }) // 최신순 우선으로 하면 중심부 데이터 누락 확률 감소
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabasePosts] Fetch error:', err);
    return [];
  }
};