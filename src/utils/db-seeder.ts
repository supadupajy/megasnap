"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts } from "@/lib/mock-data";

/**
 * 대한민국 주요 대도시 좌표 목록
 */
const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 40 },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 25 },
  { name: "인천", lat: 37.4563, lng: 126.7052, density: 20 },
  { name: "대구", lat: 35.8714, lng: 128.6014, density: 15 },
  { name: "대전", lat: 36.3504, lng: 127.3845, density: 15 },
  { name: "광주", lat: 35.1595, lng: 126.8526, density: 15 },
  { name: "울산", lat: 35.5384, lng: 129.3114, density: 12 },
  { name: "수원", lat: 37.2636, lng: 127.0286, density: 15 },
  { name: "세종", lat: 36.4800, lng: 127.2890, density: 10 },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 20 },
  { name: "전주", lat: 35.8242, lng: 127.1480, density: 10 },
  { name: "강릉", lat: 37.7519, lng: 128.8761, density: 10 },
];

/**
 * 좌표를 주소로 변환하는 헬퍼
 */
const getAddressFromCoords = (lat: number, lng: number): Promise<string> => {
  return new Promise((resolve) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) {
      resolve("대한민국 어딘가");
      return;
    }

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].address;
        const region = `${addr.region_1depth_name} ${addr.region_2depth_name} ${addr.region_3depth_name}`.trim();
        resolve(region || "대한민국 어딘가");
      } else {
        resolve("대한민국 어딘가");
      }
    });
  });
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  // 1. DB에서 기존 사용자 프로필 목록 가져오기
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url');
  
  if (profileError) throw profileError;
  
  // 프로필이 없으면 현재 사용자만 사용
  const userPool = (profiles && profiles.length > 0) 
    ? profiles 
    : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];

  const allInsertData: any[] = [];

  console.log(`Starting seed for ${MAJOR_CITIES.length} major cities...`);

  // 2. 각 대도시별로 포스팅 생성
  for (const city of MAJOR_CITIES) {
    // 도시별 밀도(density)만큼 포스팅 생성
    const mockPosts = createMockPosts(city.lat, city.lng, city.density);
    
    for (const p of mockPosts) {
      // 랜덤 사용자 할당
      const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
      const realAddress = await getAddressFromCoords(p.lat, p.lng);
      
      allInsertData.push({
        content: p.content,
        location_name: realAddress,
        latitude: p.lat,
        longitude: p.lng,
        image_url: p.image,
        youtube_url: p.youtubeUrl, // 유튜브 URL 추가
        user_id: randomUser.id,
        user_name: randomUser.nickname || "탐험가",
        user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
        likes: p.likes, // mock-data에서 생성된 확률 기반 좋아요 수 사용
        created_at: new Date(Date.now() - Math.random() * 24 * 3600000).toISOString()
      });
    }
  }

  // 3. 대량 인서트를 위해 청크 단위로 분할
  const chunkSize = 100;
  for (let i = 0; i < allInsertData.length; i += chunkSize) {
    const chunk = allInsertData.slice(i, i + chunkSize);
    const { error } = await supabase.from('posts').insert(chunk);
    if (error) {
      console.error(`Error seeding chunk ${i}:`, error);
      throw error;
    }
  }

  return allInsertData.length;
};