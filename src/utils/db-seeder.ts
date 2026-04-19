"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts } from "@/lib/mock-data";

export const seedGlobalPosts = async (userId: string, nickname: string, avatar: string) => {
  // 대한민국 대략적인 범위
  const bounds = {
    minLat: 34.0,
    maxLat: 38.5,
    minLng: 126.0,
    maxLng: 129.5
  };

  const step = 0.15; // 그리드 간격 (레벨 6 뷰 사이즈 고려)
  const postsPerGrid = 2; // 그리드당 생성할 포스팅 수 (총 약 1000~2000개)
  
  const allInsertData: any[] = [];

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += step) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += step) {
      // 해당 지점 주변으로 포스팅 생성
      const mockPosts = createMockPosts(lat, lng, postsPerGrid);
      
      mockPosts.forEach(p => {
        allInsertData.push({
          content: p.content,
          location_name: p.location,
          latitude: p.lat,
          longitude: p.lng,
          image_url: p.image,
          user_id: userId,
          user_name: nickname,
          user_avatar: avatar,
          likes: p.likes,
          created_at: p.createdAt.toISOString()
        });
      });
    }
  }

  // 대량 인서트를 위해 청크 단위로 분할 (Supabase 제한 고려)
  const chunkSize = 500;
  for (let i = 0; i < allInsertData.length; i += chunkSize) {
    const chunk = allInsertData.slice(i, i + chunkSize);
    const { error } = await supabase.from('posts').insert(chunk);
    if (error) {
      console.error(`Error seeding chunk ${i}:`, error);
      throw error;
    }
  }

  return allInsertData.length;
};