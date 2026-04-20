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
  const confirmClear = confirm("광고 포스팅을 포함한 초고밀도 데이터 생성을 시작할까요?");
  if (!confirmClear) return 0;

  try {
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
        
        // [수정] 광고 여부 판별 (매 30번째 포스팅은 광고)
        const isAd = i % 30 === 0;
        let postUser = { id: "", name: "", avatar: "" };
        
        if (isAd) {
          postUser = { id: "ad_partner", name: "공식 파트너", avatar: "https://i.pravatar.cc/150?u=ad" };
        } else if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else if (otherUsers.length > 0) {
          const u = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        } else {
          postUser = { id: `v_${uniqueSeed%500}`, name: `User_${uniqueSeed%1000}`, avatar: `https://i.pravatar.cc/150?u=${uniqueSeed%500}` };
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
          latitude: p.lat, longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: postUser.id === "ad_partner" ? null : postUser.id, // 파트너는 유저 ID가 없을 수 있으므로 처리
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          is_ad: isAd, // [중요] 이 필드가 있어야 AD 배지가 뜹니다!
          likes: Math.floor(Math.random() * 20000),
          created_at: new Date(Date.now() - Math.random() * 120 * 3600000).toISOString()
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
  } catch (err) { console.error(err); return 0; }
};

export const randomizeExistingLikes = async () => { await supabase.rpc('randomize_all_likes'); };