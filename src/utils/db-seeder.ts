"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  createMockPosts
} from "@/lib/mock-data"; 

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("기존 데이터를 삭제하고 '내 포스팅'을 100개 이하로 제한하여 새로 생성하시겠습니까?");
  if (!confirmClear) return;

  try {
    console.log("🧹 데이터 초기화 중...");
    await supabase.from('posts').delete().neq('id', '_root_');

    // 다른 유저 풀 확보
    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .neq('id', currentUserId)
      .limit(100);

    const otherUsers = otherProfiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; // 내 포스팅 개수 추적
    const MAX_MY_POSTS = 80; // 내 포스팅 최대 개수 제한 (100개 이하)

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 생성 중...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        // [수정된 핵심 로직] 
        let postUser = { id: "", name: "", avatar: "" };
        
        // 1. 내 포스팅은 지정된 한도(80개) 내에서만 매우 낮은 확률로 생성
        if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.03) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else if (otherUsers.length > 0) {
          // 2. 나머지는 모두 다른 유저 배정
          const randomOther = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { 
            id: randomOther.id, 
            name: randomOther.nickname || "탐험가", 
            avatar: randomOther.avatar_url || `https://i.pravatar.cc/150?u=${randomOther.id}` 
          };
        } else {
          // 3. 다른 유저 정보가 부족할 경우 가상 유저 배정
          const virtualId = `virtual_user_${uniqueSeed % 500}`;
          postUser = { 
            id: virtualId, 
            name: `Explorer_${uniqueSeed % 1000}`, 
            avatar: `https://i.pravatar.cc/150?u=${virtualId}` 
          };
        }

        const isYoutube = i % 2 === 0;
        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isYoutube) {
          const ytId = YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          finalImage = getUnsplashUrl(uniqueSeed);
        }

        batch.push({
          content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 15000),
          created_at: new Date(Date.now() - Math.random() * 72 * 3600000).toISOString()
        });

        globalCount++;

        if (batch.length >= 100) {
          await supabase.from('posts').insert(batch);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
    
    console.log(`✅ 생성 완료! 총 포스팅: ${globalCount}, 내 포스팅: ${myPostCounter}`);
    alert(`성공! 내 포스팅은 딱 ${myPostCounter}개만 생성되었습니다.`);
  } catch (err) {
    console.error(err);
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};