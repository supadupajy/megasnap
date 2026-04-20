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
  const confirmClear = confirm("전국 8대 대도시에 포스팅을 생성합니다. 기존 데이터를 삭제할까요?");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 데이터 초기화 중 (강력 삭제 모드)...");
    
    // [개선] 쿼리가 동작하지 않을 경우를 대비해 id가 null이 아닌 모든 행을 타겟팅합니다.
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .not('id', 'is', null); // 모든 데이터를 지우는 가장 확실한 방법 중 하나

    if (deleteError) {
      console.error("❌ 삭제 실패:", deleteError.message);
      alert("데이터 삭제에 실패했습니다. RLS 정책을 확인하세요.");
      return 0;
    }

    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').neq('id', currentUserId).limit(100);
    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;

    // [핵심] MAJOR_CITIES 리스트를 돌며 전국에 생성
    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 지역 데이터 생성 중...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const p = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount;
        
        let postUser = { id: "", name: "", avatar: "" };
        
        // 내 포스팅 제한 로직
        if (myPostCounter < MAX_MY_POSTS && Math.random() < 0.015) {
          postUser = { id: currentUserId, name: currentNickname, avatar: currentAvatar };
          myPostCounter++;
        } else {
          const u = otherUsers[uniqueSeed % otherUsers.length] || { id: currentUserId };
          postUser = { id: u.id, name: u.nickname || "탐험가", avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}` };
        }

        const isYoutube = i % 2 === 0;
        let finalImage = isYoutube 
          ? `https://img.youtube.com/vi/${YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length]}/hqdefault.jpg`
          : getUnsplashUrl(uniqueSeed);

        batch.push({
          content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: `${city.name} 인근`,
          latitude: p.lat, 
          longitude: p.lng,
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
          await supabase.from('posts').insert([...batch]);
          batch = [];
        }
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }

    alert(`✨ 성공! 전국 8대 도시 전역에 ${globalCount}개의 포스팅이 배치되었습니다.`);
    return globalCount;

  } catch (err) { 
    console.error("❌ 시딩 실패:", err); 
    return 0; 
  }
};

export const randomizeExistingLikes = async () => { await supabase.rpc('randomize_all_likes'); };