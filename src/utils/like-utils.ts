import { supabase } from "@/integrations/supabase/client";

export const fetchLikedPostIds = async (
  postIds: string[],
  userId?: string | null
): Promise<Set<string>> => {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  if (!userId || ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", ids);

  if (error) {
    console.error("[like-utils] fetchLikedPostIds error:", error);
    return new Set();
  }

  return new Set((data || []).map((row: any) => String(row.post_id)));
};

/**
 * 좋아요 토글 DB 쓰기
 * - 현재 isLiked 상태를 받아 INSERT 또는 DELETE 수행
 * - posts.likes는 DB 트리거(on_like_change)가 자동 동기화
 * - 반환값: 성공 여부
 */
export const toggleLikeInDb = async (
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<boolean> => {
  try {
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