"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
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
  const confirmClear = confirm("전국 8대 도시에 포스팅을 생성합니다. 기존 데이터를 초기화할까요?");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 데이터 초기화 중 (강력 삭제 모드)...");
    const { error: deleteError } = await supabase.from('posts').delete().not('id', 'is', null);

    if (deleteError) {
      console.error("❌ 삭제 실패:", deleteError.message);
      alert("삭제 실패: RLS 정책을 확인하세요.");
      return 0;
    }

    console.log("📺 유튜브 검증 중...");
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
      console.log(`📍 ${city.name} 생성 중...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        let postUser = { id: "", name: "", avatar: "" };
        
        if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else {
          const u = otherUsers[uniqueSeed % otherUsers.length] || { id: currentUserId };
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        }

        const isYoutube = i % 2 === 0 && playableIds.length > 0;
        let finalImage = isYoutube 
          ? `https://img.youtube.com/vi/${playableIds[uniqueSeed % playableIds.length]}/hqdefault.jpg`
          : getUnsplashUrl(uniqueSeed);

        batch.push({
          content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat, 
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: isYoutube ? `https://www.youtube.com/watch?v=${playableIds[uniqueSeed % playableIds.length]}` : null,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 15000),
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