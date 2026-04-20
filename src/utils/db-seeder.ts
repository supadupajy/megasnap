"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_POOL, 
  FOOD_UNSPLASH_IDS, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  AD_COMMENTS,
  createMockPosts
} from "@/lib/mock-data"; 

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  // 1. 사용자에게 확인 (실수로 데이터 날리는 것 방지)
  const confirmClear = confirm("기존의 모든 포스팅을 삭제하고 새로 생성하시겠습니까? (중복 해결을 위해 권장)");
  
  try {
    if (confirmClear) {
      console.log("🧹 기존 데이터 삭제 중...");
      const { error: deleteError } = await supabase.from('posts').delete().neq('id', '_root_'); // 전체 삭제
      if (deleteError) throw deleteError;
    }

    console.log("🚀 [Seeder] 새로운 데이터 생성 시작...");

    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(50);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    let globalCount = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 생성 중...`);
      
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let cityBatch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        // [중요] 절대 중복될 수 없는 고유 번호 생성
        const uniqueSeed = Date.now() + globalCount; 
        
        const isAd = i % 35 === 0;
        const isYoutube = !isAd && i % 2 === 0;

        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isAd) {
          finalImage = `https://images.unsplash.com/featured/?food,restaurant&sig=${uniqueSeed}`;
        } else if (isYoutube) {
          const ytId = YOUTUBE_IDS_POOL[uniqueSeed % YOUTUBE_IDS_POOL.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          // 일반 이미지는 getUnsplashUrl에서 picsum과unsplash를 섞어 반환
          finalImage = getUnsplashUrl(uniqueSeed);
        }

        cityBatch.push({
          content: isAd ? AD_COMMENTS[i % AD_COMMENTS.length] : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 어딘가`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 8000),
          created_at: new Date(Date.now() - Math.random() * 72 * 3600000).toISOString()
        });

        globalCount++;

        if (cityBatch.length >= 100) {
          await supabase.from('posts').insert([...cityBatch]);
          cityBatch = [];
        }
      }
      if (cityBatch.length > 0) await supabase.from('posts').insert(cityBatch);
    }

    alert(`✨ 생성 완료! 총 ${globalCount}개의 데이터가 새로 등록되었습니다.`);
    return globalCount;
  } catch (err) {
    console.error(err);
    alert("시딩 중 오류가 발생했습니다.");
  }
};