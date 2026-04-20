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
    // 유튜브 서버에서 200 OK를 응답해야 유효한 영상입니다.
    return res.status === 200;
  } catch {
    return false;
  }
}

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("전국구 분포 및 유튜브 검증 시딩을 시작할까요? (기존 데이터 삭제 권장)");
  if (!confirmClear) return;

  try {
    console.log("🧹 데이터 초기화 중...");
    await supabase.from('posts').delete().neq('id', '_root_');

    // 1. 유튜브 ID들 중 현재 재생 가능한 것만 필터링
    console.log("📺 유튜브 영상 유효성 검사 중...");
    const playableIds = [];
    for (const id of YOUTUBE_IDS_50) {
      const ok = await validateYoutube(id);
      if (ok) playableIds.push(id);
    }
    console.log(`✅ 유효한 영상 ${playableIds.length}개 확보`);

    const { data: otherProfiles } = await supabase.from('profiles').select('id, nickname, avatar_url').neq('id', currentUserId).limit(100);
    const otherUsers = otherProfiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80; 

    // 2. 지역별 데이터 생성 루프
    for (const region of MAJOR_CITIES) {
      console.log(`📍 ${region.name} 생성 중 (${region.density}개)...`);
      const mockPoints = createMockPosts(region.lat, region.lng, region.density, undefined, region.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        let postUser = { id: "", name: "", avatar: "" };
        
        // 내 포스팅 비율 조절 (최대 80개)
        if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.02) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else if (otherUsers.length > 0) {
          const u = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        } else {
          const vid = `v_${uniqueSeed % 500}`;
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
          likes: Math.floor(Math.random() * 15000),
          created_at: new Date(Date.now() - Math.random() * 96 * 3600000).toISOString()
        });

        globalCount++;
        if (batch.length >= 100) {
          await supabase.from('posts').insert(batch);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
    alert(`✨ 완료! 전국에 ${globalCount}개 포스팅을 고르게 생성했습니다.`);
  } catch (err) {
    console.error(err);
  }
};

export const randomizeExistingLikes = async () => {
  await supabase.rpc('randomize_all_likes');
};