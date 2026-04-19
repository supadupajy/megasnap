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
  },
  // ... 인천, 대구, 대전, 광주, 울산, 수원 등 포함
];

// 2. 현실적인 댓글/내용 풀
const REALISTIC_COMMENTS = [
  '여기 분위기 진짜 대박이에요! 꼭 가보세요. 😍',
  '오늘 날씨랑 찰떡인 장소 발견! 기분 전환 제대로 되네요. ✨',
  '숨은 명소 발견! 나만 알고 싶지만 공유합니다. 📍',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!',
  // ... 더 많은 댓글 데이터
];

// 3. 좌표를 주소 문자열로 변환 (카카오 API 활용)
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

// 4. 메인 생성 함수
export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  try {
    // 유저 풀 확보 (다양한 작성자 연출)
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];
    
    const allInsertData: any[] = [];
    let globalIndex = 0;

    for (const city of MAJOR_CITIES) {
      // 각 도시별 밀도만큼 데이터 생성
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      
      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const realAddress = await getAddressFromCoords(p.lat, p.lng);
        
        let finalYoutubeUrl = null;
        let finalImage = "";
        
        // 50:50 비율로 유튜브 영상과 일반 이미지 믹스
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
          likes: Math.floor(Math.random() * 20000), // 0~2만 사이 좋아요
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;
      }
    }

    // 5. 대량 삽입 (Chunk 단위로 나누어 전송)
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