"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  AD_COMMENTS,
  FOOD_IMAGES,
  createMockPosts
} from "@/lib/mock-data"; 

/**
 * 유튜브 유효성 정밀 체크
 */
async function validateYoutube(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.status !== 200) return false;
    const data = await res.json();
    return !!data.title && !data.title.toLowerCase().includes("private");
  } catch { return false; }
}

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("광고를 포함한 전국구 데이터를 생성할까요? (is_ad 컬럼 우회 로직 적용)");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 기존 데이터 삭제 중...");
    await supabase.from('posts').delete().not('id', 'is', null);

    console.log("📺 유튜브 영상 검증 중...");
    const playableIds = [];
    for (const id of YOUTUBE_IDS_50) {
      if (await validateYoutube(id)) playableIds.push(id);
    }

    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').neq('id', currentUserId).limit(100);
    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 지역 생성 중...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        // 30개마다 광고 생성
        const isAd = i % 30 === 0;
        let postUser = { id: "", name: "", avatar: "" };
        
        if (isAd) {
          // [핵심] 광고는 '공식 파트너'라는 이름을 식별자로 사용합니다.
          postUser = { id: currentUserId, name: "공식 파트너", avatar: "https://i.pravatar.cc/150?u=ad" };
        } else if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else {
          const u = otherUsers[uniqueSeed % otherUsers.length] || { id: currentUserId };
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        }

        const isYoutube = !isAd && i % 2 === 0 && playableIds.length > 0;
        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isAd) {
          finalImage = FOOD_IMAGES[globalCount % FOOD_IMAGES.length];
        } else if (isYoutube) {
          const ytId = playableIds[uniqueSeed % playableIds.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        } else {
          finalImage = getUnsplashUrl(uniqueSeed);
        }

        batch.push({
          content: isAd ? AD_COMMENTS[globalCount % AD_COMMENTS.length] : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 20000),
          created_at: new Date(Date.now() - Math.random() * 120 * 3600000).toISOString()
          // is_ad 필드는 DB에 없으므로 제외함
        });

        globalCount++;
        if (batch.length >= 100) {
          await supabase.from('posts').insert([...batch]);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
    return globalCount;
  } catch (err) { 
    console.error("❌ 시딩 실패:", err); 
    return 0; 
  }
};