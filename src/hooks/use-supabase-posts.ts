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

  // [FINAL ATOMIC FIX]
  // DB의 user_name 필드 존재 여부와 is_seed_data 여부를 결합하여 닉네임을 결정합니다.
  const isSeed = p.is_seed_data === true || p.is_seed_data === 'true' || p.is_seed_data === 1;
  
  let finalUserName = '';
  let finalUserAvatar = '';

  if (isSeed && p.user_name) {
    // 1. 시드 데이터이면서 랜덤 닉네임이 저장되어 있다면 무조건 그것을 사용 (본인 프로필 덮어쓰기 완전 방지)
    finalUserName = p.user_name;
    finalUserAvatar = p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`;
  } else if (p.profiles?.nickname) {
    // 2. 일반 게시물이면 프로필 조인 정보를 사용
    finalUserName = p.profiles.nickname;
    finalUserAvatar = p.profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`;
  } else {
    // 3. 둘 다 없으면 기본값
    finalUserName = p.user_name || '익명 사용자';
    finalUserAvatar = p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`;
  }

  return {
    id: p.id,
    isAd: isAd || p.is_ad || false,
    isGif: false,
    isInfluencer: borderType === 'gold' || borderType === 'diamond',
    user: {
      id: p.user_id,
      name: finalUserName,
      avatar: finalUserAvatar,
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
    borderType: p.borderType || borderType,
    is_seed_data: p.is_seed_data === true || p.is_seed_data === 'true' || p.is_seed_data === 1
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
  let limit = 1000;
  if (currentLevel >= 8) limit = 1500;
  if (currentLevel >= 10) limit = 2000;

  // 7일 이내 데이터만 가져옴 (timeValue 최대값과 일치)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, latitude, longitude, location_name, category, likes, created_at, video_url, youtube_url, image_url, user_id, content, is_seed_data, user_name, user_avatar, borderType')
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng))
      .gte('created_at', sevenDaysAgo)
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabasePosts] Fetch error:', err);
    return [];
  }
};