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
  const confirmClear = confirm("중복 방지를 위해 기존 데이터를 완전히 삭제하고 새로 생성하시겠습니까?");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 데이터 초기화 시도 중...");

    /**
     * [삭제 로직 개선]
     * id가 UUID인 경우에도 에러가 나지 않도록 '존재할 수 없는 UUID' 형식을 사용하거나,
     * 모든 id가 null이 아니라는 조건을 활용합니다.
     */
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // UUID/문자열 모두 대응 가능한 안전한 필터

    if (deleteError) {
      console.error("❌ 삭제 쿼리 실패:", deleteError.message);
      alert(`데이터 삭제에 실패했습니다: ${deleteError.message}\n(RLS 정책을 확인해주세요)`);
      // 삭제 실패 시 생성을 중단하거나 강행할 수 있습니다. 여기서는 안전을 위해 중단합니다.
      return 0; 
    }

    console.log("✅ 기존 데이터 삭제 완료. 새로운 생성을 시작합니다.");

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .neq('id', currentUserId)
      .limit(100);

    const otherUsers = profiles || [];
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;

    for (const region of MAJOR_CITIES) {
      console.log(`📍 ${region.name} 생성 중...`);
      const mockPoints = createMockPosts(region.lat, region.lng, region.density);
      let batch: any[] = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const uniqueSeed = Date.now() + globalCount;
        const isAd = i % 30 === 0;
        
        let postUser = { id: "", name: "", avatar: "" };
        
        if (isAd) {
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
    console.error("❌ 시딩 과정 중 예외 발생:", err); 
    return 0; 
  }
};

export const randomizeExistingLikes = async () => { await supabase.rpc('randomize_all_likes'); };