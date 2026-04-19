"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts } from "@/lib/mock-data";

/**
 * 대한민국 주요 대도시 좌표 목록
 */
const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 30 },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 20 },
  { name: "인천", lat: 37.4563, lng: 126.7052, density: 15 },
  { name: "대구", lat: 35.8714, lng: 128.6014, density: 12 },
  { name: "대전", lat: 36.3504, lng: 127.3845, density: 12 },
  { name: "광주", lat: 35.1595, lng: 126.8526, density: 12 },
  { name: "울산", lat: 35.5384, lng: 129.3114, density: 10 },
  { name: "수원", lat: 37.2636, lng: 127.0286, density: 12 },
  { name: "세종", lat: 36.4800, lng: 127.2890, density: 8 },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 15 },
  { name: "전주", lat: 35.8242, lng: 127.1480, density: 8 },
  { name: "강릉", lat: 37.7519, lng: 128.8761, density: 8 },
];

/**
 * 좌표를 주소로 변환하는 헬퍼 (도시별 1회 호출용)
 */
const getCityAddress = (lat: number, lng: number): Promise<string> => {
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
        const region = `${addr.region_1depth_name} ${addr.region_2depth_name}`.trim();
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

    // 2. 각 대도시별로 순차적으로 데이터 생성 (API 부하 방지)
    for (const city of MAJOR_CITIES) {
      // 도시별 대표 주소 한 번만 가져오기
      const cityBaseAddress = await getCityAddress(city.lat, city.lng);
      
      // 해당 도시 좌표 기반으로 목업 데이터 생성
      const mockPosts = createMockPosts(city.lat, city.lng, city.density);
      
      for (const p of mockPosts) {
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        allInsertData.push({
          content: p.content,
          location_name: cityBaseAddress, // 도시 공통 주소 사용 (속도 향상)
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