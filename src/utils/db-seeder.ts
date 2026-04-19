"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts } from "@/lib/mock-data";

/**
 * 대한민국 주요 대도시 좌표 및 영역(Bounds) 목록
 */
const MAJOR_CITIES = [
  { 
    name: "서울", 
    lat: 37.5665, lng: 126.9780, 
    density: 60,
    bounds: { sw: { lat: 37.42, lng: 126.76 }, ne: { lat: 37.70, lng: 127.18 } }
  },
  { 
    name: "부산", 
    lat: 35.1796, lng: 129.0756, 
    density: 40,
    bounds: { sw: { lat: 35.01, lng: 128.86 }, ne: { lat: 35.32, lng: 129.27 } }
  },
  { 
    name: "인천", 
    lat: 37.4563, lng: 126.7052, 
    density: 30,
    bounds: { sw: { lat: 37.35, lng: 126.45 }, ne: { lat: 37.60, lng: 126.85 } }
  },
  { 
    name: "대구", 
    lat: 35.8714, lng: 128.6014, 
    density: 25,
    bounds: { sw: { lat: 35.75, lng: 128.45 }, ne: { lat: 35.95, lng: 128.75 } }
  },
  { 
    name: "대전", 
    lat: 36.3504, lng: 127.3845, 
    density: 25,
    bounds: { sw: { lat: 36.25, lng: 127.25 }, ne: { lat: 36.45, lng: 127.50 } }
  },
  { 
    name: "광주", 
    lat: 35.1595, lng: 126.8526, 
    density: 25,
    bounds: { sw: { lat: 35.05, lng: 126.75 }, ne: { lat: 35.25, lng: 126.95 } }
  },
  { 
    name: "울산", 
    lat: 35.5384, lng: 129.3114, 
    density: 20,
    bounds: { sw: { lat: 35.45, lng: 129.15 }, ne: { lat: 35.65, lng: 129.45 } }
  },
  { 
    name: "수원", 
    lat: 37.2636, lng: 127.0286, 
    density: 25,
    bounds: { sw: { lat: 37.20, lng: 126.90 }, ne: { lat: 37.35, lng: 127.15 } }
  },
  { 
    name: "제주", 
    lat: 33.4996, lng: 126.5312, 
    density: 30,
    bounds: { sw: { lat: 33.20, lng: 126.20 }, ne: { lat: 33.60, lng: 126.90 } }
  },
  { 
    name: "강릉", 
    lat: 37.7519, lng: 128.8761, 
    density: 15,
    bounds: { sw: { lat: 37.65, lng: 128.75 }, ne: { lat: 37.85, lng: 128.95 } }
  },
];

/**
 * 좌표를 주소로 변환하는 헬퍼
 */
const getAddressFromCoords = (lat: number, lng: number): Promise<string> => {
  return new Promise((resolve) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) {
      resolve("대한민국");
      return;
    }

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].address;
        const region = `${addr.region_1depth_name} ${addr.region_2depth_name} ${addr.region_3depth_name}`.trim();
        resolve(region || "대한민국");
      } else {
        resolve("대한민국");
      }
    });
  });
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  try {
    // 1. DB에서 기존 사용자 프로필 목록 가져오기
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .limit(50);
    
    if (profileError) {
      console.warn("Could not fetch profiles, using current user only:", profileError);
    }
    
    const userPool = (profiles && profiles.length > 0) 
      ? profiles 
      : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    const allInsertData: any[] = [];

    // 2. 각 대도시별로 영역 내 분산 데이터 생성
    for (const city of MAJOR_CITIES) {
      // 해당 도시 영역(Bounds) 기반으로 목업 데이터 생성
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      
      for (const p of mockPosts) {
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        // 각 지점의 실제 주소 가져오기 (병렬 처리를 위해 await 사용)
        const realAddress = await getAddressFromCoords(p.lat, p.lng);
        
        allInsertData.push({
          content: p.content,
          location_name: realAddress,
          latitude: p.lat,
          longitude: p.lng,
          image_url: p.image,
          youtube_url: p.youtubeUrl || null,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: p.likes,
          created_at: new Date(Date.now() - Math.random() * 24 * 3600000).toISOString()
        });
      }
    }

    // 3. 대량 인서트를 위해 청크 단위로 분할 삽입
    const chunkSize = 50;
    for (let i = 0; i < allInsertData.length; i += chunkSize) {
      const chunk = allInsertData.slice(i, i + chunkSize);
      const { error: insertError } = await supabase.from('posts').insert(chunk);
      
      if (insertError) {
        console.error(`Error inserting chunk at ${i}:`, insertError);
        throw new Error(`데이터 삽입 실패: ${insertError.message}`);
      }
    }

    return allInsertData.length;
  } catch (err: any) {
    console.error("Global seeding failed:", err);
    throw err;
  }
};