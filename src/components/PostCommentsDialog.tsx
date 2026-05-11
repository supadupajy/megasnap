import React, { useEffect, useMemo, useState } from 'react';
import { Check, MessageCircle, Send, X } from 'lucide-react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Comment } from '@/types';
import { COMMENT_MAX_LENGTH, fetchCommentsByPostId, insertComment, isPersistedPostId, updateComment } from '@/utils/comments';
import { formatRelativeTime } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import ExpandableCommentText from './ExpandableCommentText';

interface PostCommentsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  initialComments: Comment[];
  authUser: any;
  profile: any;
  onCommentsChange: (comments: Comment[]) => void;
}

const PostCommentsDialog = ({
  isOpen,
  onOpenChange,
  postId,
  initialComments,
  authUser,
  profile,
  onCommentsChange,
}: PostCommentsDialogProps) => {
  const [comments, setComments] = useState<Comment[]>(initialComments || []);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(() => new Set());
  const canPersist = useMemo(() => isPersistedPostId(postId), [postId]);

  useEffect(() => {
    if (!isOpen) return;
    setComments(initialComments || []);
  }, [isOpen, initialComments]);

  useEffect(() => {
    if (!isOpen || !canPersist) return;

    let cancelled = false;
    fetchCommentsByPostId(postId)
      .then((freshComments) => {
        if (cancelled) return;
        setComments(freshComments);
        onCommentsChange(freshComments);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, canPersist, postId, onCommentsChange]);

  const syncComments = (nextComments: Comment[]) => {
    setComments(nextComments);
    onCommentsChange(nextComments);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }
    if (!canPersist) {
      showError('저장 가능한 포스팅에서만 댓글을 작성할 수 있습니다.');
      return;
    }

    const text = commentInput.trim();
    if (!text) return;

    setIsSubmitting(true);
    try {
      const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
      const saved = await insertComment({
        postId,
        userId: authUser.id,
        userName: displayName,
        userAvatar: profile?.avatar_url,
        content: text,
      });
      syncComments([...comments, saved]);
      setCommentInput('');
      showSuccess('댓글이 등록되었습니다.');
    } catch (err) {
      showError('댓글 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startCommentEdit = (comment: Comment) => {
    if (!comment.id || comment.userId !== authUser?.id) return;
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text.slice(0, COMMENT_MAX_LENGTH));
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const saveCommentEdit = async (comment: Comment) => {
    if (!authUser || !comment.id) return;

    const nextText = editCommentText.trim();
    if (!nextText) {
      showError('댓글 내용을 입력해주세요.');
      return;
    }

    setSavingCommentId(comment.id);
    try {
      const saved = await updateComment({ commentId: comment.id, userId: authUser.id, content: nextText });
      syncComments(comments.map(item => item.id === saved.id ? saved : item));
      setEditingCommentId(null);
      setEditCommentText('');
      showSuccess('댓글이 수정되었습니다.');
    } catch (err) {
      showError('댓글 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingCommentId(null);
    }
  };

  const renderCommentRow = (comment: Comment, index: number) => {
    const isOwnComment = !!authUser?.id && comment.userId === authUser.id;
    const isEditing = !!comment.id && editingCommentId === comment.id;
    const commentKey = comment.id || `${index}-${comment.user}-${comment.text}`;

    return (
      <div key={commentKey} className="rounded-2xl bg-slate-50 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="truncate text-sm font-black text-slate-900">{comment.user}</span>
              {comment.createdAt && (
                <span className="shrink-0 text-[10px] font-bold text-slate-400">
                  {formatRelativeTime(new Date(comment.createdAt))}
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editCommentText}
                  onChange={(e) => setEditCommentText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                  maxLength={COMMENT_MAX_LENGTH}
                  disabled={savingCommentId === comment.id}
                  autoFocus
                  className="h-10 rounded-2xl border-indigo-100 bg-white text-sm focus-visible:ring-2 focus-visible:ring-indigo-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => saveCommentEdit(comment)}
                    disabled={savingCommentId === comment.id || !editCommentText.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition active:scale-95 disabled:bg-gray-300"
                    aria-label="댓글 수정 저장"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelCommentEdit}
                    disabled={savingCommentId === comment.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition active:scale-95 disabled:opacity-60"
                    aria-label="댓글 수정 취소"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <ExpandableCommentText
                text={comment.text}
                expanded={expandedCommentIds.has(commentKey)}
                onExpand={() => setExpandedCommentIds((prev) => new Set(prev).add(commentKey))}
                className="text-sm leading-relaxed text-slate-600"
              />
            )}
          </div>

          {!isEditing && isOwnComment && comment.id && (
            <button
              type="button"
              onClick={() => startCommentEdit(comment)}
              className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-600 active:scale-95"
            >
              수정
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed bottom-0 left-0 right-0 top-auto z-[14000] mx-auto flex h-[min(78vh,680px)] w-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 rounded-t-[32px] border-0 bg-white p-0 shadow-[0_-18px_60px_rgba(79,70,229,0.22)] data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full sm:bottom-6 sm:left-1/2 sm:right-auto sm:top-auto sm:translate-x-[-50%] sm:rounded-[32px] [&>button:last-child]:hidden"

        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <VisuallyHidden.Root>
          <DialogHeader>
            <DialogTitle>댓글</DialogTitle>
            <DialogDescription>댓글을 확인하고 작성합니다.</DialogDescription>
          </DialogHeader>
        </VisuallyHidden.Root>

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-black tracking-tight text-slate-950">댓글</p>
              <p className="text-xs font-bold text-slate-400">{comments.length.toLocaleString()}개의 이야기</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 active:scale-95"
            aria-label="댓글 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {comments.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <MessageCircle className="h-7 w-7" />
              </div>
              <p className="text-sm font-black text-slate-700">아직 댓글이 없어요</p>
              <p className="mt-1 text-xs font-medium text-slate-400">첫 댓글을 남겨보세요.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {comments.map(renderCommentRow)}
            </div>
          )}
        </div>

        <form
          onSubmit={handleAddComment}
          className="border-t border-slate-100 bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3"
        >
          <div className="flex items-center gap-2 rounded-3xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 shadow-inner">
            <Input
              placeholder={authUser ? '댓글을 입력하세요...' : '로그인이 필요합니다'}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
              maxLength={COMMENT_MAX_LENGTH}
              disabled={!authUser || isSubmitting}
              className="h-10 flex-1 border-none bg-transparent text-sm focus-visible:ring-0"
            />
            <button
              type="submit"
              disabled={!authUser || !commentInput.trim() || isSubmitting}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              aria-label="댓글 등록"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PostCommentsDialog;
