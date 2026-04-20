"use client";

import { supabase } from "@/integrations/supabase/client";
import {
  AD_COMMENTS,
  FOOD_IMAGES,
  MAJOR_CITIES,
  REALISTIC_COMMENTS,
  YOUTUBE_IDS_50,
  createMockPosts,
  getUnsplashUrl,
} from "@/lib/mock-data";

export const seedGlobalPosts = async (
  currentUserId: string,
  currentNickname: string,
  currentAvatar: string,
) => {
  const confirmClear = confirm("서울 중심이 아닌 '전국 8도 거점' 대도시 위주로 데이터를 생성하시겠습니까?");
  if (!confirmClear) return 0;

  try {
    console.log("🧹 전국 데이터 초기화 중...");
    const { error: deleteError } = await supabase.from("posts").delete().not("id", "is", null);
    if (deleteError) throw deleteError;

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .neq("id", currentUserId)
      .limit(100);

    if (profilesError) throw profilesError;

    const otherUsers = profiles || [];
    let globalCount = 0;
    let myPostCounter = 0;
    const maxMyPosts = 80;

    for (const city of MAJOR_CITIES) {
      console.log(`📍 ${city.name} 지역 생성 중 (${city.density}개)...`);
      const mockPoints = createMockPosts(city.lat, city.lng, city.density, undefined, city.bounds);
      let batch: Array<Record<string, unknown>> = [];

      for (let i = 0; i < mockPoints.length; i++) {
        const point = mockPoints[i];
        const uniqueSeed = Date.now() + globalCount + i;
        const isAd = i % 30 === 0;

        let postUser: { id: string; name: string; avatar: string };
        if (isAd) {
          postUser = {
            id: currentUserId,
            name: "공식 파트너",
            avatar: "https://i.pravatar.cc/150?u=ad",
          };
        } else if (myPostCounter < maxMyPosts && Math.random() < 0.015) {
          postUser = {
            id: currentUserId,
            name: currentNickname,
            avatar: currentAvatar,
          };
          myPostCounter += 1;
        } else {
          const fallbackUser = otherUsers[uniqueSeed % otherUsers.length];
          postUser = {
            id: fallbackUser?.id || currentUserId,
            name: fallbackUser?.nickname || "탐험가",
            avatar: `https://i.pravatar.cc/150?u=${fallbackUser?.id || currentUserId}`,
          };
        }

        const isYoutube = !isAd && i % 2 === 0;
        const youtubeId = YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length];
        const imageUrl = isAd
          ? FOOD_IMAGES[globalCount % FOOD_IMAGES.length]
          : isYoutube
            ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
            : getUnsplashUrl(uniqueSeed);

        batch.push({
          content: isAd
            ? AD_COMMENTS[globalCount % AD_COMMENTS.length]
            : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
          location_name: city.name,
          latitude: point.lat,
          longitude: point.lng,
          image_url: imageUrl,
          youtube_url: isYoutube ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
          user_id: postUser.id,
          user_name: postUser.name,
          user_avatar: postUser.avatar,
          likes: Math.floor(Math.random() * 20000),
          category: point.category || "none",
          created_at: new Date(Date.now() - Math.random() * 120 * 3600000).toISOString(),
        });

        globalCount += 1;

        if (batch.length >= 100) {
          const { error } = await supabase.from("posts").insert(batch);
          if (error) throw error;
          batch = [];
        }
      }

      if (batch.length > 0) {
        const { error } = await supabase.from("posts").insert(batch);
        if (error) throw error;
      }
    }

    return globalCount;
  } catch (err) {
    console.error("❌ 시딩 실패:", err);
    throw err;
  }
};

export const randomizeExistingLikes = async () => {
  try {
    const { data: posts, error: fetchError } = await supabase.from("posts").select("id");
    if (fetchError) throw fetchError;
    if (!posts || posts.length === 0) return 0;

    const chunkSize = 20;
    for (let i = 0; i < posts.length; i += chunkSize) {
      const chunk = posts.slice(i, i + chunkSize);
      const updatePromises = chunk.map((post) =>
        supabase
          .from("posts")
          .update({ likes: Math.floor(Math.random() * 25000) })
          .eq("id", post.id),
      );
      await Promise.all(updatePromises);
    }

    return posts.length;
  } catch (err) {
    console.error("Randomizing likes failed:", err);
    throw err;
  }
};
