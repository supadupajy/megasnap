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
      avatar: p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id || p.id}`,
    },
    content: p.content || '설명이 없는 포스팅입니다.',
    location: p.location_name || '알 수 없는 장소',
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
  let limit = 200; 
  if (currentLevel >= 8) limit = 300;
  if (currentLevel >= 10) limit = 500;

  try {
    // ✅ [OPTIMIZATION] profiles 테이블을 Join하여 N+1 쿼리 문제를 근본적으로 해결합니다.
    // user_id를 통해 profiles의 nickname과 avatar_url을 한 번에 가져옵니다.
    let query = supabase
      .from('posts')
      .select(`
        id, content, latitude, longitude, category, likes, created_at, video_url, youtube_url, image_url, 
        user_id, user_name, user_avatar, location_name,
        profiles:user_id (
          nickname,
          avatar_url
        )
      `)
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng));

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // ✅ [FIX] 조인된 데이터를 기존 UI가 기대하는 평면 구조로 변환하여 사이드 이펙트를 방지합니다.
    return (data || []).map(p => ({
      ...p,
      user_name: p.profiles?.nickname || p.user_name || '탐험가',
      user_avatar: p.profiles?.avatar_url || p.user_avatar || ''
    }));
  } catch (err) {
    console.error('[SupabasePosts] Fetch error:', err);
    return [];
  }
};