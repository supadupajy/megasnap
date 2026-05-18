import { supabase } from "@/integrations/supabase/client";
import { isPersistedPostId } from "@/utils/comments";

const AD_POST_PREFIX = "ad-map-marker-";

export const isAdPostId = (postId: string) => postId.startsWith(AD_POST_PREFIX);

export const fetchLikedPostIds = async (
  postIds: string[],
  userId?: string | null
): Promise<Set<string>> => {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  if (!userId || ids.length === 0) return new Set();

  const persistedIds = ids.filter(isPersistedPostId);
  const adIds = ids.filter(isAdPostId);
  const likedIds = new Set<string>();

  try {
    const [postLikesResult, adLikesResult] = await Promise.all([
      persistedIds.length > 0
        ? supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", persistedIds)
        : Promise.resolve({ data: [], error: null }),
      adIds.length > 0
        ? supabase
            .from("ad_likes")
            .select("ad_id")
            .eq("user_id", userId)
            .in("ad_id", adIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (postLikesResult.error) throw postLikesResult.error;
    if (adLikesResult.error) throw adLikesResult.error;

    (postLikesResult.data || []).forEach((row: any) => likedIds.add(String(row.post_id)));
    (adLikesResult.data || []).forEach((row: any) => likedIds.add(String(row.ad_id)));
  } catch (error) {
    console.error("[like-utils] fetchLikedPostIds error:", error);
  }

  return likedIds;
};

/**
 * 좋아요 토글 DB 쓰기
 * - 일반 포스트는 likes 테이블, 광고 포스트는 ad_likes 테이블에 저장
 * - 현재 isLiked 상태를 받아 INSERT 또는 DELETE 수행
 * - posts.likes는 DB 트리거(on_like_change)가 자동 동기화
 * - 반환값: 성공 여부
 */
export const toggleLikeInDb = async (
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<boolean> => {
  const isAd = isAdPostId(postId);
  if (!isAd && !isPersistedPostId(postId)) return false;

  try {
    if (isAd) {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("ad_likes")
          .delete()
          .eq("ad_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ad_likes")
          .insert({ ad_id: postId, user_id: userId });
        if (error && (error as any).code !== "23505") throw error;
      }
      return true;
    }

    if (currentlyLiked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("likes")
        .upsert(
          { post_id: postId, user_id: userId },
          { onConflict: "user_id,post_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("[like-utils] toggleLikeInDb error:", err);
    return false;
  }
};