"use client";

import { supabase } from "@/integrations/supabase/client";
import { MAJOR_CITIES, REALISTIC_COMMENTS } from "@/lib/mock-data";

/**
 * 1. 검증된 유튜브 ID 리스트 (K-POP & POP)
 * 공식 채널(HYBE, SMTOWN, JYP) 영상들은 대부분 임베드를 허용합니다.
 */
const VERIFIED_YOUTUBE_IDS = [
  "gdZLi9hhztQ", "WMweEpGlu_U", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo", // NewJeans, BTS, IVE
  "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", "0NCP48xaSfs", "h4m-pIReA6Y", // Pop: Dua Lipa, Bruno Mars 등
  "TQTlCHxyuu8", "M7lc1UVf-VE", "9bZkp7q19f0", "hTermM40EDU", "CtpT_S6-B9U" 
];

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  try {
    // 유저 풀 (작성자 다양화)
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    let totalInserted = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`${city.name} 데이터 생성 시작... (밀도: 1500)`);
      const cityInsertData: any[] = [];
      
      // 밀도 1500 반영
      const density = 1500; 

      for (let i = 0; i < density; i++) {
        const isYoutube = Math.random() > 0.5;
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        // 좌표 랜덤 생성
        const lat = city.bounds.sw.lat + Math.random() * (city.bounds.ne.lat - city.bounds.sw.lat);
        const lng = city.bounds.sw.lng + Math.random() * (city.bounds.ne.lng - city.bounds.sw.lng);

        let finalImage = "";
        let finalYoutubeUrl = null;

        if (isYoutube) {
          // 리스트 중 랜덤 선택
          const videoId = VERIFIED_YOUTUBE_IDS[i % VERIFIED_YOUTUBE_IDS.length];
          finalYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
          // 고화질 썸네일 경로
          finalImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else {
          // Picsum 이미지를 시드와 함께 활용
          const imageSeed = (i % 100) + 1;
          finalImage = `https://picsum.photos/seed/${imageSeed + city.name}/800/600`; 
        }

        cityInsertData.push({
          content: REALISTIC_COMMENTS[Math.floor(Math.random() * REALISTIC_COMMENTS.length)],
          location_name: `${city.name} ${Math.floor(Math.random() * 100) + 1}번길 인근`,
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

        // 100개 단위로 끊어서 DB 삽입 (메모리 방어)
        if (cityInsertData.length >= 100) {
          const { error } = await supabase.from('posts').insert(cityInsertData);
          if (error) throw error;
          totalInserted += cityInsertData.length;
          cityInsertData.length = 0; // 배열 비우기
        }
      }

      // 남은 데이터 삽입
      if (cityInsertData.length > 0) {
        const { error } = await supabase.from('posts').insert(cityInsertData);
        if (error) throw error;
        totalInserted += cityInsertData.length;
      }
    }

    return totalInserted;
  } catch (err: any) {
    console.error("Global seeding failed:", err);
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