"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  createMockPosts, 
  YOUTUBE_IDS_POOL, 
  UNSPLASH_IDS, 
  FOOD_UNSPLASH_IDS, 
  getUnsplashUrl,
  MAJOR_CITIES,
  REALISTIC_COMMENTS,
  AD_COMMENTS
} from "@/lib/mock-data";
import { getYoutubeThumbnail } from "@/lib/utils";

// 1. 유튜브 영상 재생 가능 여부 사전 검증 (정책 위반 방지)
async function validateYoutubeVideo(videoId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) return false;
    // 썸네일 존재 여부까지 체크하면 완벽함
    const thumbRes = await fetch(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, { method: 'HEAD' });
    return thumbRes.ok;
  } catch {
    return false;
  }
}

const shuffleArray = <T>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// 2. 메인 시더 함수
export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 데이터 생성 로직 가동 (정책 검증 포함)");

  try {
    // [유튜브] 재생 가능한 ID만 미리 선별 (중요!)
    const checkResults = await Promise.all(
      YOUTUBE_IDS_POOL.map(async (id) => ({ id, ok: await validateYoutubeVideo(id) }))
    );
    const cleanYoutubeIds = checkResults.filter(r => r.ok).map(r => r.id);
    console.log(`✅ [Seeder] 클린 영상 리스트 확보: ${cleanYoutubeIds.length}개`);

    // [유저] 프로필 풀 확보
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    // [리소스] 셔플 및 카운터
    const shuffledUnsplash = shuffleArray(UNSPLASH_IDS);
    const shuffledFood = shuffleArray(FOOD_UNSPLASH_IDS);
    const shuffledYoutube = shuffleArray(cleanYoutubeIds);
    
    let globalIndex = 0;
    let totalInserted = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 [Seeder] ${city.name} 지역 생성 중... (Density: ${city.density})`);
      
      // 기존 createMockPosts를 활용해 기본 좌표 데이터 생성
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      const cityBatch: any[] = [];

      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        const isAd = i % 25 === 0;
        const isYoutube = !isAd && i % 2 === 0;

        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isAd) {
          const foodId = shuffledFood[globalIndex % shuffledFood.length];
          finalImage = `${getUnsplashUrl(foodId)}&sig=${globalIndex}`;
        } else if (isYoutube && shuffledYoutube.length > 0) {
          const ytId = shuffledYoutube[globalIndex % shuffledYoutube.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          const unsplashId = shuffledUnsplash[globalIndex % shuffledUnsplash.length];
          // sig를 붙여 중복 이미지 체감을 낮춤
          finalImage = `${getUnsplashUrl(unsplashId)}&sig=${globalIndex}`;
        }

        cityBatch.push({
          content: isAd ? AD_COMMENTS[globalIndex % AD_COMMENTS.length] : REALISTIC_COMMENTS[globalIndex % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`, // Kakao API는 50개마다 호출하거나 생략 권장
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 5000),
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;

        // 100개 단위로 끊어서 즉시 삽입 (메모리 절약)
        if (cityBatch.length >= 100) {
          const { error } = await supabase.from('posts').insert([...cityBatch]);
          if (error) throw error;
          totalInserted += cityBatch.length;
          cityBatch.length = 0;
        }
      }

      // 남은 데이터 삽입
      if (cityBatch.length > 0) {
        await supabase.from('posts').insert(cityBatch);
        totalInserted += cityBatch.length;
      }
    }

    console.log(`✨ [Seeder] 총 ${totalInserted}개 포스팅 생성 완료!`);
    return totalInserted;
  } catch (err) {
    console.error("❌ [Seeder] 오류 발생:", err);
    throw err;
  }
};