"use client";

import { supabase } from "@/integrations/supabase/client";
import { createMockPosts } from "@/lib/mock-data";

/**
 * 좌표를 주소로 변환하는 헬퍼 (카카오 API 활용)
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

export const seedGlobalPosts = async (userId: string, nickname: string, avatar: string) => {
  // 대한민국 전역 범위 (제주도 포함)
  const bounds = {
    minLat: 33.2, // 서귀포 남단
    maxLat: 38.3, // 고성 북단
    minLng: 126.1, // 제주 서단
    maxLng: 129.4  // 포항/울산 동단
  };

  // 레벨 6 뷰포트 크기를 고려한 그리드 간격 (약 0.18도)
  const step = 0.18; 
  const postsPerGrid = 1; // 그리드당 1~2개로 밀도 조절
  
  const allInsertData: any[] = [];
  const totalSteps = Math.ceil((bounds.maxLat - bounds.minLat) / step) * Math.ceil((bounds.maxLng - bounds.minLng) / step);
  let processed = 0;

  console.log(`Starting seed for approximately ${totalSteps} regions...`);

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += step) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += step) {
      // 해당 지점 주변으로 포스팅 생성
      const mockPosts = createMockPosts(lat, lng, postsPerGrid);
      
      for (const p of mockPosts) {
        // 실제 주소 가져오기 (API 부하를 줄이기 위해 일부는 스킵하거나 순차 처리)
        const realAddress = await getAddressFromCoords(p.lat, p.lng);
        
        allInsertData.push({
          content: p.content,
          location_name: realAddress,
          latitude: p.lat,
          longitude: p.lng,
          image_url: p.image,
          user_id: userId,
          user_name: nickname,
          user_avatar: avatar,
          likes: Math.floor(Math.random() * 2000) + 10,
          // 최근 24시간 이내로 설정하여 필터에 걸리지 않게 함
          created_at: new Date(Date.now() - Math.random() * 24 * 3600000).toISOString()
        });
      }
      processed++;
    }
  }

  // 대량 인서트를 위해 청크 단위로 분할 (Supabase 제한 고려)
  const chunkSize = 100; // 주소 변환 대기 시간을 고려해 청크 크기 조절
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