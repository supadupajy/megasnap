"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/types";
import { getYoutubeThumbnail } from "@/lib/utils";

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

const mapDbToPost = (p: any): Post => {
  const likes = Number(p.likes || 0);
  const isAd = p.content?.trim().startsWith('[AD]');
  const borderType = isAd ? 'none' : getTierFromId(p.id);
  const isInfluencer = !isAd && ['silver', 'gold', 'diamond'].includes(borderType);
  
  const cleanContent = p.content?.replace(/^\[AD\]\s*/, '') || '';
  
  // 유튜브 영상인 경우 썸네일을 우선 사용, 아니면 DB의 image_url 사용
  const finalImage = p.youtube_url 
    ? (getYoutubeThumbnail(p.youtube_url) || p.image_url)
    : p.image_url;

  return {
    id: p.id,
    isAd: isAd,
    isGif: false,
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
    image: finalImage,
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
        .select("*")
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
    .select("*")
    .gte("latitude", sw.lat)
    .lte("latitude", ne.lat)
    .gte("longitude", sw.lng)
    .lte("longitude", ne.lng)
    .limit(300);

  if (error) throw error;
  return (data || []).map(mapDbToPost);
};