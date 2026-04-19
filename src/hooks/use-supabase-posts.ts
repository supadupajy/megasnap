"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/types";

// DB 데이터를 앱에서 사용하는 Post 타입으로 변환하는 헬퍼 함수
const mapDbToPost = (p: any): Post => {
  const likes = Number(p.likes || 0);
  // 좋아요 수에 따라 인기 포스팅 여부 결정 (1500개 이상)
  const isPopular = likes >= 1500;
  // 좋아요 수에 따라 인플루언서 여부 결정 (5000개 이상)
  const isInfluencer = likes >= 5000;

  // 내용(Content)에 포함된 태그를 통해 광고/GIF 여부 판단
  const isAd = p.content?.startsWith('[AD]');
  const isGif = p.content?.startsWith('[GIF]');
  const cleanContent = p.content?.replace(/^\[(AD|GIF)\]\s*/, '') || '';

  let borderType: 'popular' | 'silver' | 'gold' | 'diamond' | 'none' = 'none';
  if (isInfluencer) {
    if (likes >= 15000) borderType = 'diamond';
    else if (likes >= 10000) borderType = 'gold';
    else borderType = 'silver';
  } else if (isPopular) {
    borderType = 'popular';
  }

  return {
    id: p.id,
    isAd: isAd,
    isGif: isGif,
    isInfluencer: isInfluencer, 
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
    image: p.image_url || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop',
    videoUrl: p.video_url,
    youtubeUrl: p.youtube_url,
    category: 'none',
    isLiked: false,
    createdAt: new Date(p.created_at),
    borderType: borderType,
  };
};

export const useSupabasePosts = (limit = 50) => {
  return useQuery({
    queryKey: ["supabase-posts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, location_name, latitude, longitude, image_url, video_url, youtube_url, user_id, user_name, user_avatar, likes, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapDbToPost);
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const fetchPostsInBounds = async (sw: {lat: number, lng: number}, ne: {lat: number, lng: number}) => {
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, location_name, latitude, longitude, image_url, video_url, youtube_url, user_id, user_name, user_avatar, likes, created_at")
    .gte("latitude", sw.lat)
    .lte("latitude", ne.lat)
    .gte("longitude", sw.lng)
    .lte("longitude", ne.lng)
    .limit(500);

  if (error) throw error;
  return (data || []).map(mapDbToPost);
};