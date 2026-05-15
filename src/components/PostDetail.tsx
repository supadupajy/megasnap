"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { MapPin, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn, getFallbackImage, getOptimizedDetailImage } from '@/lib/utils';

import { useLocation, useNavigate } from 'react-router-dom';
import { Comment } from '@/types';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { fetchCommentsByPostId, isPersistedPostId } from '@/utils/comments';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import PostCommentsDialog from './PostCommentsDialog';
import PostActions from './PostActions';
import PostUserAvatar from './PostUserAvatar';
import PostCategoryBadge from './PostCategoryBadge';
import PostMenuDropdown from './PostMenuDropdown';
import ImageSliderDots from './ImageSliderDots';
import HashtagText from './HashtagText';
import VideoPlayer from './VideoPlayer';
import { useMediaAspectRatio } from '@/hooks/use-media-aspect-ratio';
import { useImageSliderDrag } from '@/hooks/use-image-slider-drag';

import { useLocationDisplay } from '@/hooks/use-location-display';
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset';
import { useKeyboardSafeScroll } from '@/hooks/use-keyboard-safe-scroll';
import { invalidateAdCache } from '@/hooks/use-ad';
import { formatRelativeTime } from '@/lib/utils';

interface PostDetailProps {
  posts: any[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (postId: string) => void;
  onUpdate?: (postId: string, content: string) => void;
  onViewPost?: (id: string) => void;
  onLikeToggle?: (postId: string) => void;
  onLocationClick?: (lat: number, lng: number) => void;
}

const FALLBACK_IMAGE = "/placeholder.svg";

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onDelete, onUpdate, onViewPost, onLikeToggle, onLocationClick }: PostDetailProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile: authProfile, isAdmin } = useAuth();
  const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  
  const currentPost = useMemo(() => posts[currentPostIndex], [posts, currentPostIndex]);
  const canEditContent = location.pathname === '/profile';

  // ── 뒤로가기 버튼으로 닫기 (Android/브라우저 back 버튼) ──────
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // X버튼으로 닫는 중임을 표시 (popstate 핸들러에서 중복 onClose 방지)
  const isClosingByButtonRef = useRef(false);

  // ── window 플래그: App.tsx Capacitor backButton 핸들러에서 참조 ──
  useEffect(() => {
    (window as any).__isPostDetailOpen = isOpen;
    window.dispatchEvent(new CustomEvent('post-detail-visibility', { detail: { open: isOpen } }));
    return () => {
      if (isOpen) {
        (window as any).__isPostDetailOpen = false;
        window.dispatchEvent(new CustomEvent('post-detail-visibility', { detail: { open: false } }));
      }
    };
  }, [isOpen]);

  // ── Capacitor 뒤로가기 버튼 이벤트 수신 (App.tsx에서 발송) ──
  useEffect(() => {
    if (!isOpen) return;
    const handleCloseByBack = () => {
      onCloseRef.current?.();
    };
    window.addEventListener('close-post-detail-by-back', handleCloseByBack);
    return () => window.removeEventListener('close-post-detail-by-back', handleCloseByBack);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // 더미 히스토리 항목 추가 (뒤로가기 시 이 항목이 pop됨)
    history.pushState({ postDetailOpen: true }, '');

    const handlePopState = () => {
      // X버튼으로 닫는 중이면 popstate 무시 (이미 onClose 호출됨)
      if (isClosingByButtonRef.current) {
        isClosingByButtonRef.current = false;
        return;
      }
      onCloseRef.current?.();
    };

    // Index.tsx의 handleClosePostDetail에서 history.back() 호출 전에 이 이벤트를 발송
    // → popstate 핸들러에서 중복 onClose 호출을 방지
    const handleCloseByButton = () => {
      isClosingByButtonRef.current = true;
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('post-detail-close-by-button', handleCloseByButton);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('post-detail-close-by-button', handleCloseByButton);
    };
  }, [isOpen]);

  const [hasInitialized, setHasInitialized] = useState(false);
  const {
    scrollRef: imageScrollRef,
    currentImageIndex,
    setCurrentImageIndex,
    isDragging,
    onScroll: handleImageScroll,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    resetScroll: resetImageSlider,
  } = useImageSliderDrag<HTMLDivElement>();
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);

  const keyboardOffset = useKeyboardOffset(isOpen && !isCommentsDialogOpen);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [isContentClamped, setIsContentClamped] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [localContentById, setLocalContentById] = useState<Record<string, string>>({});
  const [isSavingContent, setIsSavingContent] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const recordedViewPostIdsRef = useRef<Set<string>>(new Set());
  const { targetRef: editFormRef } = useKeyboardSafeScroll<HTMLDivElement>(isOpen && isEditingContent);

  // contentRef가 마운트된 후 실제로 잘렸는지 감지.
  // Flicks(ReelContentText)와 동일하게 한 줄 truncate 기반이므로 가로 overflow(scrollWidth > clientWidth)로 측정.
  const checkClamped = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!el.isConnected || el.clientWidth === 0) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setIsContentClamped(prev => (prev === overflow ? prev : overflow));
  }, []);

  useEffect(() => {
    if (!isOpen && !isDeleteDialogOpen) {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
    }
  }, [isOpen, isDeleteDialogOpen]);

  useLayoutEffect(() => {
    if (isOpen && scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [currentPostIndex, isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitialized && initialIndex !== -1) {
      setCurrentPostIndex(initialIndex);
      setHasInitialized(true);
      setCurrentImageIndex(0);
      const post = posts[initialIndex];
      if (post) {
        setLocalComments(post.comments || []);
        setIsSaved(post.isSaved || false);
      }
    }
    if (!isOpen) { setHasInitialized(false); }
  }, [isOpen, initialIndex, hasInitialized, posts]);

  useEffect(() => {
    const currentPost = posts[currentPostIndex];
    if (isOpen && currentPost) {
      if (onViewPost) onViewPost(currentPost.id);
      setCurrentImageIndex(0);
      // 광고 포스트는 loadComments useEffect에서 ad_comments를 fetch해 세팅하므로 여기서 덮어쓰지 않음
      if (isPersistedPostId(currentPost.id)) {
        setLocalComments(currentPost.comments || []);
      } else {
        console.log('[PostDetail] useEffect#1 - ad post, skipping setLocalComments. currentPost.comments:', currentPost.comments);
      }
      setIsSaved(currentPost.isSaved || false);
      setContentExpanded(false);
      setIsContentClamped(false);
      setIsEditingContent(false);
      setEditContent(localContentById[currentPost.id] ?? currentPost.content ?? '');
      if (imageScrollRef.current) imageScrollRef.current.scrollLeft = 0;

      const recordView = async () => {
        if (currentPost.isAd || !isPersistedPostId(currentPost.id)) return;
        if (recordedViewPostIdsRef.current.has(currentPost.id)) return;
        recordedViewPostIdsRef.current.add(currentPost.id);

        try {
          const { data } = await supabase.functions.invoke('record-post-view', {
            body: { postId: currentPost.id },
          });
          if ((data as any)?.counted) {
            window.dispatchEvent(new CustomEvent('post-view-recorded', { detail: { postId: currentPost.id } }));
          }
        } catch {
          recordedViewPostIdsRef.current.delete(currentPost.id);
        }
      };
      recordView();

      const checkSaveStatus = async () => {
        if (!authUser) return;
        if (isPersistedPostId(currentPost.id)) {
          const { data } = await supabase.from('saved_posts').select('id').eq('post_id', currentPost.id).eq('user_id', authUser.id).maybeSingle();
          setIsSaved(!!data);
        } else {
          // 광고 포스트: ad_saved 테이블에서 확인
          const { data } = await supabase.from('ad_saved').select('id').eq('ad_id', currentPost.id).eq('user_id', authUser.id).maybeSingle();
          setIsSaved(!!data);
        }
      };
      checkSaveStatus();
    }
  }, [currentPostIndex, isOpen, onViewPost, posts, authUser, localContentById]);

  const currentContent = currentPost ? (localContentById[currentPost.id] ?? currentPost.content ?? '') : '';

  const startContentEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPost) return;
    setEditContent(currentContent);
    setIsEditingContent(true);
    setContentExpanded(true);
  };

  const cancelContentEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(currentContent);
    setIsEditingContent(false);
  };

  const saveContentEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser || !currentPost) {
      showError('로그인이 필요합니다.');
      return;
    }

    const nextContent = editContent.trim();
    if (!nextContent) {
      showError('내용을 입력해주세요.');
      return;
    }

    setIsSavingContent(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: nextContent })
        .eq('id', currentPost.id)
        .eq('user_id', authUser.id);
      if (error) throw error;

      setLocalContentById(prev => ({ ...prev, [currentPost.id]: nextContent }));
      setEditContent(nextContent);
      setIsEditingContent(false);
      setContentExpanded(false);
      onUpdate?.(currentPost.id, nextContent);
      showSuccess('컨텐츠가 수정되었습니다.');
    } catch (err) {
      showError('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingContent(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const currentPost = posts[currentPostIndex];
    const loadComments = async () => {
      if (!isOpen || !currentPost) return;
      if (!isPersistedPostId(currentPost.id)) {
        // 광고 포스트: ad_comments 테이블에서 fetch
        console.log('[PostDetail] useEffect#2 loadComments - ad post start, postId:', currentPost.id);
        try {
          const { data } = await supabase
            .from('ad_comments')
            .select('id, user_id, user_name, content, created_at')
            .eq('ad_id', currentPost.id)
            .order('created_at', { ascending: true });
          console.log('[PostDetail] useEffect#2 loadComments - fetch done, cancelled:', cancelled, 'data:', data);
          if (!cancelled) {
            const mapped = (data || []).map((row: any) => ({
              id: row.id,
              userId: row.user_id,
              user: row.user_name || '사용자',
              text: row.content,
              createdAt: row.created_at ? new Date(row.created_at) : undefined,
              likesCount: 0,
              isLiked: false,
            }));
            console.log('[PostDetail] useEffect#2 - setLocalComments with:', mapped);
            setLocalComments(mapped);
          }
        } catch {
          if (!cancelled) setLocalComments(currentPost.comments || []);
        }
        return;
      }
      try {
        const dbComments = await fetchCommentsByPostId(currentPost.id);
        if (!cancelled) setLocalComments(dbComments);
      } catch (err) {
        if (!cancelled) setLocalComments(currentPost.comments || []);
      }
    };
    loadComments();
    return () => { cancelled = true; };
  }, [currentPostIndex, isOpen, posts]);

  useEffect(() => {
    const currentPost = posts[currentPostIndex];
    if (!isOpen || !currentPost || !currentPost.videoUrl) return;
    const observer = new IntersectionObserver(([entry]) => { }, { threshold: 0.6 });
    if (videoContainerRef.current) observer.observe(videoContainerRef.current);
    return () => observer.disconnect();
  }, [currentPostIndex, isOpen, posts]);

  // Dialog 애니메이션 완료 후 여러 타이밍에 걸쳐 clamp 감지
  useEffect(() => {
    if (!isOpen || contentExpanded) return;
    setIsContentClamped(false);
    const t1 = setTimeout(checkClamped, 100);
    const t2 = setTimeout(checkClamped, 300);
    const t3 = setTimeout(checkClamped, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [currentPostIndex, isOpen, contentExpanded, checkClamped]);

  const isValidUrl = (url: any) => {
    if (typeof url !== 'string') return false;
    const clean = url.trim();
    return clean.startsWith('http') && !/post\s*content/i.test(clean);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPost.lat !== undefined && currentPost.lng !== undefined) {
      onLocationClick?.(currentPost.lat, currentPost.lng);
    }
  };

  const handleImageError = (postId: string) => {
    setImgErrors(prev => ({ ...prev, [postId]: true }));
  };

  const isDummyUrl = (url: any) => {
    if (!url || typeof url !== 'string') return true;
    const clean = url.trim();
    if (clean.includes('supabase.co/storage')) return false;
    // "post content" 같은 placeholder 문자열만 더미로 간주 (정상 URL의 'post'/'content' 단어는 허용)
    if (/post\s*content/i.test(clean)) return true;
    return clean.length < 10 || !clean.startsWith('http');
  };

  const displayImage = (() => {
    if (!currentPost) return getFallbackImage('default');
    if (imgErrors[currentPost.id]) return getFallbackImage(currentPost.id);
    const rawUrl = currentPost.image || currentPost.image_url;
    return isDummyUrl(rawUrl) ? getFallbackImage(currentPost.id) : rawUrl;
  })();

  const isAd = currentPost?.isAd || false;

  const rawDisplayImages = (() => {
    if (!currentPost) return [];
    let baseImages: string[] = [];
    if (Array.isArray(currentPost.images) && currentPost.images.length > 0) {
      baseImages = currentPost.images.filter((img: any) => !isDummyUrl(img));
    }
    const singleImg = currentPost.image_url || currentPost.image;
    if (baseImages.length === 0 && singleImg && !isDummyUrl(singleImg)) {
      baseImages = [singleImg];
    }
    if (baseImages.length === 0) {
      baseImages = [displayImage];
    }
    return baseImages;
  })();

  const displayImages = currentPost
    ? rawDisplayImages.map((img) => getOptimizedDetailImage(img, currentPost.id))
    : [];

  const mediaAspectRatio = useMediaAspectRatio(
    currentPost?.videoUrl && !currentPost?.isAd ? currentPost.videoUrl : (rawDisplayImages[currentImageIndex] || rawDisplayImages[0]),
    currentPost?.videoUrl && !currentPost?.isAd ? 'video' : 'image'
  );

  const postDisplayName = currentPost?.user?.name || '익명';
  
  const isMine = (() => {
    if (!currentPost || !authUser) return false;
    const ownerId = currentPost.owner_id || currentPost.user_id;
    return ownerId === authUser.id || ownerId === 'me';
  })();

  const formattedDate = currentPost?.createdAt
    ? formatRelativeTime(new Date(currentPost.createdAt))
    : null;

  const displayLocation = useLocationDisplay(
    currentPost?.location || '',
    currentPost?.lat ?? currentPost?.latitude,
    currentPost?.lng ?? currentPost?.longitude
  );
  const isLocationMissing = !displayLocation || ['위치 미지정', '위치 정보 없음', '알 수 없는 장소'].includes(displayLocation);

  if (!currentPost) return null;

  if (currentPost.isAdPending) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPortal>
          <DialogOverlay className="z-[12999] bg-black/40" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="fixed inset-0 z-[13000] max-w-[100vw] w-full h-screen min-h-screen max-h-screen p-0 gap-0 border-none bg-transparent overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

          >
            <VisuallyHidden.Root>
              <DialogTitle>광고 준비 중</DialogTitle>
              <DialogDescription>광고 시작 시간 전입니다.</DialogDescription>
            </VisuallyHidden.Root>
            <div className="relative flex-1 flex flex-col min-h-0">
              <div className="absolute top-0 left-0 right-0 z-50 flex items-start justify-end px-4 pt-7 pointer-events-none">
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 active:scale-90 transition-all pointer-events-auto">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="relative w-full h-full flex items-center justify-center px-4" style={{ paddingTop: '16px', paddingBottom: '60px' }}>
                <div className="w-full max-w-[420px] bg-white rounded-[28px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col">
                  <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                    {currentPost.image_url || currentPost.image ? (
                      <img
                        src={getOptimizedDetailImage(currentPost.image_url || currentPost.image, currentPost.id)}
                        alt={currentPost.content || '예약 광고 이미지'}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-slate-700 text-xs font-black shadow-sm">
                      예약 광고
                    </div>
                  </div>
                  <div className="p-7 flex flex-col items-center gap-5">
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-900 mb-1">광고 준비 중</p>
                      <p className="text-sm text-gray-500 font-medium leading-relaxed">
                        광고 시작 시간이 되면<br />자동으로 활성화됩니다.
                      </p>
                      {currentPost.user?.name && currentPost.user.name !== '광고' && (
                        <p className="text-xs text-slate-400 font-bold mt-3 bg-slate-50 px-3 py-1.5 rounded-full inline-block">
                          {currentPost.user.name}
                        </p>
                      )}
                    </div>
                    <button onClick={onClose} className="w-full h-12 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm active:scale-95 transition-all">
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    );
  }

  const closeDetailForNavigation = () => {
    if (history.state?.postDetailOpen) {
      history.replaceState({ ...history.state, postDetailOpen: false }, '');
    }
    onClose();
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMine) {
      closeDetailForNavigation();
      navigate('/profile');
      return;
    }
    const targetUserId = currentPost.user.id || currentPost.user_id;
    const isValidUUID = targetUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    if (isValidUUID) {
      closeDetailForNavigation();
      navigate(`/profile/${targetUserId}`);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCommentsDialogOpen(true);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    try {
      if (isPersistedPostId(currentPost.id)) {
        // 일반 포스트: saved_posts 테이블
        if (prevSaved) {
          await supabase.from('saved_posts').delete().eq('post_id', currentPost.id).eq('user_id', authUser.id);
        } else {
          await supabase.from('saved_posts').insert({ post_id: currentPost.id, user_id: authUser.id });
        }
      } else {
        // 광고 포스트: ad_saved 테이블
        if (prevSaved) {
          await supabase.from('ad_saved').delete().eq('ad_id', currentPost.id).eq('user_id', authUser.id);
        } else {
          await supabase.from('ad_saved').insert({ ad_id: currentPost.id, user_id: authUser.id });
        }
      }
      showSuccess(prevSaved ? '저장이 취소되었습니다.' : '컨텐츠를 저장했습니다! ✨');
    } catch (err) {
      setIsSaved(prevSaved);
      showError('저장 처리 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = async () => {
    if (!currentPost || !currentPost.id) { showError('유효하지 않은 컨텐츠입니다.'); return; }

    if (currentPost.isAd) {
      setIsDeleteDialogOpen(false);
      setTimeout(() => {
        if (onDelete) onDelete(currentPost.id);
        onClose();
      }, 0);
      try {
        const { error } = await supabase
          .from('ads')
          .update({
            is_active: false,
            image_url: '',
            title: '',
            subtitle: '',
            link_url: '',
            brand_name: '',
            brand_logo_url: '',
            lat: null,
            lng: null,
            start_date: null,
            end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 'map_marker');
        if (error) throw error;
        invalidateAdCache('map_marker', {
          id: 'map_marker', label: '지도 마커 광고', image_url: '', title: '', subtitle: '',
          link_url: '', brand_name: '', brand_logo_url: '', is_active: false,
          lat: null, lng: null, start_date: null, end_date: null,
        });
        showSuccess('광고 마커가 삭제되었습니다.');
      } catch (err: any) {
        console.error('[PostDetail] Ad delete error:', err);
        showError('광고 삭제 중 오류가 발생했습니다.');
      }
      return;
    }

    const postId = currentPost.id;
    setIsDeleteDialogOpen(false);
    setTimeout(() => {
      if (onDelete) onDelete(postId);
      onClose();
    }, 0);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      showSuccess('컨텐츠가 삭제되었습니다.');
    } catch (err: any) {
      console.error('[PostDetail] Delete error:', err);
      showError(`삭제 중 오류가 발생했습니다.`);
    }
  };


  const renderContentBody = () => {
    if (isEditingContent) {
      return (
        <div
          ref={editFormRef}
          className="space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            disabled={isSavingContent}
            autoFocus
            className="min-h-[96px] resize-none rounded-2xl border-indigo-100 bg-indigo-50/40 text-sm text-gray-900 shadow-inner focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={saveContentEdit}
              disabled={isSavingContent || !editContent.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition active:scale-95 disabled:bg-gray-300"
              aria-label="수정 저장"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={cancelContentEdit}
              disabled={isSavingContent}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition active:scale-95 disabled:opacity-60"
              aria-label="수정 취소"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      );
    }

    // Flicks(ReelsViewer)와 동일한 디자인:
    //   - 펼치기 전: 한 줄 truncate + 우측에 절대 위치 "... 더 보기" 버튼 (그라데이션 페이드)
    //   - 펼치고 나면: 전체 내용 + 끝에 "... <닫기>" 인라인 버튼
    // PostDetail은 라이트 테마이므로 색상만 어둡게(검정 글씨, 흰 배경) 맞춤.
    return (
      <div className="text-sm leading-snug text-gray-800">
        {contentExpanded ? (
          <div>
            <p className="inline">
              <HashtagText text={currentContent} />
            </p>
            {isContentClamped && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setContentExpanded(false);
                  // 펼친 상태에서 스크롤된 후 닫으면 스크롤 위치가 유지되어 헤더가 잘려 보이는 버그가 있다.
                  // 닫기 시 스크롤 컨테이너를 최상단으로 되돌려 처음 페이지가 열린 상태로 복귀시킨다.
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                  }
                }}
                className="ml-2 inline-flex items-center align-baseline text-xs font-black text-gray-500 hover:text-gray-700 transition-colors"
              >
                {'... <닫기>'}
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* 한 줄 truncate. 우측 패딩은 두지 않고 "더 보기" 버튼을 우측 절대위치로 오버레이 */}
            <p ref={contentRef} className="block truncate leading-snug">
              <HashtagText text={currentContent} />
            </p>
            {isContentClamped && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setContentExpanded(true);
                }}
                className="absolute bottom-0 right-0 pl-3 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                style={{
                  background:
                    'linear-gradient(to right, transparent, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.95) 100%)',
                }}
              >
                ... 더 보기
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderImageSlider = () => {
    return (
    <div className="absolute inset-0 w-full h-full z-10">
      <div
        ref={imageScrollRef}
        className={cn(
          "flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar cursor-grab",
          isDragging && "cursor-grabbing snap-none"
        )}
        onScroll={handleImageScroll}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={onMouseMove}
      >
        {displayImages.map((img, index) => (
          <div
            key={index}
            className="w-full h-full shrink-0 snap-center relative"
            style={{ scrollSnapStop: 'always' }}
          >
            <img
              src={img}
              alt={`Post content ${index + 1}`}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = getFallbackImage(currentPost.id);
                if (target.src !== fallback) target.src = fallback;
              }}
            />
          </div>
        ))}
      </div>
      <ImageSliderDots
        count={displayImages.length}
        currentIndex={currentImageIndex}
        activeWidthClass="w-6"
        inactiveColorClass="bg-white/40"
        bottomClass="bottom-6"
        zIndexClass="z-30"
      />
    </div>
    );
  };

  const renderMediaArea = () => (
    <div
      className="relative rounded-3xl overflow-hidden bg-black shadow-inner transition-[height] duration-300"
      style={{ aspectRatio: mediaAspectRatio }}
    >
      {currentPost.videoUrl && !currentPost.isAd ? (
        <VideoPlayer src={currentPost.videoUrl} />
      ) : (
        renderImageSlider()
      )}
    </div>
  );

  const renderActionButtons = () => {
    const commentsDisplayCount = Math.max(localComments.length, currentPost.commentsCount || 0);
    const hasUserCommented = !!authUser?.id && localComments.some(comment => comment.userId === authUser.id);
    console.log('[PostDetail] renderActionButtons - localComments:', localComments.map(c => ({ id: c.id, userId: c.userId })), 'authUserId:', authUser?.id, 'hasUserCommented:', hasUserCommented);

    // 광고 포스트: 본문(닉네임 + 컨텐츠)을 PostActions의 adFooterContent로 넘겨서
    // - 1줄: [좋아요/댓글/공유 + 저장]   ...   [위치보기]
    // - 2줄: [닉네임 + 본문]              ...   [보러가기]
    // 형태로 정렬한다. 그러면 본문이 BottomNav 알약 뒤로 숨지 않고
    // "보러가기" 버튼 왼쪽에 자연스럽게 배치된다.
    const adFooterContent = isAd ? (
      <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 items-start">
          <span
            className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); handleUserClick(e); }}
          >
            {postDisplayName}
          </span>
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            {renderContentBody()}
          </div>
        </div>
      </div>
    ) : undefined;

    return (
      <PostActions
        postId={currentPost.id}
        isLiked={!!currentPost.isLiked}
        isSaved={isSaved}
        likesCount={currentPost.likes}
        commentsCount={commentsDisplayCount}
        hasUserCommented={hasUserCommented}
        isAd={isAd}
        linkUrl={currentPost.link_url}
        lat={currentPost.lat}
        lng={currentPost.lng}
        createdAt={currentPost.createdAt}
        adIcon="external-link"
        adFooterContent={adFooterContent}
        onLikeClick={(e) => { e.stopPropagation(); onLikeToggle?.(currentPost.id); }}
        onCommentClick={handleCommentClick}
        onSaveClick={handleSaveToggle}
        onLocationClick={(e, lat, lng) => { e.stopPropagation(); onLocationClick?.(lat, lng); }}
      />
    );
  };

  const renderDropdownMenu = () => (
    <PostMenuDropdown
      isMine={isMine}
      isAdmin={isAdmin}
      isAd={isAd}
      postOwnerId={currentPost.user.id}
      zIndexClass="z-[13010]"
      onEdit={canEditContent ? startContentEdit : undefined}
      onDelete={() => window.setTimeout(() => setIsDeleteDialogOpen(true), 0)}
      onAfterBlock={onClose}
      reportMessage="신고되었습니다."
    />
  );

  return (
    <>
      {/*
        modal: 댓글창(PostCommentsDialog)이 열렸을 때만 false로 전환.
        - 댓글창은 Dialog 트리 밖(형제) + Portal(document.body)에 렌더링되므로,
          PostDetail의 Radix FocusScope(trapped=true)가 댓글 input의 focus를 가로채서
          키보드가 올라오지 않는 문제가 발생.
        - modal=false면 FocusScope이 비-trapped로 동작해 외부 input이 자유롭게 focus 받음.
      */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        modal={!isCommentsDialogOpen}
      >
        <DialogPortal>
          <DialogOverlay
            className="z-[12999] bg-black/40"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
          />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => e.preventDefault()}
            // 댓글창(PostCommentsDialog)이 Dialog 트리 밖(형제)에서 렌더링되므로,
            // 댓글창 클릭이 "Dialog 외부 클릭"으로 잡혀 PostDetail이 닫히는 것을 막는다.
            onPointerDownOutside={(e) => {
              if (isCommentsDialogOpen) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (isCommentsDialogOpen) e.preventDefault();
            }}
            onFocusOutside={(e) => {
              // 댓글 input이 외부에 있으므로 focus가 나가더라도 FocusScope가 되돌리지 않도록.
              if (isCommentsDialogOpen) e.preventDefault();
            }}
            className="fixed z-[13000] max-w-[100vw] w-full p-0 gap-0 border-none bg-transparent overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
              left: 0,
              right: 0,
              // 화면 바닥까지 흰 배경이 꽉 차도록 bottom: 0.
              // (이전엔 BottomNav 높이만큼 띄워두어서 알약 좌·우/아래로 지도가 비치는 문제가 있었음)
              bottom: 0,
            }}
          >
            <VisuallyHidden.Root>
              <DialogTitle>포스트 상세 보기</DialogTitle>
              <DialogDescription>선택한 포스트의 상세 내용과 댓글을 확인할 수 있는 화면입니다.</DialogDescription>
            </VisuallyHidden.Root>
            
            <div className="relative flex-1 flex flex-col min-h-0">
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 relative pointer-events-auto">
                  {/* ===== 통합 포스트 레이아웃 (지도 마커 / 광고 마커 동일) ===== */}
                  <div className="w-full h-full">
                    <div className="w-full h-full flex flex-col bg-white overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative" onClick={onClose}>
                      <div className="flex-1 min-h-0 flex flex-col relative bg-white">
                        {/*
                          닉네임 헤더 + 콘텐츠 영역.
                          기본 상태에서는 본문이 line-clamp-2로 잘려 있어 화면에 딱 맞으므로 스크롤을 잠근다(overflow-hidden).
                          본문이 잘려 "더 보기"가 보이는 상태에서 사용자가 확장한 경우(contentExpanded=true)에만
                          내용이 화면을 넘칠 수 있어 스크롤을 허용한다(overflow-y-auto).
                        */}
                        <div
                          ref={scrollContainerRef}
                          className={cn(
                            "flex-1 min-h-0 no-scrollbar overscroll-contain",
                            contentExpanded ? "overflow-y-auto" : "overflow-hidden"
                          )}
                          style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                          {/*
                            PostItem(여기보기 페이지)과 동일한 레이아웃: 구분선 없이 헤더 → 미디어가 자연스럽게 이어짐.
                            상단/하단 여백 밸런스를 위해 헤더 상단 패딩을 살짝 줄여 콘텐츠 전체를 위로 당김.
                          */}
                          <div className="flex items-center justify-between pt-2 px-4 pb-3 bg-white" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1" onClick={handleUserClick}>
                              <PostUserAvatar
                                name={postDisplayName}
                                avatar={currentPost.user.avatar}
                                postId={currentPost.id}
                                userId={currentPost.user.id}
                                isAd={isAd}
                                size="md"
                                optimize
                                activePress
                              />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 py-0.5">
                                  <p className="text-sm font-bold text-gray-900 leading-[1.25] group-hover:text-indigo-600 transition-colors truncate">{postDisplayName}</p>
                                  {isAd && <div className="ad-badge-fancy shrink-0"><span>AD</span></div>}
                                </div>
                                <div
                                  className={cn(
                                    "flex items-center gap-0.5 mt-0.5 min-w-0",
                                    isLocationMissing ? "text-gray-400" : "text-indigo-600 cursor-pointer hover:underline"
                                  )}
                                  onClick={handleLocationClick}
                                >
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="text-[10px] font-medium truncate">{displayLocation || '알 수 없는 장소'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {!isAd && <PostCategoryBadge category={currentPost.category} />}
                              {formattedDate && <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>}
                              {/* 광고 포스트는 신고/차단 대상이 아니므로 더보기(···) 메뉴를 숨긴다. */}
                              {!isAd && renderDropdownMenu()}
                              <button
                                onClick={onClose}
                                className="w-9 h-9 bg-gray-600 hover:bg-gray-700 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all"
                                aria-label="닫기"
                              >
                                <X className="w-5 h-5" strokeWidth={2.25} />
                              </button>
                            </div>
                          </div>

                          {/* 미디어 영역 — 헤더 아래에 별도 마진 없이 이어지도록 (PostItem과 동일) */}
                          <div className="px-4">
                            {renderMediaArea()}
                          </div>

                          <div
                            className="px-4 pt-2"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              // BottomNav 알약(약 64px) + 알약 외부 여백(12px) +
                              // 알약 위로 떠 있는 보조 버튼(위치보기/보러가기 등, 약 96px) +
                              // safe-area + 여유.
                              // 콘텐츠 텍스트가 알약 / 보조 버튼 뒤로 숨지 않도록 충분히 확보.
                              paddingBottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))',
                            }}
                          >
                            {renderActionButtons()}
                            {/* 광고 포스트는 본문(닉네임 + 컨텐츠)이 PostActions의 adFooterContent 영역으로
                                이동되어 "보러가기" 버튼 왼쪽에 렌더링되므로 여기서는 중복 렌더링하지 않는다. */}
                            {!isAd && (
                              <div className="space-y-1.5 mb-4 mt-3 cursor-pointer" onClick={onClose}>
                                <div className="flex gap-2 items-start">
                                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{postDisplayName}</span>
                                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                    {renderContentBody()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      {/*
        PostCommentsDialog는 Dialog 트리 밖(형제)로 렌더링한다.
        - Radix Dialog의 FocusScope/outside-interaction이 댓글창 input을 외부로 인식해
          포커스가 막히고 키보드가 올라오지 않는 문제를 해결.
        - PostCommentsDialog 자체가 createPortal로 document.body에 렌더링되므로
          stacking context 문제도 그대로 해결된다.
      */}
      <PostCommentsDialog
        isOpen={isCommentsDialogOpen}
        onOpenChange={setIsCommentsDialogOpen}
        postId={currentPost.id}
        initialComments={localComments}
        authUser={authUser}
        profile={authProfile}
        onCommentsChange={setLocalComments}
      />

      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />

    </>
  );
};

export default PostDetail;