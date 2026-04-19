"use client";

import { supabase } from "@/integrations/supabase/client";
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

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  try {
    // 1. 유튜브 영상 사전 검증 (Clean List 만들기)
    console.log("유튜브 영상 정책 검토 중...");
    const validYoutubeIds: string[] = [];
    
    // 병렬로 체크하여 속도 향상
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

    for (const city of MAJOR_CITIES) {
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

        // 유튜브 영상으로 결정되었고, 검증된 리스트가 있는 경우
        if (isYoutube && validYoutubeIds.length > 0) {
          const videoId = validYoutubeIds[i % validYoutubeIds.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
          finalImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else {
          // 유튜브가 아니거나 검증된 영상이 없으면 Unsplash 이미지 사용
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
          created_at: new Date(Date.now() - Math.random() * 60 * 24 * 3600000).toISOString()
        });

        // 100개 단위 배치 삽입
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
      }
    }

    return totalInserted;
  } catch (err) {
    console.error("Seeding failed:", err);
    throw err;
  }
};

/**
 * 기존 모든 포스팅의 좋아요 수치를 무작위로 변경합니다.
 */
export const randomizeExistingLikes = async () => {
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
};