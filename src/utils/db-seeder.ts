"use client";

import { supabase } from "@/integrations/supabase/client";
<<<<<<< HEAD
import { 
  MAJOR_CITIES, 
  YOUTUBE_IDS_50, 
  getUnsplashUrl,
  REALISTIC_COMMENTS,
  AD_COMMENTS,
  FOOD_IMAGES,
  createMockPosts
} from "@/lib/mock-data"; 
=======
import { MAJOR_CITIES, REALISTIC_COMMENTS, YOUTUBE_IDS_50, getUnsplashUrl, UNSPLASH_IDS_100 } from "@/lib/mock-data";

/**
 * 유튜브 영상의 유효성(재생 가능 여부)을 확인합니다.
 */
const validateYoutubeVideo = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return response.status === 200;
  } catch {
    return false;
  }
};

const CATEGORIES = ['food', 'accident', 'place', 'animal'];
>>>>>>> 4276c7ce3d5860f851efd72cb8fcac5f0cee0d0a

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  const confirmClear = confirm("서울 중심이 아닌 '전국 8도 거점' 대도시 위주로 데이터를 생성하시겠습니까?");
  if (!confirmClear) return 0;

  try {
<<<<<<< HEAD
    console.log("🧹 전국 데이터 초기화 중...");
    await supabase.from('posts').delete().not('id', 'is', null);

    const { data: profiles } = await supabase.from('profiles').select('id, nickname').neq('id', currentUserId).limit(100);
    const otherUsers = profiles || [];
    
    let globalCount = 0;
    let myPostCounter = 0; 
    const MAX_MY_POSTS = 80;
=======
    // 1. 유튜브 영상 사전 검증 (Clean List 만들기)
    console.log("유튜브 영상 정책 검토 중...");
    const validYoutubeIds: string[] = [];
    
    const checkPromises = YOUTUBE_IDS_50.map(async (id) => {
      const isValid = await validateYoutubeVideo(id);
      if (isValid) validYoutubeIds.push(id);
    });
    await Promise.all(checkPromises);

    console.log(`검토 완료: ${YOUTUBE_IDS_50.length}개 중 ${validYoutubeIds.length}개 재생 가능`);

    // 2. 유저 풀 확보
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    let totalInserted = 0;
>>>>>>> 4276c7ce3d5860f851efd72cb8fcac5f0cee0d0a

    // 전국 MAJOR_CITIES 순회
    for (const city of MAJOR_CITIES) {
<<<<<<< HEAD
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
=======
      console.log(`${city.name} 데이터 생성 시작...`);
      const cityInsertData: any[] = [];
      const density = 1500; 

      for (let i = 0; i < density; i++) {
        const isYoutube = Math.random() > 0.5;
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const lat = city.bounds.sw.lat + Math.random() * (city.bounds.ne.lat - city.bounds.sw.lat);
        const lng = city.bounds.sw.lng + Math.random() * (city.bounds.ne.lng - city.bounds.sw.lng);

        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isYoutube && validYoutubeIds.length > 0) {
          const videoId = validYoutubeIds[i % validYoutubeIds.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
          finalImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else {
          const imageId = UNSPLASH_IDS_100[i % UNSPLASH_IDS_100.length];
          finalImage = getUnsplashUrl(imageId);
        }

        cityInsertData.push({
          content: REALISTIC_COMMENTS[Math.floor(Math.random() * REALISTIC_COMMENTS.length)],
          location_name: `${city.name} 인근`,
          latitude: lat,
          longitude: lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 5000),
          category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)], // 랜덤 카테고리 추가
          created_at: new Date(Date.now() - Math.random() * 60 * 24 * 3600000).toISOString()
        });

        if (cityInsertData.length >= 100) {
          const { error } = await supabase.from('posts').insert(cityInsertData);
          if (error) throw error;
          totalInserted += cityInsertData.length;
          cityInsertData.length = 0;
        }
      }

      if (cityInsertData.length > 0) {
        await supabase.from('posts').insert(cityInsertData);
        totalInserted += cityInsertData.length;
>>>>>>> 4276c7ce3d5860f851efd72cb8fcac5f0cee0d0a
      }
      if (batch.length > 0) await supabase.from('posts').insert(batch);
    }
<<<<<<< HEAD
    return globalCount;
  } catch (err) { 
    console.error("❌ 시딩 실패:", err); 
    return 0; 
=======

    return totalInserted;
  } catch (err) {
    console.error("Seeding failed:", err);
    throw err;
>>>>>>> 4276c7ce3d5860f851efd72cb8fcac5f0cee0d0a
  }
};

export const randomizeExistingLikes = async () => {
<<<<<<< HEAD
  await supabase.rpc('randomize_all_likes');
=======
  try {
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id');
    
    if (fetchError) throw fetchError;
    if (!posts || posts.length === 0) return 0;

    const chunkSize = 20;
    for (let i = 0; i < posts.length; i += chunkSize) {
      const chunk = posts.slice(i, i + chunkSize);
      const updatePromises = chunk.map(post => 
        supabase
          .from('posts')
          .update({ likes: Math.floor(Math.random() * 25000) })
          .eq('id', post.id)
      );
      await Promise.all(updatePromises);
    }
    
    return posts.length;
  } catch (err: any) {
    console.error("Randomizing likes failed:", err);
    throw err;
  }
>>>>>>> 4276c7ce3d5860f851efd72cb8fcac5f0cee0d0a
};