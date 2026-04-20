"use client";

import { supabase } from "@/integrations/supabase/client";
import {
  createMockPosts,
  FOOD_UNSPLASH_IDS,
  getUnsplashUrl,
  getVerifiedYoutubeUrlByIndex,
  initializeYoutubePool,
  UNSPLASH_IDS,
} from "@/lib/mock-data";
import { getYoutubeThumbnail } from "@/lib/utils";
import { sanitizeYoutubeMedia } from "./youtube-utils";

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
    name: "인천", 
    lat: 37.4563, lng: 126.7052, 
    density: 600,
    bounds: { sw: { lat: 37.3689, lng: 126.5841 }, ne: { lat: 37.5856, lng: 126.7712 } }
  },
  { 
    name: "대구", 
    lat: 35.8714, lng: 128.6014, 
    density: 500,
    bounds: { sw: { lat: 35.7756, lng: 128.4523 }, ne: { lat: 35.9542, lng: 128.7234 } }
  },
  { 
    name: "대전", 
    lat: 36.3504, lng: 127.3845, 
    density: 400,
    bounds: { sw: { lat: 36.2654, lng: 127.2845 }, ne: { lat: 36.4856, lng: 127.4856 } }
  },
  { 
    name: "광주", 
    lat: 35.1595, lng: 126.8526, 
    density: 400,
    bounds: { sw: { lat: 35.0856, lng: 126.7542 }, ne: { lat: 35.2542, lng: 126.9542 } }
  },
  { 
    name: "울산", 
    lat: 35.5384, lng: 129.3114, 
    density: 300,
    bounds: { sw: { lat: 35.4542, lng: 129.1542 }, ne: { lat: 35.6542, lng: 129.4542 } }
  },
  { 
    name: "수원", 
    lat: 37.2636, lng: 127.0286, 
    density: 400,
    bounds: { sw: { lat: 37.2142, lng: 126.9542 }, ne: { lat: 37.3542, lng: 127.1542 } }
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
  '주말 나들이로 딱 좋은 곳인 것 같아요. 강력 추천!',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '생각보다 사람이 많지 않아서 여유롭게 즐기다 왔어요.',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!',
  '가족들이랑 오기에도 참 좋은 곳 같아요. 👨‍👩‍👧‍👦',
  '분위기도 좋고 인테리어도 취향저격... 재방문 의사 200%!',
  '지나가다 우연히 들렀는데 너무 만족스러워서 기록 남겨요.',
  '친구들이랑 수다 떨기 딱 좋은 장소네요. 시간 가는 줄 몰랐어요.',
  '오랜만에 힐링하고 갑니다. 공기가 너무 맑고 좋네요.',
  '여기 진짜 뷰 맛집이네요. 눈이 호강하는 기분입니다. 🌊',
  '디테일 하나하나 신경 쓴 게 느껴지는 멋진 공간이에요.',
  '혼자 와서 조용히 생각 정리하기에도 너무 좋을 것 같아요.'
];

