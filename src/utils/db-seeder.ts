"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts, YOUTUBE_LINKS, UNSPLASH_IDS, FOOD_UNSPLASH_IDS, getUnsplashUrl } from "@/lib/mock-data";
import { getYoutubeThumbnail } from "@/lib/utils";

// 1. 대한민국 주요 도시 및 데이터 밀도 설정
const MAJOR_CITIES = [
  { 
    name: "서울", 
    lat: 37.5665, lng: 126.9780, 
    density: 1500,
    bounds: { sw: { lat: 37.4200, lng: 126.7500 }, ne: { lat: 37.7200, lng: 127.2000 } }
  },
  { 
    name: "부산", 
    lat: 35.1796, lng: 129.0756, 
    density: 800,
    bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } }
  },
  { 
    name: "제주", 
    lat: 33.4996, lng: 126.5312, 
    density: 600,
    bounds: { sw: { lat: 33.2142, lng: 126.2142 }, ne: { lat: 33.5542, lng: 126.9142 } }
  }
];

const REALISTIC_COMMENTS = [
  '여기 분위기 진짜 대박이에요! 꼭 가보세요. 😍',
  '오늘 날씨랑 찰떡인 장소 발견! 기분 전환 제대로 되네요. ✨',
  '숨은 명소 발견! 나만 알고 싶지만 공유합니다. 📍',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!'
];

const getAddressFromCoords = (lat: number, lng: number): Promise<string> => {
  return new Promise((resolve) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) { resolve("대한민국"); return; }
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].address;
        const region = `${addr.region_1depth_name} ${addr.region_2depth_name} ${addr.region_3depth_name}`.trim();
        resolve(region || "대한민국");
      } else { resolve("대한민국"); }
    });
  });
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  try {
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];
    
    const allInsertData: any[] = [];
    let globalIndex = 0;

    for (const city of MAJOR_CITIES) {
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      
      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const realAddress = await getAddressFromCoords(p.lat, p.lng);
        
        let finalYoutubeUrl = null;
        let finalImage = "";
        
        if (globalIndex % 2 === 0) {
          const ytUrl = YOUTUBE_LINKS[globalIndex % YOUTUBE_LINKS.length];
          finalYoutubeUrl = ytUrl;
          finalImage = getYoutubeThumbnail(ytUrl) || getUnsplashUrl(UNSPLASH_IDS[globalIndex % UNSPLASH_IDS.length]);
        } else {
          finalImage = getUnsplashUrl(UNSPLASH_IDS[globalIndex % UNSPLASH_IDS.length]);
        }

        allInsertData.push({
          content: REALISTIC_COMMENTS[globalIndex % REALISTIC_COMMENTS.length],
          location_name: realAddress,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: Math.floor(Math.random() * 20000),
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;
      }
    }

    const chunkSize = 50;
    for (let i = 0; i < allInsertData.length; i += chunkSize) {
      const chunk = allInsertData.slice(i, i + chunkSize);
      const { error } = await supabase.from('posts').insert(chunk);
      if (error) throw error;
    }
    
    return allInsertData.length;
  } catch (err: any) { 
    console.error("Global seeding failed:", err); 
    throw err; 
  }
};

/**
 * 기존 모든 포스팅의 좋아요 수치를 무작위로 변경합니다.
 * 인기 탭의 순위를 갱신하기 위해 사용됩니다.
 */
export const randomizeExistingLikes = async () => {
  try {
    // 1. 모든 포스팅 ID 가져오기
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id');
    
    if (fetchError) throw fetchError;
    if (!posts || posts.length === 0) return 0;

    // 2. Chunk 단위로 업데이트 수행 (성능 및 안정성)
    const chunkSize = 20;
    for (let i = 0; i < posts.length; i += chunkSize) {
      const chunk = posts.slice(i, i + chunkSize);
      
      // 각 포스팅에 대해 개별 업데이트 프로미스 생성
      const updatePromises = chunk.map(post => 
        supabase
          .from('posts')
          .update({ likes: Math.floor(Math.random() * 25000) }) // 0~25,000 사이 랜덤
          .eq('id', post.id)
      );

      // 병렬 실행
      await Promise.all(updatePromises);
    }
    
    return posts.length;
  } catch (err: any) {
    console.error("Randomizing likes failed:", err);
    throw err;
  }
};