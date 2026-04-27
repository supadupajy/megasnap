import { supabase } from "@/integrations/supabase/client";

/**
 * 좋아요 토글 DB 쓰기
 * - 현재 isLiked 상태를 받아 INSERT 또는 DELETE 수행
 * - posts.likes는 트리거(on_like_change)가 자동 동기화
 * - 반환값: 성공 여부
 */
export const toggleLikeInDb = async (
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<boolean> => {
  try {
    if (currentlyLiked) {
      // 좋아요 취소: likes 테이블에서 삭제
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      // 좋아요: likes 테이블에 삽입 (중복 방지: upsert)
      const { error } = await supabase
        .from("likes")
        .upsert({ post_id: postId, user_id: userId }, { onConflict: "user_id,post_id" });
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("[like-utils] toggleLikeInDb error:", err);
    return false;
  }
};
