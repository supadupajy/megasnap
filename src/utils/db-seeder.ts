"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  createMockPosts
} from "@/lib/mock-data"; 

async function checkYoutubePlayable(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    return res.ok;
  } catch {
    return false;
  }
}

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("기존 데이터를 삭제하고 다양한 유저 비율로 새로 생성하시겠습니까?");
  if (!confirmClear) return;

  try {
    console.log("🧹 데이터 초기화 중...");
    await supabase.from('posts').delete().neq('id', '_root_');

    // [개선] 더 많은 유저 프로필을 가져와 유저 풀을 만듭니다 (최대 100명)
    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .neq('id', currentUserId)
      .limit(100);

    const otherUsers = otherProfiles || [];
    
    console.log(`👤 확보된 타인 프로필: ${otherUsers.length}개`);

    let globalCount = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 생성 중...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        // [핵심] 유저 배정 로직 (나의 포스팅 비율 조절)
        let postUser = { id: "", name: "", avatar: "" };
        const userRand = Math.random();

        if (userRand < 0.05) { 
          // 1. 본인 포스팅 (5% 확률)
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
        } else if (otherUsers.length > 0) {
          // 2. 다른 유저 배정 (95% 확률)
          const randomOther = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { 
            id: randomOther.id, 
            name: randomOther.nickname || "탐험가", 
            avatar: randomOther.avatar_url || `https://i.pravatar.cc/150?u=${randomOther.id}` 
          };
        } else {
          // 3. 만약 다른 유저가 없다면 가상 유저 생성
          const virtualId = `virtual_${uniqueSeed % 100}`;
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
          location_name: `${city.name} 어딘가`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 15000), // 인기 포스팅 연출을 위해 범위 확대
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
    alert("✨ 다양한 유저 비율로 데이터 생성이 완료되었습니다!");
  } catch (err) {
    console.error(err);
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};