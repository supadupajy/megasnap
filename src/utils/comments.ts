import { supabase } from '@/integrations/supabase/client';
import { Comment } from '@/types';

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
  user_name: string | null;
  content: string;
}): Comment => ({
  user: row.user_name || '사용자',
  text: row.content,
});

export const fetchCommentsByPostId = async (postId: string): Promise<Comment[]> => {
  if (!isPersistedPostId(postId)) return [];

  const { data, error } = await supabase
    .from('comments')
    .select('user_name, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(mapCommentRowToComment);
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

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar || null,
      content: trimmedContent,
    })
    .select('user_name, content')
    .single();

  if (error) throw error;

  return mapCommentRowToComment(data);
};
