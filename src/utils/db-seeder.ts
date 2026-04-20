"use client";

import { supabase } from "@/integrations/supabase/client";
// 경로를 "@/lib/mock-data"로 정확히 지정했습니다.
import { 
  MAJOR_CITIES, 
  UNSPLASH_IDS, 
  YOUTUBE_IDS_POOL, 
  FOOD_UNSPLASH_IDS, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  AD_COMMENTS,
  createMockPosts
} from "@/lib/mock-data"; 

/**
 * 유튜브 재생 가능 여부 체크 (oEmbed)
 */
async function checkYoutubePlayable(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.title;
  } catch {
    return false;
  }
}

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 프로세스 시작...");

  try {
    // 1. 유튜브 클린 리스트 확보
    const validYoutubeIds: string[] = [];
    for (const id of YOUTUBE_IDS_POOL) {
      const ok = await checkYoutubePlayable(id);
      if (ok) validYoutubeIds.push(id);
      await new Promise(r => setTimeout(r, 30)); 
    }

    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(50);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    let globalIndex = 0;
    let totalInserted = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 생성 중 (${city.density}개)...`);
      
      // mock-data에서 가져온 함수 사용
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, 0.1, undefined, city.bounds);
      const cityBatch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        const isAd = i % 30 === 0;
        const isYoutube = !isAd && i % 2 === 0;

        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isAd) {
          const foodId = FOOD_UNSPLASH_IDS[globalIndex % FOOD_UNSPLASH_IDS.length];
          finalImage = getUnsplashUrl(foodId, globalIndex);
        } else if (isYoutube && validYoutubeIds.length > 0) {
          const ytId = validYoutubeIds[globalIndex % validYoutubeIds.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          const unsplashId = UNSPLASH_IDS[globalIndex % UNSPLASH_IDS.length];
          finalImage = getUnsplashUrl(unsplashId, globalIndex);
        }

        cityBatch.push({
          content: isAd ? AD_COMMENTS[globalIndex % AD_COMMENTS.length] : REALISTIC_COMMENTS[globalIndex % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 3000),
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;

        if (cityBatch.length >= 100) {
          const { error } = await supabase.from('posts').insert([...cityBatch]);
          if (error) throw error;
          totalInserted += cityBatch.length;
          cityBatch.length = 0;
        }
      }

      if (cityBatch.length > 0) {
        await supabase.from('posts').insert(cityBatch);
        totalInserted += cityBatch.length;
      }
    }

    return totalInserted;
  } catch (err) {
    console.error("❌ 시딩 오류:", err);
    throw err;
  }
};