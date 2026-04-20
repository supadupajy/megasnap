"use client";

import { supabase } from "@/integrations/supabase/client";
import { 
  createMockPosts, 
  YOUTUBE_IDS_POOL, 
  UNSPLASH_IDS, 
  FOOD_UNSPLASH_IDS, 
  getUnsplashUrl,
  MAJOR_CITIES,
  REALISTIC_COMMENTS,
  AD_COMMENTS
} from "@/lib/mock-data";
import { getYoutubeThumbnail } from "@/lib/utils";

// 배열을 무작위로 섞는 헬퍼 함수
const shuffleArray = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

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

const getRandomLikesFlat = () => {
  const r = Math.random();
  if (r < 0.5) return Math.floor(Math.random() * 1001);
  if (r < 0.8) return Math.floor(Math.random() * 4001 + 1000);
  if (r < 0.9) return Math.floor(Math.random() * 5001 + 5000);
  return Math.floor(Math.random() * 10001 + 10000);
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 전역 데이터 생성 프로세스를 시작합니다...");
  
  try {
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];
    
    // 리소스 풀 셔플 및 카운터 초기화 (Round-robin 보장)
    const shuffledUnsplash = shuffleArray(UNSPLASH_IDS);
    const shuffledFood = shuffleArray(FOOD_UNSPLASH_IDS);
    const shuffledYoutube = shuffleArray(YOUTUBE_IDS_POOL);
    
    let unsplashCounter = 0;
    let foodCounter = 0;
    let youtubeCounter = 0;
    let globalIndex = 0;

    const allInsertData: any[] = [];

    for (const city of MAJOR_CITIES) {
      console.log(`📍 [Seeder] ${city.name} 지역 데이터 생성 중...`);
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      
      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        let realAddress = city.name;
        if (i % 50 === 0) realAddress = await getAddressFromCoords(p.lat, p.lng);
        
        const isAd = i % 20 === 0;
        const isYoutube = !isAd && (i % 2 === 0);
        
        let finalYoutubeUrl = null;
        let finalImage = "";
        
        const sig = globalIndex; // 캐시 방지용 시그니처

        if (isAd) {
          const foodId = shuffledFood[foodCounter % shuffledFood.length];
          finalImage = getUnsplashUrl(foodId, sig);
          foodCounter++;
        } else if (isYoutube) {
          const ytId = shuffledYoutube[youtubeCounter % shuffledYoutube.length];
          finalYoutubeUrl = `https://www.youtube.com/shorts/${ytId}`;
          finalImage = getYoutubeThumbnail(finalYoutubeUrl) || "";
          youtubeCounter++;
        } else {
          const unsplashId = shuffledUnsplash[unsplashCounter % shuffledUnsplash.length];
          finalImage = getUnsplashUrl(unsplashId, sig);
          unsplashCounter++;
        }

        const finalContent = isAd 
          ? AD_COMMENTS[globalIndex % AD_COMMENTS.length]
          : REALISTIC_COMMENTS[globalIndex % REALISTIC_COMMENTS.length];

        allInsertData.push({
          content: finalContent,
          location_name: realAddress,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: randomUser.nickname || "탐험가",
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: getRandomLikesFlat(),
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;
      }
    }

    console.log(`📤 [Seeder] 총 ${allInsertData.length}개 데이터를 DB에 저장합니다...`);
    const chunkSize = 50;
    for (let i = 0; i < allInsertData.length; i += chunkSize) {
      const chunk = allInsertData.slice(i, i + chunkSize);
      const { error } = await supabase.from('posts').insert(chunk);
      if (error) throw error;
    }

    console.log("✨ [Seeder] 모든 데이터가 성공적으로 저장되었습니다!");
    return allInsertData.length;
  } catch (err: any) { 
    console.error("❌ [Seeder] 오류 발생:", err); 
    throw err; 
  }
};

export const randomizeExistingLikes = async () => {
  try {
    const { data, error } = await supabase.rpc('randomize_all_likes');
    if (error) throw error;
    return data || 0;
  } catch (err) {
    console.error("❌ [Seeder] 좋아요 랜덤화 실패:", err);
    throw err;
  }
};