const AD_COMMENTS = [
  '[AD] 지금 바로 특별한 혜택을 만나보세요! 놓치면 후회합니다.',
  '[AD] 당신만을 위한 프리미엄 서비스를 경험할 시간입니다.',
  '[AD] 인기 폭발! 지금 가장 핫한 아이템을 확인해보세요.',
  '[AD] 오늘만 진행되는 특별 프로모션, 지금 확인하세요!',
  '[AD] 최고의 선택, 당신의 일상을 더 특별하게 만들어드립니다.'
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

const getRandomLikesFlat = () => {
  const r = Math.random();
  if (r < 0.5) return Math.floor(Math.random() * 1001); // 0~1000 (50%)
  if (r < 0.8) return Math.floor(Math.random() * 4001 + 1000); // 1000~5000 (30%)
  if (r < 0.9) return Math.floor(Math.random() * 5001 + 5000); // 5000~10000 (10%)
  return Math.floor(Math.random() * 10001 + 10000); // 10000~20000 (10%)
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 전역 데이터 생성 프로세스를 시작합니다...");
  
  try {
    await initializeYoutubePool();

    console.log("👥 [Seeder] 사용자 프로필 목록을 가져오는 중...");
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];
    console.log(`✅ [Seeder] ${userPool.length}명의 사용자 풀이 준비되었습니다.`);

    const allInsertData: any[] = [];
    let globalIndex = 0;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 [Seeder] ${city.name} 지역 데이터 생성 중... (목표: ${city.density}개)`);
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      
      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        
        // 주소 변환은 속도를 위해 50개마다 한 번씩만 실제 호출하고 나머지는 도시 이름으로 대체 (API 제한 방지)
        let realAddress = city.name;
        if (i % 50 === 0) {
          realAddress = await getAddressFromCoords(p.lat, p.lng);
        }
        
        const finalLikes = getRandomLikesFlat();
        const isAd = p.isAd;
        
        let finalYoutubeUrl = null;
        let finalImage = "";
        
        if (isAd) {
          finalImage = getUnsplashUrl(FOOD_UNSPLASH_IDS[globalIndex % FOOD_UNSPLASH_IDS.length]);
        } else {
          if (globalIndex % 2 === 0) {
            const candidateUrl = getVerifiedYoutubeUrlByIndex(globalIndex);
            finalYoutubeUrl = candidateUrl;
            finalImage = getYoutubeThumbnail(candidateUrl) || getUnsplashUrl(UNSPLASH_IDS[globalIndex % UNSPLASH_IDS.length]);
          } else {
            finalImage = getUnsplashUrl(UNSPLASH_IDS[globalIndex % UNSPLASH_IDS.length]);
          }
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
          likes: finalLikes,
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString()
        });

        globalIndex++;
        
        if (globalIndex % 500 === 0) {
          console.log(`   - 진행 상황: ${globalIndex}개 생성 완료...`);
        }
      }
    }

    console.log(`📦 [Seeder] 총 ${allInsertData.length}개의 데이터 생성이 완료되었습니다.`);
    console.log("📤 [Seeder] 데이터베이스에 저장을 시작합니다 (Chunk 단위)...");

    const chunkSize = 50;
    const totalChunks = Math.ceil(allInsertData.length / chunkSize);
    
    for (let i = 0; i < allInsertData.length; i += chunkSize) {
      const chunk = allInsertData.slice(i, i + chunkSize);
      const currentChunkNum = Math.floor(i / chunkSize) + 1;
      
      const { error } = await supabase.from('posts').insert(chunk);
      if (error) throw error;
      
      if (currentChunkNum % 10 === 0 || currentChunkNum === totalChunks) {
        console.log(`   - DB 저장 중: ${currentChunkNum}/${totalChunks} 청크 완료...`);
      }
    }

    console.log("✨ [Seeder] 모든 데이터가 성공적으로 저장되었습니다!");
    return allInsertData.length;
  } catch (err: any) { 
    console.error("❌ [Seeder] 데이터 생성 중 오류 발생:", err); 
    throw err; 
  }
};

export const randomizeExistingLikes = async () => {
  console.log("🎲 [Seeder] 전체 좋아요 수치 랜덤화 작업을 시작합니다...");
  try {
    const { data, error } = await supabase.rpc('randomize_all_likes');
    if (error) throw error;
    console.log(`✅ [Seeder] ${data}개 포스팅의 수치가 성공적으로 변경되었습니다.`);
    return data || 0;
  } catch (err) {
    console.error("❌ [Seeder] 좋아요 랜덤화 실패:", err);
    throw err;
  }
};

export const cleanupInvalidYoutubePosts = async () => {
  console.log("🧹 [Seeder] 재생 불가 유튜브 포스팅 정리를 시작합니다...");

  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, youtube_url, image_url')
      .not('youtube_url', 'is', null);

    if (error) throw error;
    if (!posts || posts.length === 0) {
      console.log("ℹ️ [Seeder] 정리할 유튜브 포스팅이 없습니다.");
      return 0;
    }

    let cleanedCount = 0;
    const chunkSize = 20;

    for (let i = 0; i < posts.length; i += chunkSize) {
      const chunk = posts.slice(i, i + chunkSize);
      const sanitizedChunk = await Promise.all(chunk.map((post) => sanitizeYoutubeMedia(post)));

      const updateTargets = sanitizedChunk.filter(
        (post, index) =>
          post.youtube_url !== chunk[index].youtube_url || post.image_url !== chunk[index].image_url,
      );

      for (const post of updateTargets) {
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            youtube_url: post.youtube_url,
            image_url: post.image_url,
          })
          .eq('id', post.id);

        if (updateError) throw updateError;
        cleanedCount += 1;
      }

      console.log(`🧹 [Seeder] 유튜브 검수 진행: ${Math.min(i + chunk.length, posts.length)}/${posts.length}`);
    }

    console.log(`✅ [Seeder] 재생 불가 유튜브 포스팅 ${cleanedCount}개를 정리했습니다.`);
    return cleanedCount;
  } catch (err) {
    console.error("❌ [Seeder] 유튜브 포스팅 정리 실패:", err);
    throw err;
  }
};