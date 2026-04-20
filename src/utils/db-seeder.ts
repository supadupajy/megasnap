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

async function validateYoutube(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.status !== 200) return false;
    const data = await res.json();
    return !!data.title && !data.title.toLowerCase().includes("private");
  } catch { return false; }
}

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("DB 제약 조건을 해결한 광고 포함 생성을 시작할까요?");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 데이터 초기화 중...");
    await supabase.from('posts').delete().neq('id', '_root_');

    const playableIds = [];
    for (const id of YOUTUBE_IDS_50) {
      if (await validateYoutube(id)) playableIds.push(id);
    }

    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').neq('id', currentUserId).limit(100);
    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;

    for (const region of MAJOR_CITIES) {
      console.log(`📍 ${region.name} 시딩 중...`);
      const mockPoints = createMockPosts(region.lat, region.lng, region.density, undefined, region.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        const isAd = i % 30 === 0;
        let postUser = { id: "", name: "", avatar: "" };
        
        if (isAd) {
          // [해결] 광고 포스팅도 DB 제약 조건을 피하기 위해 내 ID(currentUserId)를 할당합니다.
          // UI에서는 is_ad: true 값으로 광고 여부를 판단하므로 ID는 상관없습니다.
          postUser = { id: currentUserId, name: "공식 파트너", avatar: "https://i.pravatar.cc/150?u=ad" };
        } else if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else if (otherUsers.length > 0) {
          const u = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        } else {
          // 가상 유저인 경우에도 실제 UUID가 아닌 문자열은 DB에서 튕길 수 있습니다. 
          // 안전하게 내 ID나 기존 유저 ID를 재활용합니다.
          const fallbackUser = otherUsers.length > 0 ? otherUsers[uniqueSeed % otherUsers.length] : { id: currentUserId };
          postUser = { id: fallbackUser.id, name: `Explorer_${uniqueSeed%1000}`, avatar: `https://i.pravatar.cc/150?u=${uniqueSeed%500}` };
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
          location_name: region.name,
          latitude: p.lat, 
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: postUser.id, // 반드시 유효한 UUID여야 함
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          is_ad: isAd,
          likes: Math.floor(Math.random() * 20000),
          created_at: new Date(Date.now() - Math.random() * 120 * 3600000).toISOString()
        });

        globalCount++;
        if (batch.length >= 100) {
          const { error } = await supabase.from('posts').insert([...batch]);
          if (error) {
            console.error("❌ 배치 인서트 오류:", error.message);
            throw error;
          }
          batch = [];
        }
      }
      if (batch.length > 0) {
        const { error } = await supabase.from('posts').insert(batch);
        if (error) console.error("❌ 최종 배치 오류:", error.message);
      }
    }
    return globalCount;
  } catch (err) { 
    console.error("❌ 전체 시딩 실패:", err); 
    return 0; 
  }
};

export const randomizeExistingLikes = async () => { await supabase.rpc('randomize_all_likes'); };