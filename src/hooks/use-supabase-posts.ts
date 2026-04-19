"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/types";

// 포스팅 ID를 기반으로 고유한 확률적 등급을 반환하는 헬퍼
const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  
  if (val < 0.01) return 'diamond'; // 1%
  if (val < 0.03) return 'gold';    // 2%
  if (val < 0.07) return 'silver';  // 4%
  if (val < 0.15) return 'popular'; // 8%
  return 'none';
};

const mapDbToPost = (p: any): Post => {
  const likes = Number(p.likes || 0);
  const borderType = getTierFromId(p.id);
  const isInfluencer = ['silver', 'gold', 'diamond'].includes(borderType);
  
  const isAd = p.content?.startsWith('[AD]');
  const isGif = p.content?.startsWith('[GIF]');
  const cleanContent = p.content?.replace(/^\[(AD|GIF)\]\s*/, '') || '';

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