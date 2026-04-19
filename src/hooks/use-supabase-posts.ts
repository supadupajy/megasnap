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
        .select("id, content, location_name, latitude, longitude, image_url, user_id, user_name, user_avatar, likes, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id,
        isAd: false,
        isGif: false,
        isInfluencer: false,
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
        isLiked: false,
        createdAt: new Date(p.created_at),
        borderType: Number(p.likes) >= 1500 ? "popular" : "none",
      })) as Post[];
    },
    staleTime: 1000 * 60 * 5, // 5분간 신선한 데이터로 간주
    gcTime: 1000 * 60 * 30, // 30분간 캐시 유지
  });
};