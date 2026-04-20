"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  createMockPosts
} from "@/lib/mock-data"; 

/**
 * Settings.tsx 에서 3개의 인자를 보내므로 (currentUserId, currentNickname, currentAvatar) 
 * 이에 맞춰 인자를 정의합니다.
 */
export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("중복 데이터 방지를 위해 기존 포스팅을 모두 삭제하고 새로 생성하시겠습니까?");
  
  try {
    if (confirmClear) {
      // 기존 데이터 삭제
      await supabase.from('posts').delete().neq('id', '_root_');
    }

    let globalCount = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 생성 중...`);
      // createMockPosts 호출
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        const isYoutube = i % 2 === 0;
        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isYoutube) {
          const ytId = YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          // 중복 방지를 위해 Picsum ID 기반 고유 이미지 배정
          finalImage = getUnsplashUrl(uniqueSeed); 
        }

        batch.push({
          content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: currentUserId, // 인자로 받은 ID 사용
          user_name: currentNickname,
          user_avatar: currentAvatar,
          likes: Math.floor(Math.random() * 5000),
          created_at: new Date().toISOString()
        });

        globalCount++;

        if (batch.length >= 100) {
          await supabase.from('posts').insert(batch);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
    alert("✨ 모든 에러가 해결되었고 데이터 생성이 완료되었습니다!");
    return globalCount;
  } catch (err) {
    console.error(err);
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};