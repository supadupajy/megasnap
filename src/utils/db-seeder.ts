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
  const confirmClear = confirm("기존 데이터를 삭제하고 '내 포스팅 80개 제한' 모드로 새로 생성하시겠습니까?");
  if (!confirmClear) return;

  try {
    await supabase.from('posts').delete().neq('id', '_root_');

    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .neq('id', currentUserId)
      .limit(100);

    const otherUsers = otherProfiles || [];
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80; // 내 포스팅 딱 80개만 제한

    for (const city of MAJOR_CITIES) {
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        let postUser = { id: "", name: "", avatar: "" };
        
        // 내 포스팅 개수가 80개 미만일 때만 가끔 내 계정 배정
        if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.03) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else if (otherUsers.length > 0) {
          const randomOther = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { 
            id: randomOther.id, 
            name: randomOther.nickname || "탐험가", 
            avatar: randomOther.avatar_url || `https://i.pravatar.cc/150?u=${randomOther.id}` 
          };
        } else {
          const virtualId = `v_${uniqueSeed % 500}`;
          postUser = { id: virtualId, name: `User_${uniqueSeed % 1000}`, avatar: `https://i.pravatar.cc/150?u=${virtualId}` };
        }

        const isYoutube = i % 2 === 0;
        let finalImage = isYoutube 
          ? `https://img.youtube.com/vi/${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}/maxresdefault.jpg`
          : getUnsplashUrl(uniqueSeed);

        batch.push({
          content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat, longitude: p.lng,
          image_url: finalImage,
          youtube_url: isYoutube ? `https://www.youtube.com/watch?v=${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}` : null,
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
    alert(`완료! 전체 포스팅: ${globalCount}, 내 포스팅: ${myPostCounter}개 생성됨.`);
  } catch (err) {
    console.error(err);
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};