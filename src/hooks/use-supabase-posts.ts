"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/types";

// DB 데이터를 앱에서 사용하는 Post 타입으로 변환하는 헬퍼 함수
const mapDbToPost = (p: any): Post => {
  // 좋아요 수에 따라 인기 포스팅 여부 결정 (프론트엔드 로직)
  const likes = Number(p.likes || 0);
  const borderType = likes >= 1500 ? 'popular' : 'none';

  return {
    id: p.id,
    isAd: false,
    isGif: false, // DB에 컬럼이 없으므로 기본값 설정
    isInfluencer: false, 
    user: {
      id: p.user_id,
      name: p.user_name || '탐험가',
      avatar: p.user_avatar || `https://i.pravatar.cc/150?u=${p.user_id}`,
    },
    content: p.content || '',
    location: p.location_name || '알 수 없는 장소',
    lat: p.latitude,
    lng: p.longitude,
    likes: likes,
    commentsCount: 0,
    comments: [],
    image: p.image_url || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop',
    videoUrl: p.video_url,
    category: 'none', // DB에 컬럼이 없으므로 기본값 설정
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
        .select("id, content, location_name, latitude, longitude, image_url, video_url, user_id, user_name, user_avatar, likes, created_at")
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
    .select("id, content, location_name, latitude, longitude, image_url, video_url, user_id, user_name, user_avatar, likes, created_at")
    .gte("latitude", sw.lat)
    .lte("latitude", ne.lat)
    .gte("longitude", sw.lng)
    .lte("longitude", ne.lng)
    .limit(500);

  if (error) throw error;
  return (data || []).map(mapDbToPost);
};