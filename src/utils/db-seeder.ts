"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
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
    return !!data.title && !data.title.includes("Private video");
  } catch {
    return false;
  }
}

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("중복 제거 및 '내 포스팅 80개 제한' 생성을 시작할까요?");
  if (!confirmClear) return;

  try {
    console.log("🧹 기존 데이터 삭제 중...");
    await supabase.from('posts').delete().neq('id', '_root_');

    console.log("📺 유튜브 재생 가능 영상 확인 중...");
    const playableIds = [];
    for (const id of YOUTUBE_IDS_50) {
      const ok = await validateYoutube(id);
      if (ok) playableIds.push(id);
    }

    // [에러 해결] profiles로 받아서 정확히 참조합니다.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .neq('id', currentUserId)
      .limit(100);

    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80; // [제한] 내 포스팅 최대 개수

    for (const region of MAJOR_CITIES) {
      console.log(`📍 ${region.name} 생성 중...`);
      const mockPoints = createMockPosts(region.lat, region.lng, region.density, undefined, region.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        let postUser = { id: "", name: "", avatar: "" };
        
        // 내 포스팅 개수 조절
        if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.025) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else if (otherUsers.length > 0) {
          const u = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        } else {
          const vid = `user_${uniqueSeed % 1000}`;
          postUser = { id: vid, name: `User_${uniqueSeed % 1000}`, avatar: `https://i.pravatar.cc/150?u=${vid}` };
        }

        const isYoutube = i % 2 === 0 && playableIds.length > 0;
        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isYoutube) {
          const ytId = playableIds[uniqueSeed % playableIds.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
          finalImage = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        } else {
          finalImage = getUnsplashUrl(uniqueSeed);
        }

        batch.push({
          content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${region.name} 주변`,
          latitude: p.lat, longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 20000),
          created_at: new Date(Date.now() - Math.random() * 120 * 3600000).toISOString()
        });

        globalCount++;
        if (batch.length >= 100) {
          await supabase.from('posts').insert(batch);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
    alert(`✨ 성공! 전국 분산 배치 및 유튜브 검증 완료. 내 포스팅: ${myPostCounter}개.`);
  } catch (err) {
    console.error(err);
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};