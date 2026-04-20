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
  const confirmClear = confirm("DB에 존재하는 컬럼만 사용하여 데이터 생성을 시작할까요? (에러 해결 버전)");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 기존 데이터 삭제 중...");
    await supabase.from('posts').delete().neq('id', '_root_');

    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').neq('id', currentUserId).limit(100);
    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;

    for (const region of MAJOR_CITIES) {
      const mockPoints = createMockPosts(region.lat, region.lng, region.density);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const uniqueSeed = Date.now() + globalCount;
        const isAd = i % 30 === 0; // 30개마다 광고로 설정
        
        let postUser = { id: "", name: "", avatar: "" };
        
        if (isAd) {
          // 광고일 경우 이름을 '공식 파트너'로 설정하여 프론트엔드에서 구분 가능하게 함
          postUser = { id: currentUserId, name: "공식 파트너", avatar: "https://i.pravatar.cc/150?u=ad" };
        } else if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else {
          const u = otherUsers[uniqueSeed % otherUsers.length] || { id: currentUserId, nickname: "탐험가", avatar_url: "" };
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        }

        const isYoutube = !isAd && i % 2 === 0;
        let finalImage = isAd ? FOOD_IMAGES[globalCount % FOOD_IMAGES.length] : 
                         (isYoutube ? `https://img.youtube.com/vi/${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}/hqdefault.jpg` : getUnsplashUrl(uniqueSeed));

        // [핵심] DB에 실재하는 컬럼만 전송합니다.
        batch.push({
          content: isAd ? AD_COMMENTS[globalCount % AD_COMMENTS.length] : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: region.name,
          latitude: mockPoints[i].lat,
          longitude: mockPoints[i].lng,
          image_url: finalImage,
          youtube_url: isYoutube ? `https://www.youtube.com/watch?v=${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}` : null,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 20000),
          created_at: new Date(Date.now() - Math.random() * 120 * 3600000).toISOString()
          // 'is_ad' 컬럼은 제거했습니다.
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

export const randomizeExistingLikes = async () => { await supabase.rpc('randomize_all_likes'); };