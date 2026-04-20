"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  UNSPLASH_IDS, 
  YOUTUBE_IDS_50, 
  FOOD_UNSPLASH_IDS, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  AD_COMMENTS
} from "./mock-data";

/**
 * 1단계: 유튜브 정책 검증 함수 (oEmbed 활용)
 * 브라우저 콘솔 에러를 최소화하기 위해 404를 조용히 처리합니다.
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
 * 2단계: 메인 시딩 함수
 */
export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 데이터 생성을 시작합니다...");

  try {
    // [중요] 유튜브 클린 리스트 확보 (병렬 대신 순차적 체크로 차단 방지)
    console.log("🔍 영상 정책 검토 중 (잠시만 기다려주세요)...");
    const validYoutubeIds: string[] = [];
    for (const id of YOUTUBE_IDS_50) {
      const ok = await checkYoutubePlayable(id);
      if (ok) validYoutubeIds.push(id);
      // 유튜브 서버 부하 방지를 위해 아주 짧은 대기 (선택 사항)
      await new Promise(r => setTimeout(r, 50)); 
    }
    console.log(`✅ 검증 완료: ${validYoutubeIds.length}개의 영상 확보`);

    // 유저 풀 확보
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(50);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    let globalIndex = 0;
    let totalInserted = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 생성 중...`);
      const cityBatch: any[] = [];

      for (let i = 0; i < city.density; i++) {
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const lat = city.bounds.sw.lat + Math.random() * (city.bounds.ne.lat - city.bounds.sw.lat);
        const lng = city.bounds.sw.lng + Math.random() * (city.bounds.ne.lng - city.bounds.sw.lng);

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
          // sig를 붙여 100장의 이미지를 1500개에 뿌려도 다 다르게 인식되게 함
          finalImage = getUnsplashUrl(unsplashId, globalIndex);
        }

        cityBatch.push({
          content: isAd ? AD_COMMENTS[globalIndex % AD_COMMENTS.length] : REALISTIC_COMMENTS[globalIndex % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: lat,
          longitude: lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 3000),
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;

        // 100개마다 DB에 쏟아부음
        if (cityBatch.length >= 100) {
          const { error } = await supabase.from('posts').insert([...cityBatch]);
          if (error) throw error;
          totalInserted += cityBatch.length;
          cityBatch.length = 0;
        }
      }

      // 남은 잔여 데이터 삽입
      if (cityBatch.length > 0) {
        await supabase.from('posts').insert(cityBatch);
        totalInserted += cityBatch.length;
      }
    }

    console.log(`✨ 총 ${totalInserted}개 성공적으로 생성!`);
    return totalInserted;
  } catch (err) {
    console.error("❌ 시딩 실패:", err);
    throw err;
  }
};