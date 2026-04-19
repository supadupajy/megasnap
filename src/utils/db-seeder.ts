"use client";

import { supabase } from "@/integrations/supabase/client";
import { MAJOR_CITIES, REALISTIC_COMMENTS, UNSPLASH_IDS_100, YOUTUBE_IDS_50 } from "@/lib/mock-data";

// 유틸리티: 배열 셔플 (중복 느낌을 최소화하기 위함)
const shuffleArray = <T>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  try {
    // 1. 유저 풀 확보
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(50);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    // 2. 데이터 소스 셔플
    const shuffledImages = shuffleArray(UNSPLASH_IDS_100);
    const shuffledVideos = shuffleArray(YOUTUBE_IDS_50);
    
    const allInsertData: any[] = [];

    for (const city of MAJOR_CITIES) {
      // 도시별 생성 개수 제한 (브라우저 과부하 방지)
      const count = Math.min(city.density, 100); 
      
      for (let i = 0; i < count; i++) {
        // 무작위 좌표 생성 (범위 내)
        const lat = city.bounds.sw.lat + Math.random() * (city.bounds.ne.lat - city.bounds.sw.lat);
        const lng = city.bounds.sw.lng + Math.random() * (city.bounds.ne.lng - city.bounds.sw.lng);
        
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const isYoutube = Math.random() > 0.5; // 50:50 확률
        
        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isYoutube) {
          const videoId = shuffledVideos[i % shuffledVideos.length]; // 50개 내에서 순환
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
          finalImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else {
          const imageId = shuffledImages[i % shuffledImages.length]; // 100개 내에서 순환
          finalImage = `https://images.unsplash.com/photo-${imageId}?auto=format&fit=crop&q=80&w=800`;
        }

        allInsertData.push({
          content: REALISTIC_COMMENTS[Math.floor(Math.random() * REALISTIC_COMMENTS.length)],
          location_name: `${city.name} 어딘가`, // API 호출 속도 문제로 단순화 권장
          latitude: lat,
          longitude: lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 2000),
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 3600000).toISOString() // 최근 한달
        });
      }
    }

    // 3. 청크 단위 삽입 (Supabase 안정성)
    const chunkSize = 100;
    for (let i = 0; i < allInsertData.length; i += chunkSize) {
      const chunk = allInsertData.slice(i, i + chunkSize);
      const { error } = await supabase.from('posts').insert(chunk);
      if (error) console.error("Insert Error:", error);
    }

    return allInsertData.length;
  } catch (err: any) {
    console.error("Seeding failed:", err);
    throw err;
  }
};

/**
 * 기존 모든 포스팅의 좋아요 수치를 무작위로 변경합니다.
 * 인기 탭의 순위를 갱신하기 위해 사용됩니다.
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