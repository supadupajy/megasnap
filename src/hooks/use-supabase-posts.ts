"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/types";

export const useSupabasePosts = (limit = 50) => {
  return useQuery({
    queryKey: ["supabase-posts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id,
        isAd: false,
        isGif: p.is_gif || false,
        isInfluencer: p.is_influencer || false,
        user: {
          id: p.user_id,
          name: p.user_name,
          avatar: p.user_avatar,
        },
        content: p.content,
        location: p.location_name,
        lat: p.latitude,
        lng: p.longitude,
        likes: Number(p.likes),
        commentsCount: 0,
        comments: [],
        image: p.image_url,
        youtubeUrl: p.youtube_url,
        category: p.category || 'none',
        isLiked: false,
        createdAt: new Date(p.created_at),
        borderType: p.border_type || "none",
      })) as Post[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * 특정 영역 내의 포스팅을 가져오는 함수 (직접 호출용)
 */
export const fetchPostsInBounds = async (sw: {lat: number, lng: number}, ne: {lat: number, lng: number}) => {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .gte("latitude", sw.lat)
    .lte("latitude", ne.lat)
    .gte("longitude", sw.lng)
    .lte("longitude", ne.lng)
    .limit(500);

  if (error) throw error;

  return (data || []).map((p) => ({
    id: p.id,
    isAd: false,
    isGif: p.is_gif || false,
    isInfluencer: p.is_influencer || false,
    user: {
      id: p.user_id,
      name: p.user_name,
      avatar: p.user_avatar,
    },
    content: p.content,
    location: p.location_name,
    lat: p.latitude,
    lng: p.longitude,
    likes: Number(p.likes),
    commentsCount: 0,
    comments: [],
    image: p.image_url,
    youtubeUrl: p.youtube_url,
    category: p.category || 'none',
    isLiked: false,
    createdAt: new Date(p.created_at),
    borderType: p.border_type || "none",
  })) as Post[];
};