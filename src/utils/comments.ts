import { supabase } from '@/integrations/supabase/client';
import { Comment } from '@/types';

export const COMMENT_MAX_LENGTH = 100;

export type CommentInsertInput = {
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isPersistedPostId = (postId: string) => UUID_REGEX.test(postId);

export const mapCommentRowToComment = (row: {
  id?: string | null;
  user_id?: string | null;
  user_name: string | null;
  content: string;
  created_at?: string | null;
}, extras?: { likesCount?: number; isLiked?: boolean }): Comment => ({
  id: row.id || undefined,
  userId: row.user_id || undefined,
  user: row.user_name || '사용자',
  text: row.content,
  createdAt: row.created_at ? new Date(row.created_at) : undefined,
  likesCount: extras?.likesCount ?? 0,
  isLiked: extras?.isLiked ?? false,
});

export const fetchCommentsByPostId = async (postId: string): Promise<Comment[]> => {
  if (!isPersistedPostId(postId)) return [];

  const { data, error } = await supabase
    .from('comments')
    .select('id, user_id, user_name, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const commentIds = rows.map(r => r.id).filter((id): id is string => !!id);

  // 댓글 작성자들의 현재 닉네임을 profiles에서 조회 (DB에 저장된 user_name이 과거 값이거나
  // 이메일 prefix로 잘못 저장된 경우에도 항상 최신 nickname을 표시하기 위함)
  const userIds = Array.from(
    new Set(rows.map(r => r.user_id).filter((id): id is string => !!id))
  );
  const nicknameMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', userIds);

    (profileRows || []).forEach((row: { id: string; nickname: string | null }) => {
      if (row.nickname && row.nickname.trim()) {
        nicknameMap.set(row.id, row.nickname);
      }
    });
  }

  // 댓글별 좋아요 개수와 현재 사용자 좋아요 여부를 조회
  const likesCountMap = new Map<string, number>();
  const likedByMeSet = new Set<string>();

  if (commentIds.length > 0) {
    const { data: likeRows } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;

    (likeRows || []).forEach((row: { comment_id: string; user_id: string }) => {
      likesCountMap.set(row.comment_id, (likesCountMap.get(row.comment_id) || 0) + 1);
      if (currentUserId && row.user_id === currentUserId) {
        likedByMeSet.add(row.comment_id);
      }
    });
  }

  return rows.map(row => {
    const latestNickname = row.user_id ? nicknameMap.get(row.user_id) : undefined;
    return mapCommentRowToComment(
      { ...row, user_name: latestNickname || row.user_name },
      {
        likesCount: row.id ? likesCountMap.get(row.id) || 0 : 0,
        isLiked: row.id ? likedByMeSet.has(row.id) : false,
      },
    );
  });
};

export const insertComment = async ({
  postId,
  userId,
  userName,
  userAvatar,
  content,
}: CommentInsertInput): Promise<Comment> => {
  if (!isPersistedPostId(postId)) {
    throw new Error('저장 가능한 포스팅에서만 댓글을 작성할 수 있습니다.');
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error('댓글 내용을 입력해주세요.');
  }
  if (trimmedContent.length > COMMENT_MAX_LENGTH) {
    throw new Error(`댓글은 최대 ${COMMENT_MAX_LENGTH}자까지 입력할 수 있습니다.`);
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar || null,
      content: trimmedContent,
    })
    .select('id, user_id, user_name, content, created_at')
    .single();

  if (error) throw error;

  return mapCommentRowToComment(data);
};

export const updateComment = async ({
  commentId,
  userId,
  content,
}: {
  commentId: string;
  userId: string;
  content: string;
}): Promise<Comment> => {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error('댓글 내용을 입력해주세요.');
  }
  if (trimmedContent.length > COMMENT_MAX_LENGTH) {
    throw new Error(`댓글은 최대 ${COMMENT_MAX_LENGTH}자까지 입력할 수 있습니다.`);
  }

  const { data, error } = await supabase
    .from('comments')
    .update({ content: trimmedContent })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select('id, user_id, user_name, content, created_at')
    .single();

  if (error) throw error;

  return mapCommentRowToComment(data);
};

export const deleteComment = async ({
  commentId,
  userId,
}: {
  commentId: string;
  userId: string;
}): Promise<void> => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) throw error;
};

export const toggleCommentLike = async ({
  commentId,
  userId,
  shouldLike,
}: {
  commentId: string;
  userId: string;
  shouldLike: boolean;
}): Promise<void> => {
  if (shouldLike) {
    const { error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: userId });
    // 23505 = unique_violation (이미 좋아요한 경우는 무시)
    if (error && (error as any).code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
  }
};