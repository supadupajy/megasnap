"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts } from "@/lib/mock-data";

/**
 * 대한민국 주요 대도시 좌표 및 정밀 영역(Bounds) 목록
 */
const MAJOR_CITIES = [
  { 
    name: "서울", 
    lat: 37.5665, lng: 126.9780, 
    density: 1500,
    bounds: { sw: { lat: 37.4285, lng: 126.7644 }, ne: { lat: 37.7014, lng: 127.1838 } }
  },
  { 
    name: "부산", 
    lat: 35.1796, lng: 129.0756, 
    density: 500,
    bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } }
  },
  { 
    name: "인천", 
    lat: 37.4563, lng: 126.7052, 
    density: 400,
    bounds: { sw: { lat: 37.3689, lng: 126.5841 }, ne: { lat: 37.5856, lng: 126.7712 } }
  },
  { 
    name: "대구", 
    lat: 35.8714, lng: 128.6014, 
    density: 350,
    bounds: { sw: { lat: 35.7756, lng: 128.4523 }, ne: { lat: 35.9542, lng: 128.7234 } }
  },
  { 
    name: "대전", 
    lat: 36.3504, lng: 127.3845, 
    density: 300,
    bounds: { sw: { lat: 36.2654, lng: 127.2845 }, ne: { lat: 36.4856, lng: 127.4856 } }
  },
  { 
    name: "광주", 
    lat: 35.1595, lng: 126.8526, 
    density: 300,
    bounds: { sw: { lat: 35.0856, lng: 126.7542 }, ne: { lat: 35.2542, lng: 126.9542 } }
  },
  { 
    name: "울산", 
    lat: 35.5384, lng: 129.3114, 
    density: 250,
    bounds: { sw: { lat: 35.4542, lng: 129.1542 }, ne: { lat: 35.6542, lng: 129.4542 } }
  },
  { 
    name: "수원", 
    lat: 37.2636, lng: 127.0286, 
    density: 300,
    bounds: { sw: { lat: 37.2142, lng: 126.9542 }, ne: { lat: 37.3542, lng: 127.1542 } }
  },
  { 
    name: "제주", 
    lat: 33.4996, lng: 126.5312, 
    density: 400,
    bounds: { sw: { lat: 33.2142, lng: 126.2142 }, ne: { lat: 33.5542, lng: 126.9142 } }
  }
];

/**
 * 좌표를 실제 행정구역 주소로 변환
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
    // 1. 사용자 풀 준비
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(50);
    const userPool = (profiles && profiles.length > 0) 
      ? profiles 
      : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

    const allInsertData: any[] = [];

    // 2. 도시별 데이터 생성
    for (const city of MAJOR_CITIES) {
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      
      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const realAddress = await getAddressFromCoords(p.lat, p.lng);
        
        // 약 10%의 확률로 강제 인플루언서 좋아요 수 할당
        let finalLikes = p.likes;
        if (Math.random() < 0.1) {
          finalLikes = Math.floor(Math.random() * 45000) + 5000; // 5,000 ~ 50,000
        }

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
          likes: finalLikes,
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });
      }
    }

    // 3. Supabase 삽입 (청크 단위)
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