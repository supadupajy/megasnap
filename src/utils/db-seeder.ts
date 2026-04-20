"use client";

import { supabase } from "@/integrations/supabase/client";
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
 * 1. 배열 셔플 함수
 */
const shuffle = <T>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

/**
 * 2. 유튜브 재생 가능 여부 체크
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

/**
 * 3. 메인 시딩 함수 (seedGlobalPosts)
 */
export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("중복 데이터 해결을 위해 기존 포스팅을 모두 삭제하고 새로 생성하시겠습니까?");
  
  try {
    if (confirmClear) {
      console.log("🧹 기존 데이터 삭제 중...");
      await supabase.from('posts').delete().neq('id', '_root_');
    }

    console.log("🚀 [Seeder] 데이터 생성 프로세스 시작...");

    // 유튜브 클린 리스트 확보
    const checkResults = await Promise.all(
      YOUTUBE_IDS_POOL.map(async (id) => ({ id, ok: await checkYoutubePlayable(id) }))
    );
    const cleanYoutubeIds = checkResults.filter(r => r.ok).map(r => r.id);

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
        const uniqueSeed = Date.now() + globalCount;
        
        const isAd = i % 30 === 0;
        const isYoutube = !isAd && i % 2 === 0;

        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isAd) {
          finalImage = `https://images.unsplash.com/featured/?food,restaurant&sig=${uniqueSeed}`;
        } else if (isYoutube && cleanYoutubeIds.length > 0) {
          const ytId = cleanYoutubeIds[uniqueSeed % cleanYoutubeIds.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          // 중복 방지를 위해 getUnsplashUrl에 유니크 시드 전달
          finalImage = getUnsplashUrl(undefined, uniqueSeed);
        }

        cityBatch.push({
          content: isAd ? AD_COMMENTS[i % AD_COMMENTS.length] : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
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
          const { error } = await supabase.from('posts').insert([...cityBatch]);
          if (error) throw error;
          cityBatch = [];
        }
      }
      if (cityBatch.length > 0) await supabase.from('posts').insert(cityBatch);
    }

    alert(`✨ 생성 완료! 총 ${globalCount}개의 데이터가 등록되었습니다.`);
    return globalCount;
  } catch (err) {
    console.error(err);
    alert("시딩 중 오류가 발생했습니다.");
  }
};

/**
 * 4. [중요] 누락되었던 좋아요 랜덤화 함수 (randomizeExistingLikes)
 */
export const randomizeExistingLikes = async () => {
  try {
    const { data, error } = await supabase.rpc('randomize_all_likes');
    if (error) throw error;
    return data || 0;
  } catch (err) {
    console.error("❌ [Seeder] 좋아요 랜덤화 실패:", err);
    throw err;
  }
};