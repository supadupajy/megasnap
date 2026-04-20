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

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("서울 중심이 아닌 '전국 8도 거점' 대도시 위주로 데이터를 생성하시겠습니까?");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 전국 데이터 초기화 중...");
    await supabase.from('posts').delete().not('id', 'is', null);

    const { data: profiles } = await supabase.from('profiles').select('id, nickname').neq('id', currentUserId).limit(100);
    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;

    // 전국 MAJOR_CITIES 순회
    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 지역 생성 중 (${city.density}개)...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        // 30개마다 광고 생성
        const isAd = i % 30 === 0;
        let postUser = { id: "", name: "", avatar: "" };
        
        if (isAd) {
          postUser = { id: currentUserId, name: "공식 파트너", avatar: "https://i.pravatar.cc/150?u=ad" };
        } else if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else {
          const u = otherUsers[uniqueSeed % otherUsers.length] || { id: currentUserId };
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: `https://i.pravatar.cc/150?u=${u.id}` };
        }

        const isYoutube = !isAd && i % 2 === 0;
        let finalImage = isAd ? FOOD_IMAGES[globalCount % FOOD_IMAGES.length] : 
                         (isYoutube ? `https://img.youtube.com/vi/${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}/hqdefault.jpg` : getUnsplashUrl(uniqueSeed));

        batch.push({
          content: isAd ? AD_COMMENTS[globalCount % AD_COMMENTS.length] : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: city.name,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: isYoutube ? `https://www.youtube.com/watch?v=${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}` : null,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
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
  } catch (err) { 
    console.error("❌ 시딩 실패:", err); 
    return 0; 
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};