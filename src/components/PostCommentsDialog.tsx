import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Heart, MessageCircle, Send, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Comment } from '@/types';
import {
  COMMENT_MAX_LENGTH,
  deleteComment,
  fetchCommentsByPostId,
  insertComment,
  isPersistedPostId,
  updateComment,
  toggleCommentLike,
} from '@/utils/comments';
import { formatRelativeTime } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset';
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
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(() => new Set());
  const [likingCommentIds, setLikingCommentIds] = useState<Set<string>>(() => new Set());
  const [sheetTopPx, setSheetTopPx] = useState<number | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const canPersist = useMemo(() => isPersistedPostId(postId), [postId]);
  // 이 환경(안드로이드 삼성 인터넷)에서는 키보드가 뜨면 window.innerHeight 자체가 줄어든다.
  // 즉 fixed bottom:0은 자동으로 키보드 위에 붙는다.
  // 따라서 keyboardOffset을 sheet 위치 계산에 쓰지 않는다.
  // (useKeyboardOffset은 다른 컴포넌트와의 호환을 위해 유지, BottomNav 등이 사용)
  const keyboardOffset = useKeyboardOffset(isOpen);
  const frozenSheetBottomRef = useRef<string | null>(null);
  const frozenSheetTopRef = useRef<number | null>(null);
  // 시트는 항상 화면 맨 아래(bottom: 0)에 붙는다.
  // 키보드가 뜨면 layout viewport(window.innerHeight)가 자동으로 줄어들기 때문에
  // bottom:0만으로 시트가 키보드 바로 위에 자연스럽게 붙는다.
  const liveSheetBottom = '0px';
  const sheetBottom = isClosing && frozenSheetBottomRef.current != null
    ? frozenSheetBottomRef.current
    : liveSheetBottom;

  // top도 sheetTopPx 그대로 사용. 키보드 등장 시 innerHeight가 줄면 setSheetTopPx 자체가
  // 작은 viewport에 맞게 재계산되는 게 이상적이지만, 일단 처음 값 유지.
  const liveSheetTopPx = sheetTopPx;
  const effectiveSheetTopPx = isClosing && frozenSheetTopRef.current != null
    ? frozenSheetTopRef.current
    : liveSheetTopPx;


  useEffect(() => {
    if (!isOpen) return;

    // 시트는 화면 상단에서 약 40px(≈1cm) 남기고 거의 풀스크린으로 올라온다.
    setSheetTopPx(40);
  }, [isOpen]);

  useEffect(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      frozenSheetBottomRef.current = null;
      frozenSheetTopRef.current = null;
      return;
    }

    if (shouldRender) {
      frozenSheetBottomRef.current = liveSheetBottom;
      frozenSheetTopRef.current = liveSheetTopPx;
      setIsClosing(true);
      closeTimeoutRef.current = window.setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setSheetTopPx(null);
        frozenSheetBottomRef.current = null;
        frozenSheetTopRef.current = null;
        closeTimeoutRef.current = null;
      }, 220);
    }

    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    (window as any).__commentsDialogOpen = true;
    window.dispatchEvent(new CustomEvent('comments-dialog-visibility', { detail: { open: true } }));

    return () => {
      (window as any).__commentsDialogOpen = false;
      window.dispatchEvent(new CustomEvent('comments-dialog-visibility', { detail: { open: false } }));
    };
  }, [shouldRender]);

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

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onOpenChange]);

  const syncComments = (nextComments: Comment[]) => {
    setComments(nextComments);
    onCommentsChange(nextComments);
  };

  const stopSheetEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const focusCommentInput = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    commentInputRef.current?.focus();
  };

  const closeCommentsDialog = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    commentInputRef.current?.blur();
    onOpenChange(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitComment();
  };

  const submitComment = async () => {
    if (isSubmittingRef.current) return;

    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }
    if (!canPersist) {
      showError('저장 가능한 컨텐츠에서만 댓글을 작성할 수 있습니다.');
      return;
    }

    const text = commentInput.trim();
    if (!text) return;

    isSubmittingRef.current = true;
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
      requestAnimationFrame(() => commentInputRef.current?.focus());
      showSuccess('댓글이 등록되었습니다.');
    } catch (err) {
      showError('댓글 등록에 실패했습니다.');
    } finally {
      isSubmittingRef.current = false;
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

  const handleDeleteComment = async (comment: Comment) => {
    if (!authUser || !comment.id || comment.userId !== authUser.id) return;
    setCommentToDelete(comment);
  };

  const handleToggleCommentLike = async (comment: Comment) => {
    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }
    if (!comment.id) return;
    if (likingCommentIds.has(comment.id)) return;

    const commentId = comment.id;
    const previousIsLiked = !!comment.isLiked;
    const previousLikesCount = comment.likesCount ?? 0;
    const nextIsLiked = !previousIsLiked;
    const nextLikesCount = Math.max(0, previousLikesCount + (nextIsLiked ? 1 : -1));

    // 낙관적 업데이트
    syncComments(comments.map(item =>
      item.id === commentId
        ? { ...item, isLiked: nextIsLiked, likesCount: nextLikesCount }
        : item
    ));

    setLikingCommentIds(prev => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });

    try {
      await toggleCommentLike({
        commentId,
        userId: authUser.id,
        shouldLike: nextIsLiked,
      });
    } catch (err) {
      // 실패 시 롤백
      syncComments(comments.map(item =>
        item.id === commentId
          ? { ...item, isLiked: previousIsLiked, likesCount: previousLikesCount }
          : item
      ));
      showError('좋아요 처리 중 오류가 발생했습니다.');
    } finally {
      setLikingCommentIds(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const confirmDeleteComment = async () => {
    if (!authUser || !commentToDelete?.id || commentToDelete.userId !== authUser.id) return;

    setDeletingCommentId(commentToDelete.id);
    try {
      await deleteComment({ commentId: commentToDelete.id, userId: authUser.id });
      syncComments(comments.filter(item => item.id !== commentToDelete.id));
      if (editingCommentId === commentToDelete.id) {
        cancelCommentEdit();
      }
      setCommentToDelete(null);
      showSuccess('댓글이 삭제되었습니다.');
    } catch (err) {
      showError('댓글 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const renderCommentRow = (comment: Comment, index: number) => {
    const isOwnComment = !!authUser?.id && comment.userId === authUser.id;
    const isEditing = !!comment.id && editingCommentId === comment.id;
    const isDeleting = !!comment.id && deletingCommentId === comment.id;
    const commentKey = comment.id || `${index}-${comment.user}-${comment.text}`;
    const isLiked = !!comment.isLiked;
    const likesCount = comment.likesCount ?? 0;
    const isLikePending = !!comment.id && likingCommentIds.has(comment.id);

    const likeButton = !isEditing && comment.id ? (
      <button
        type="button"
        onClick={() => handleToggleCommentLike(comment)}
        disabled={isLikePending || isDeleting}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-black transition-all active:scale-95 disabled:opacity-60 ${
          isLiked
            ? 'border-red-100 bg-red-50 text-red-500 shadow-sm shadow-red-100/50'
            : 'border-gray-100 bg-white text-gray-700 hover:bg-gray-50'
        }`}
        aria-label={`댓글 좋아요 ${likesCount.toLocaleString()}개`}
      >
        <Heart className={`h-[18px] w-[18px] transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
        <span className="tabular-nums leading-none">{likesCount.toLocaleString()}</span>
      </button>
    ) : null;

    const showLikeOnly = !isEditing && !isOwnComment && !!likeButton;

    return (
      <div key={commentKey} className="rounded-3xl bg-slate-50 px-4 py-3.5">
        <div className={`flex justify-between gap-3 ${showLikeOnly ? 'items-center' : 'items-start'}`}>
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
                  disabled={savingCommentId === comment.id || isDeleting}
                  autoFocus
                  className="h-10 rounded-2xl border-indigo-100 bg-white text-sm focus-visible:ring-2 focus-visible:ring-indigo-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => saveCommentEdit(comment)}
                    disabled={savingCommentId === comment.id || !editCommentText.trim() || isDeleting}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition active:scale-95 disabled:bg-gray-300"
                    aria-label="댓글 수정 저장"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelCommentEdit}
                    disabled={savingCommentId === comment.id || isDeleting}
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

          {!isEditing && isOwnComment && comment.id ? (
            <div className="flex shrink-0 items-center gap-2">
              {likeButton}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startCommentEdit(comment)}
                  disabled={isDeleting}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-600 transition active:scale-95 disabled:opacity-50"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteComment(comment)}
                  disabled={isDeleting}
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-500 transition active:scale-95 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            !isEditing && likeButton && (
              <div className="flex shrink-0 items-center">
                {likeButton}
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  if (!shouldRender) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[30000] pointer-events-none" role="dialog" aria-modal="true" aria-label="댓글">
      <button
        type="button"
        className={`absolute left-0 right-0 top-0 z-0 cursor-default bg-slate-950/60 pointer-events-auto ${isClosing ? 'comment-backdrop-exit' : 'comment-backdrop-enter'}`}
        style={{ bottom: sheetBottom }}
        onPointerDown={closeCommentsDialog}
        onClick={closeCommentsDialog}
        aria-label="댓글 닫기 배경"
      />

      <section
        className={`fixed left-1/2 z-[1] flex w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-white/80 bg-white shadow-[0_-18px_60px_rgba(79,70,229,0.20)] pointer-events-auto sm:rounded-[32px] ${isClosing ? 'comment-sheet-exit' : 'comment-sheet-enter'}`}
        style={{
          top: effectiveSheetTopPx == null ? undefined : `${effectiveSheetTopPx}px`,
          bottom: sheetBottom,
        }}
        onClick={stopSheetEvent}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-950">댓글</p>
              <p className="text-sm font-bold text-slate-400">{comments.length.toLocaleString()}개의 이야기</p>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={closeCommentsDialog}
            onClick={closeCommentsDialog}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition active:scale-95"
            aria-label="댓글 닫기"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 overscroll-contain">
          {comments.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <MessageCircle className="h-8 w-8" />
              </div>
              <p className="text-base font-black text-slate-700">아직 댓글이 없어요</p>
              <p className="mt-1 text-sm font-medium text-slate-400">첫 댓글을 남겨보세요.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {comments.map(renderCommentRow)}
            </div>
          )}
        </div>

        <form
          onSubmit={handleAddComment}
          className="border-t border-slate-100 bg-white px-4 pt-3"
          style={{
            // 키보드가 떠 있을 때는 키보드 바로 위에 붙으므로 작은 패딩으로 충분.
            // 키보드가 없을 때는 안드로이드 제스처 바(safe-area)와 겹치지 않도록 여유 공간 확보.
            paddingBottom: keyboardOffset > 0
              ? '12px'
              : 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          }}
        >
          <div
            className="flex items-center gap-2 rounded-3xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 shadow-inner"
            onClick={focusCommentInput}
          >
            <Input
              ref={commentInputRef}
              placeholder={authUser ? '댓글을 입력하세요...' : '로그인이 필요합니다'}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
              maxLength={COMMENT_MAX_LENGTH}
              disabled={!authUser || isSubmitting}
              className="h-10 flex-1 cursor-text border-none bg-transparent text-sm focus-visible:ring-0"
            />
            <button
              type="submit"
              disabled={!authUser || !commentInput.trim() || isSubmitting}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void submitComment();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              aria-label="댓글 등록"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      {commentToDelete && (
        <div
          className="fixed inset-0 z-[2] flex items-center justify-center bg-slate-950/45 px-6 pointer-events-auto comment-backdrop-enter"
          onClick={() => {
            if (!deletingCommentId) setCommentToDelete(null);
          }}
        >
          <div
            className="w-full max-w-xs rounded-[28px] bg-white p-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
            onClick={stopSheetEvent}
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <X className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-slate-950">댓글을 삭제할까요?</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              삭제한 댓글은 다시 복구할 수 없어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCommentToDelete(null)}
                disabled={!!deletingCommentId}
                className="h-11 rounded-2xl bg-slate-100 text-sm font-black text-slate-600 transition active:scale-95 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteComment}
                disabled={!!deletingCommentId}
                className="h-11 rounded-2xl bg-rose-500 text-sm font-black text-white shadow-lg shadow-rose-100 transition active:scale-95 disabled:bg-rose-300"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default PostCommentsDialog;