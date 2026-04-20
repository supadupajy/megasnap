"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  createMockPosts
} from "@/lib/mock-data"; 

export const seedGlobalPosts = async (currentUserId: string) => {
  // 1. 기존 데이터 삭제 (중복 데이터가 지도에 남아있지 않도록 확실히 처리)
  const confirmClear = confirm("중복 제거를 위해 기존 데이터를 모두 지우고 새로 생성할까요?");
  if (confirmClear) {
    await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  try {
    const { data: profiles } = await supabase.from('profiles').select('id').limit(20);
    const userPool = profiles || [{ id: currentUserId }];

    // [개선] 모든 도시가 이 인덱스를 공유하여 절대 겹치지 않게 함
    let globalImageIndex = 0; 

    for (const city of MAJOR_CITIES) {
      console.log(`${city.name} 데이터 생성 중...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const isYoutube = i % 2 === 0;
        const p = mockPoints[i];
        
        let imageUrl = "";
        let youtubeUrl = null;

        if (isYoutube) {
          const ytId = YOUTUBE_IDS_50[globalImageIndex % YOUTUBE_IDS_50.length];
          youtubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          imageUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          // getUnsplashUrl에서 순차적으로 이미지를 배정 (Picsum 200종 + Unsplash 100종 순환)
          imageUrl = getUnsplashUrl(globalImageIndex);
        }

        batch.push({
          content: REALISTIC_COMMENTS[globalImageIndex % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: imageUrl,
          youtube_url: youtubeUrl,
          user_id: userPool[globalImageIndex % userPool.length].id,
          likes: Math.floor(Math.random() * 5000),
          created_at: new Date().toISOString()
        });

        globalImageIndex++; // 인덱스를 1씩 증가시켜 다음 포스팅은 무조건 다음 이미지를 쓰게 함

        if (batch.length >= 100) {
          await supabase.from('posts').insert(batch);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
    alert("완료되었습니다. 이제 지도를 확인해보세요!");
  } catch (e) {
    console.error(e);
  }
};

// 필수 Export 누락 방지
export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};