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

const CATEGORIES = ['food', 'accident', 'place', 'animal'] as const;

/**
 * Generates a truly random like count with a realistic distribution.
 * 70% of posts: 0-49 likes (None/Normal)
 * 20% of posts: 50-199 likes (Popular)
 * 7% of posts: 200-499 likes (Silver)
 * 2.5% of posts: 500-999 likes (Gold)
 * 0.5% of posts: 1000+ likes (Diamond)
 */
const getRandomLikesFlat = () => {
  const r = Math.random();
  // Normal/None (0-49) - 70%
  if (r < 0.70) return Math.floor(Math.random() * 50);
  // Popular (50-199) - 20%
  if (r < 0.90) return Math.floor(Math.random() * 150 + 50);
  // Silver (200-499) - 7%
  if (r < 0.97) return Math.floor(Math.random() * 300 + 200);
  // Gold (500-999) - 2.5%
  if (r < 0.995) return Math.floor(Math.random() * 500 + 500);
  // Diamond (1000+) - 0.5%
  return Math.floor(Math.random() * 5000 + 1000);
};

export const seedGlobalPosts = async (currentUserId: string, currentNickname: string, currentAvatar: string) => {
  console.log("🚀 [Seeder] 전역 데이터 생성 프로세스를 시작합니다...");

  try {
    await initializeYoutubePool();

    console.log("👥 [Seeder] 사용자 프로필 목록을 가져오는 중...");
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, avatar_url').limit(100);
    const userPool = (profiles && profiles.length > 0)
      ? profiles
      : [{ id: currentUserId, nickname: currentNickname, avatar_url: currentAvatar }];
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
          finalImage = getYoutubeThumbnail(candidateUrl) || getDiverseUnsplashUrl(`${city.shortName}:${randomUser.id}:${globalIndex}`, category, i); // 카테고리 적용
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
          user_name: randomUser.nickname || "탐험가",
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
      
      // Update each post one by one to respect RLS or avoid upsert issues
      // Since upsert might fail if the user doesn't own all posts, 
      // we need to be careful. However, for admin-like tasks, 
      // we'll try to update the likes specifically.
      
      for (const p of chunk) {
        const { error: updateError } = await supabase
          .from('posts')
          .update({ likes: getRandomLikesFlat() })
          .eq('id', p.id);
        
        // If we hit an RLS error, we log it and continue 
        // (some posts might be protected or owned by others)
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