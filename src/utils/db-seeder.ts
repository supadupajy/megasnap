"use client";

import { supabase } from "@/integrations/supabase/client";
import {
  createMockPosts,
  getDiverseUnsplashUrl,
  getVerifiedYoutubeUrlByIndex,
  initializeYoutubePool,
} from "@/lib/mock-data";
import { getYoutubeThumbnail } from "@/lib/utils";
import { OFFLINE_REGION_CITIES, resolveOfflineLocationName, shouldEnrichLocationName } from "./offline-location";
import { sanitizeYoutubeMedia } from "./youtube-utils";

const REALISTIC_COMMENTS = [
  '여기 분위기 진짜 대박이에요! 꼭 가보세요. 😍',
  '오늘 날씨랑 찰떡인 장소 발견! 기분 전환 제대로 되네요. ✨',
  '숨은 명소 발견! 나만 알고 싶지만 공유합니다. 📍',
  '주말 나들이로 딱 좋은 곳인 것 같아요. 강력 추천!',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '생각보다 사람이 많지 않아서 여유롭게 즐기다 왔어요.',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!',
  '가족들이랑 오기에도 참 좋은 곳 같아요. 👨‍👩‍👧‍👦',
  '분위기도 좋고 인테리어도 취향저격... 재방문 의사 200%! ',
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

const CATEGORIES = ['food', 'accident', 'place', 'animal'] as const;

/**
 * Generates a truly random like count between 0 and 10000 with flat distribution.
 */
const getRandomLikesFlat = () => {
  return Math.floor(Math.random() * 10001);
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 전역 데이터 생성 프로세스를 시작합니다...");

  try {
    await initializeYoutubePool();

    console.log("👥 [Seeder] 사용자 프로필 목록을 가져오는 중...");
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    
    // [FIX] userPool에서 dummy nickname 필터링 및 '탐험가' 강제 할당
    const filteredProfiles = profiles?.map(p => ({
      ...p,
      nickname: (p.nickname?.toLowerCase().startsWith('user') || p.nickname?.toLowerCase().startsWith('explorer_')) 
        ? '탐험가' 
        : p.nickname || '탐험가'
    })) || [];

    const userPool = (filteredProfiles.length > 0)
      ? filteredProfiles
      : [{ id: currentUserId, nickname: '탐험가', avatar_url: currentAvatar }];
    
    console.log(`✅ [Seeder] ${userPool.length}명의 사용자 풀이 준비되었습니다.`);

    const allInsertData: any[] = [];
    let globalIndex = 0;

    for (const city of OFFLINE_REGION_CITIES.filter((region) => region.density)) {
      console.log(`📍 [Seeder] ${city.shortName} 지역 데이터 생성 중... (목표: ${city.density}개)`);
      const mockPosts = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);

      for (let i = 0; i < mockPosts.length; i++) {
        const p = mockPosts[i];
        const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
        const detailedLocation = resolveOfflineLocationName(p.lat, p.lng);
        const finalLikes = getRandomLikesFlat();
        const isAd = p.isAd;
        const category = CATEGORIES[globalIndex % CATEGORIES.length]; // 카테고리 할당

        let finalYoutubeUrl = null;
        let finalImage = "";

        if (isAd) {
          finalImage = getDiverseUnsplashUrl(`${city.shortName}:${randomUser.id}:${globalIndex}`, 'food', i);
        } else if (globalIndex % 2 === 0) {
          const candidateUrl = getVerifiedYoutubeUrlByIndex(globalIndex);
          finalYoutubeUrl = candidateUrl;
          // [FIX] 유튜브 포스팅 생성 시 썸네일을 우선적으로 image_url에 저장
          const ytThumbnail = getYoutubeThumbnail(candidateUrl);
          finalImage = ytThumbnail || getDiverseUnsplashUrl(`${city.shortName}:${randomUser.id}:${globalIndex}`, category, i);
          console.log(`[Seeder] YouTube Post Created - URL: ${candidateUrl}, Thumbnail: ${finalImage}`);
        } else {
          finalImage = getDiverseUnsplashUrl(`${city.shortName}:${randomUser.id}:${globalIndex}`, category, i); // 카테고리 적용
        }

        const finalContent = isAd
          ? AD_COMMENTS[globalIndex % AD_COMMENTS.length]
          : REALISTIC_COMMENTS[globalIndex % REALISTIC_COMMENTS.length];

        allInsertData.push({
          content: finalContent,
          location_name: detailedLocation,
          latitude: p.lat,
          longitude: p.lng,
          image_url: finalImage,
          youtube_url: finalYoutubeUrl,
          user_id: randomUser.id,
          user_name: '탐험가', // [FIX] 생성 시 모든 user_name을 '탐험가'로 고정
          user_avatar: randomUser.avatar_url || `https://i.pravatar.cc/150?u=${randomUser.id}`,
          likes: finalLikes,
          category: category, // 카테고리 추가
          created_at: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString(),
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
    // We use a custom query to update all likes with a random distribution directly via SQL
    // This is more efficient and ensures the logic is applied at the source.
    // The SQL logic matches our JS distribution:
    const sql = `
      UPDATE posts 
      SET likes = CASE 
        WHEN random() < 0.70 THEN floor(random() * 50)
        WHEN random() < 0.90 THEN floor(random() * 150 + 50)
        WHEN random() < 0.97 THEN floor(random() * 300 + 200)
        WHEN random() < 0.995 THEN floor(random() * 500 + 500)
        ELSE floor(random() * 5000 + 1000)
      END
      WHERE content NOT LIKE '[AD]%';
    `;
    
    // Instead of calling the RPC which might have outdated logic, we perform a batch update if possible
    // or call a safer RPC. Assuming we want to stick to the RPC but update its logic if we could.
    // Since I can't update Postgres RPCs directly, I will perform it in batches via JS for now
    // to ensure the NEW logic is applied correctly as per user request.

    const { data: allPosts, error: fetchError } = await supabase
      .from('posts')
      .select('id')
      .not('content', 'ilike', '[AD]%');

    if (fetchError) throw fetchError;
    if (!allPosts) return 0;

    console.log(`📦 [Seeder] ${allPosts.length}개의 포스팅 수치를 조절합니다...`);

    const chunkSize = 100;
    for (let i = 0; i < allPosts.length; i += chunkSize) {
      const chunk = allPosts.slice(i, i + chunkSize);
      
      for (const p of chunk) {
        const { error: updateError } = await supabase
          .from('posts')
          .update({ likes: getRandomLikesFlat() })
          .eq('id', p.id);
        
        if (updateError) {
          console.warn(`⚠️ [Seeder] Could not update post ${p.id}:`, updateError.message);
        }
      }
      
      if (i % 100 === 0) console.log(`   - 진행 상황: ${i}/${allPosts.length} 완료...`);
    }

    return allPosts.length;
  } catch (err) {
    console.error("❌ [Seeder] 좋아요 랜덤화 실패:", err);
    throw err;
  }
};

export const enrichExistingPostLocations = async () => {
  console.log("🗺️ [Seeder] 기존 포스팅 지역명 보정 작업을 시작합니다...");

  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, location_name, latitude, longitude');

    if (error) throw error;
    if (!posts || posts.length === 0) {
      console.log("ℹ️ [Seeder] 보정할 포스팅이 없습니다.");
      return 0;
    }

    const targets = posts.filter((post) => shouldEnrichLocationName(post.location_name));
    if (targets.length === 0) {
      console.log("ℹ️ [Seeder] 이미 상세 지역명이 저장되어 있습니다.");
      return 0;
    }

    let updatedCount = 0;

    for (const post of targets) {
      const nextLocation = resolveOfflineLocationName(post.latitude, post.longitude);
      if (nextLocation === post.location_name) continue;

      const { error: updateError } = await supabase
        .from('posts')
        .update({ location_name: nextLocation })
        .eq('id', post.id);

      if (updateError) throw updateError;
      updatedCount += 1;
    }

    console.log(`✅ [Seeder] ${updatedCount}개 포스팅의 지역명을 상세 주소 형식으로 보정했습니다.`);
    return updatedCount;
  } catch (err) {
    console.error("❌ [Seeder] 지역명 보정 실패:", err);
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

/**
 * [SPECIAL] 강남 지역(강남역, 신사, 압구정 등)에 골고루 20개의 포스팅을 생성합니다.
 */
export const seedGangnamSpecialPosts = async (currentUserId: string) => {
  console.log("📍 [Seeder] 강남 지역 특별 데이터 생성을 시작합니다...");

  try {
    await initializeYoutubePool();
    const { data: profiles } = await supabase.from('profiles').select('id').limit(10);
    const userPool = (profiles && profiles.length > 0) ? profiles : [{ id: currentUserId }];

    // 강남 주요 거점 좌표
    const gangnamSpots = [
      { name: "강남역", lat: 37.4979, lng: 127.0276 },
      { name: "신논현역", lat: 37.5045, lng: 127.0255 },
      { name: "논현역", lat: 37.5111, lng: 127.0214 },
      { name: "신사역", lat: 37.5163, lng: 127.0201 },
      { name: "압구정역", lat: 37.5271, lng: 127.0285 },
      { name: "학동역", lat: 37.5143, lng: 127.0317 },
      { name: "언주역", lat: 37.5073, lng: 127.0339 },
      { name: "역삼역", lat: 37.5006, lng: 127.0365 },
      { name: "선릉역", lat: 37.5045, lng: 127.0482 },
      { name: "삼성역", lat: 37.5088, lng: 127.0631 },
      { name: "청담역", lat: 37.5191, lng: 127.0519 },
      { name: "강남구청역", lat: 37.5172, lng: 127.0413 },
      { name: "선정릉역", lat: 37.5110, lng: 127.0436 },
      { name: "한티역", lat: 37.4962, lng: 127.0529 },
      { name: "도곡역", lat: 37.4909, lng: 127.0555 },
      { name: "대치역", lat: 37.4945, lng: 127.0588 },
      { name: "매봉역", lat: 37.4868, lng: 127.0436 },
      { name: "양재역", lat: 37.4841, lng: 127.0346 },
      { name: "교대역", lat: 37.4934, lng: 127.0141 },
      { name: "서초역", lat: 37.4918, lng: 127.0076 }
    ];

    const insertData = gangnamSpots.map((spot, i) => {
      const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
      const isYoutube = i % 2 === 0;
      const category = CATEGORIES[i % CATEGORIES.length];
      
      let finalYoutubeUrl = null;
      let finalImage = "";

      if (isYoutube) {
        finalYoutubeUrl = getVerifiedYoutubeUrlByIndex(i);
        finalImage = getYoutubeThumbnail(finalYoutubeUrl) || getDiverseUnsplashUrl(`gangnam:${i}`, category);
      } else {
        finalImage = getDiverseUnsplashUrl(`gangnam:${i}`, category);
      }

      return {
        content: REALISTIC_COMMENTS[i % REALISTIC_COMMENTS.length],
        location_name: `서울시 강남구 ${spot.name} 인근`,
        latitude: spot.lat + (Math.random() - 0.5) * 0.002, // 미세한 랜덤 오차
        longitude: spot.lng + (Math.random() - 0.5) * 0.002,
        image_url: finalImage,
        youtube_url: finalYoutubeUrl,
        user_id: randomUser.id,
        user_name: "탐험가",
        likes: Math.floor(Math.random() * 8000) + 500,
        category: category,
        created_at: new Date().toISOString()
      };
    });

    const { error } = await supabase.from('posts').insert(insertData);
    if (error) throw error;

    console.log("✨ [Seeder] 강남 특별 포스팅 20개가 성공적으로 생성되었습니다.");
    return insertData.length;
  } catch (err) {
    console.error("❌ [Seeder] 강남 데이터 생성 실패:", err);
    throw err;
  }
};