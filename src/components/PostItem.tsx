"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { Post } from '@/types';
import {
  MapPin,
  Check,
  X,
  User as UserIcon,
} from 'lucide-react';
import { cn, getFallbackImage, formatRelativeTime, getOptimizedFeedImage } from '@/lib/utils';

import { useLocation, useNavigate } from 'react-router-dom';
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from './AuthProvider';

import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { fetchCommentsByPostId, isPersistedPostId } from '@/utils/comments';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import PostCommentsDialog from './PostCommentsDialog';
import PostActions from './PostActions';
import PostUserAvatar from './PostUserAvatar';
import PostCategoryBadge from './PostCategoryBadge';
import PostMenuDropdown from './PostMenuDropdown';
import ImageSliderDots from './ImageSliderDots';
import HashtagText from './HashtagText';
import PostItemVideo from './PostItemVideo';
import VideoThumbnailPreview from './VideoThumbnailPreview';
import { useLocationDisplay } from '@/hooks/use-location-display';
import { useImageSliderDrag } from '@/hooks/use-image-slider-drag';
import { useKeyboardSafeScroll } from '@/hooks/use-keyboard-safe-scroll';
import { getPostMediaItems } from '@/utils/post-media';
import { useOverlayVisibility } from './OverlayVisibilityProvider';

interface PostItemProps {
  post: Post;
  onLikeToggle: (id: string) => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, content: string) => void;
  onSaveToggle?: (id: string, isSaved: boolean) => void;
  onMediaClick?: (post: Post) => void;
  onOwnUserClick?: () => void;
  isViewed?: boolean;
  disablePulse?: boolean;
  autoPlayVideo?: boolean;
  isPlaying?: boolean;
}

const PostItemInner = ({ post, onLikeToggle, onLocationClick, onDelete, onUpdate, onSaveToggle, onMediaClick, onOwnUserClick, isViewed, disablePulse, autoPlayVideo, isPlaying = false }: PostItemProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile: authProfile, isAdmin, commentedPostIds } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  
  const [localComments, setLocalComments] = useState(post.comments || []);
  const commentsFetchedRef = useRef(false);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNewRealtime, setIsNewRealtime] = useState(post.isNewRealtime || false);
  const [imgError, setImgError] = useState(false);
  const [currentImage, setCurrentImage] = useState(getOptimizedFeedImage(post.image_url || post.image, post.id));
  const [isVisible, setIsVisible] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  // 외부 오버레이(댓글 시트 또는 알림/메시지 전역 오버레이)가 떠 있는 동안 비디오를 잠시 멈추기 위한 상태.
  // 각 PostItem이 window 이벤트를 따로 listen하면 피드에 카드가 100개 있을 때 같은 이벤트에
  // 200개의 리스너가 붙어 모든 카드가 동시에 setState/리렌더링되어 모바일에서 큰 부하를 만든다.
  // → OverlayVisibilityProvider가 앱 전체에서 1번만 listen하고 Context로 공유한다.
  const { isAnyOverlayOpen: isOverlayOpen } = useOverlayVisibility();
  // 오버레이가 열릴 때 비디오가 재생 중이었는지 기억해두고, 닫힐 때 다시 재생
  const wasPlayingBeforeOverlayRef = useRef(false);

  const [contentExpanded, setContentExpanded] = useState(false);
  const [isContentClamped, setIsContentClamped] = useState(false);
  const [localContent, setLocalContent] = useState(post.content || '');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [isSavingContent, setIsSavingContent] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { targetRef: editFormRef } = useKeyboardSafeScroll<HTMLDivElement>(isEditingContent);

  const {
    scrollRef: imageScrollRef,
    currentImageIndex,
    isDragging,
    onScroll: handleImageScroll,
    onMouseDown,
    onMouseUp,
    onMouseMove,
  } = useImageSliderDrag<HTMLDivElement>();

  const { user, isAd } = post;
  const content = localContent;
  
  // owner_id(실제 DB user_id) 또는 post.user_id 기준으로만 내 게시물 여부를 판별합니다.

  const isMine = useMemo(() => {
    if (!authUser?.id) return false;
    // owner_id: mapRawToPost에서 p.user_id로 설정된 실제 소유자 ID
    // post.user_id: 직접 접근 가능한 경우
    const ownerId = post.owner_id || post.user_id;
    return ownerId === authUser.id || ownerId === 'me';
  }, [authUser?.id, post.owner_id, post.user_id]);
  const canEditContent = location.pathname === '/profile';

  const getScrollableParent = (element: HTMLElement) => {
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);
      if (canScroll && parent.scrollHeight > parent.clientHeight) return parent;
      parent = parent.parentElement;
    }
    return null;
  };

  useLayoutEffect(() => {
    if (!isEditingContent) return;

    const form = editFormRef.current;
    const textarea = editTextareaRef.current;
    if (!form || !textarea) return;

    const scrollParent = getScrollableParent(form);
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const topMargin = 96;
      const bottomMargin = 160;
      const overflowTop = formRect.top - parentRect.top - topMargin;
      const overflowBottom = formRect.bottom - (parentRect.bottom - bottomMargin);
      const delta = overflowTop < 0 ? overflowTop : overflowBottom > 0 ? overflowBottom : 0;

      if (Math.abs(delta) > 1) {
        scrollParent.scrollTo({
          top: scrollParent.scrollTop + delta,
          behavior: 'smooth',
        });
      }
    }

    textarea.focus({ preventScroll: true });
  }, [isEditingContent]);

  // 리스트 진입 시 첫 번째 항목의 자동 재생이 누락되는 것을 방지하기 위한 약간의 지연
  useEffect(() => {
    if (autoPlayVideo) {
      const timer = setTimeout(() => {
        setIsReadyToPlay(true);
      }, 500); // 오버레이 애니메이션이 끝나는 시점에 맞춰 활성화
      return () => clearTimeout(timer);
    }
  }, [autoPlayVideo]);

  // 프로필 정보: AuthProvider에서 이미 관리하는 authProfile을 직접 사용
  // 별도 supabase fetch 불필요 (각 PostItem마다 DB 쿼리 발생 방지)
  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  // 댓글 lazy-load: post.comments가 비어있을 때 DB에서 가져옴
  useEffect(() => {
    if (commentsFetchedRef.current) return;
    commentsFetchedRef.current = true;

    if (!isPersistedPostId(post.id)) {
      // 광고 포스트: ad_comments 테이블에서 fetch (hasUserCommented 계산용)
      (async () => {
        try {
          const { data } = await supabase
            .from('ad_comments')
            .select('id, user_id, user_name, content, created_at')
            .eq('ad_id', post.id)
            .order('created_at', { ascending: true });
          if (!data || data.length === 0) return;
          setLocalComments(data.map(row => ({
            id: row.id,
            userId: row.user_id,
            user: row.user_name || '사용자',
            text: row.content,
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            likesCount: 0,
            isLiked: false,
          })));
        } catch {}
      })();
      return;
    }

    if (post.comments && post.comments.length > 0) return;
    fetchCommentsByPostId(post.id).then(dbComments => {
      if (dbComments.length > 0) setLocalComments(dbComments);
    }).catch(() => {});
  }, [post.id]);

  // Intersection Observer to track visibility and control playback
  useEffect(() => {
    if (!autoPlayVideo) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        
        if (videoRef.current) {
          // 외부 오버레이가 떠 있으면 자동 재생을 보류
          if (entry.isIntersecting && isReadyToPlay && !isOverlayOpen) {
            videoRef.current.play().catch(() => {
              if (!videoRef.current) return;
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            });
          } else {
            videoRef.current.pause();
          }
        }

      },
      {
        threshold: 0.6,
        rootMargin: '0px'
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [autoPlayVideo, isReadyToPlay, isOverlayOpen]);

  useEffect(() => {
    if (isVisible && isReadyToPlay && !isOverlayOpen && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isVisible, isReadyToPlay, isOverlayOpen]);

  // 댓글 다이얼로그 또는 알림/메시지 전역 오버레이가 열려있는 동안 비디오를 멈추기 위한 추적.
  // 둘 중 하나라도 열려 있으면 일시정지, 모두 닫히면 재생 재개.
  //
  // isOverlayOpen 자체는 OverlayVisibilityProvider가 Context로 공급하므로,
  // 여기서는 그 값이 바뀌는 순간에만 비디오 상태를 동기화한다.
  useEffect(() => {
    if (!autoPlayVideo) return;

    const video = videoRef.current;
    if (!video) return;

    if (isOverlayOpen) {
      // 오버레이가 열리는 순간: 현재 재생 중이었는지 기록 후 일시정지
      wasPlayingBeforeOverlayRef.current = !video.paused;
      video.pause();
    } else if (wasPlayingBeforeOverlayRef.current && isVisible && isReadyToPlay) {
      // 오버레이가 닫히고 다시 보이는 상태라면 재생 재개
      video.play().catch(() => {});
      wasPlayingBeforeOverlayRef.current = false;
    } else {
      wasPlayingBeforeOverlayRef.current = false;
    }
  }, [autoPlayVideo, isOverlayOpen, isVisible, isReadyToPlay]);

  useEffect(() => {
    setLocalContent(post.content || '');
    setEditContent(post.content || '');
    setIsEditingContent(false);
  }, [post.id, post.content]);

  useEffect(() => {
    setIsLiked(post.isLiked);
    setLikesCount(post.likes || 0);
    setIsSaved(post.isSaved || false);
  }, [post.id, post.isLiked, post.likes, post.isSaved]);

  const lat = post.latitude ?? post.lat;

  const lng = post.longitude ?? post.lng;

  const displayLocation = useLocationDisplay(post.location || '', lat, lng);
  const isLocationMissing = !displayLocation || ['위치 미지정', '위치 정보 없음', '알 수 없는 장소'].includes(displayLocation);

  // 브라우저는 사용자 상호작용 없는 소리 있는 자동 재생을 차단하므로 무음 재생이 필수입니다.

  const displayMedia = useMemo(() => {
    return getPostMediaItems(post).map((item) => (
      item.type === 'image'
        ? { ...item, url: getOptimizedFeedImage(item.url, post.id) }
        : { ...item, posterUrl: item.posterUrl ? getOptimizedFeedImage(item.posterUrl, post.id) : undefined }
    ));
  }, [post]);

  const renderMedia = () => {
    if (displayMedia.length === 1 && displayMedia[0].type === 'video') {
      return (
        <PostItemVideo
          videoRef={videoRef}
          src={displayMedia[0].url}
          posterUrl={displayMedia[0].posterUrl}
          autoPlay={!!autoPlayVideo && isVisible && isReadyToPlay && !isOverlayOpen}
        />
      );
    }

    return (
      <div className="relative w-full h-full bg-neutral-950 group/slider">
        <div className="absolute inset-0 bg-neutral-950" aria-hidden="true" />
        <div
          ref={imageScrollRef}
          className={cn(
            "relative z-[1] flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar cursor-grab",
            isDragging && "cursor-grabbing snap-none"
          )}
          onScroll={handleImageScroll}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {displayMedia.map((media, index) => {
            const backgroundUrl = media.type === 'video' ? media.posterUrl : media.url;

            return (
            <div
              key={`${media.type}-${index}`}
              className="relative w-full h-full shrink-0 snap-center snap-always overflow-hidden bg-neutral-950 bg-cover bg-center"
              style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined }}
            >
              <div className="absolute inset-0 bg-gray-200/0" aria-hidden="true" />
              {media.type === 'video' ? (
                <>
                  <div className="absolute inset-0 z-[1] pointer-events-none">
                    <VideoThumbnailPreview
                      src={media.url}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      startTime={0.8}
                    />
                  </div>
                  {index === currentImageIndex && (
                    <div className="absolute inset-0 z-[2]">
                      <PostItemVideo
                        videoRef={videoRef}
                        src={media.url}
                        posterUrl={media.posterUrl}
                        autoPlay={!!autoPlayVideo && isVisible && isReadyToPlay && !isOverlayOpen}
                        showControls
                      />
                    </div>
                  )}
                </>
              ) : (
                <img
                  src={media.url}
                  alt={`Content ${index}`}
                  loading="lazy"
                  decoding="async"
                  className="relative z-[1] w-full h-full object-cover bg-gray-200 pointer-events-none"
                  onError={handleImageError}
                />
              )}
            </div>
            );
          })}
        </div>

        <ImageSliderDots
          count={displayMedia.length}
          currentIndex={currentImageIndex}
          activeWidthClass="w-4"
          inactiveColorClass="bg-white/50"
          bottomClass={displayMedia.some((media) => media.type === 'video') ? "bottom-[30px]" : "bottom-4"}
          zIndexClass="z-20"
        />
      </div>
    );
  };

  const handleImageError = async () => {
    if (imgError) return;
    setImgError(true);
    setCurrentImage(getFallbackImage());
  };

  useEffect(() => {
    setCurrentImage(getOptimizedFeedImage(post.image_url || post.image, post.id));
    setImgError(false);
  }, [post.image_url, post.image, post.id]);

  // 컨텐츠가 실제로 잘렸는지 DOM 높이로 감지 (여러 타이밍에 측정)
  useEffect(() => {
    if (contentExpanded) return;
    const check = () => {
      const el = contentRef.current;
      if (!el) return;
      setIsContentClamped(el.scrollHeight > el.clientHeight + 2);
    };
    const t1 = setTimeout(check, 50);
    const t2 = setTimeout(check, 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [content, contentExpanded]);

  const handleLikeToggleLocal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLikeToggle?.(post.id);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }

    const prevSaved = isSaved;
    const nextSaved = !prevSaved;
    setIsSaved(nextSaved);

    try {
      if (isPersistedPostId(post.id)) {
        // 일반 포스트: saved_posts 테이블
        if (nextSaved) {
          const { data: existingSaved, error: checkError } = await supabase
            .from('saved_posts')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (checkError) throw checkError;
          if (!existingSaved) {
            const { error } = await supabase
              .from('saved_posts')
              .insert({ post_id: post.id, user_id: authUser.id });
            if (error) throw error;
          }
        } else {
          const { error } = await supabase
            .from('saved_posts')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', authUser.id);
          if (error) throw error;
        }
      } else {
        // 광고 포스트: ad_saved 테이블
        if (nextSaved) {
          const { error } = await supabase
            .from('ad_saved')
            .insert({ ad_id: post.id, user_id: authUser.id });
          // 23505 = unique_violation (이미 저장된 경우 무시)
          if (error && (error as any).code !== '23505') throw error;
        } else {
          const { error } = await supabase
            .from('ad_saved')
            .delete()
            .eq('ad_id', post.id)
            .eq('user_id', authUser.id);
          if (error) throw error;
        }
      }

      showSuccess(nextSaved ? '컨텐츠를 저장했습니다! ✨' : '저장이 취소되었습니다.');
      onSaveToggle?.(post.id, nextSaved);
    } catch (err) {
      console.error('[PostItem] Save toggle error:', err);
      setIsSaved(prevSaved);
      showError('저장 처리 중 오류가 발생했습니다.');
    }
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMine) {
      if (onOwnUserClick) {
        onOwnUserClick();
      } else {
        navigate('/profile');
      }
      return;
    }
    const targetUserId = post.owner_id || post.user_id || user.id;
    const isValidUUID = targetUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    if (isValidUUID) {
      navigate(`/profile/${targetUserId}`);
    }
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined) {
      onLocationClick?.(e, lat, lng);
    }
  };

  const handleHeaderLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined) {
      onLocationClick?.(e, lat, lng);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCommentsDialogOpen(true);
  };

  const confirmDelete = () => {

    setIsDeleteDialogOpen(false);
    // 다음 tick에서 실행해 Radix AlertDialog cleanup이 먼저 완료되도록 함
    setTimeout(() => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
      if (onDelete) onDelete(post.id);
    }, 0);
  };

  const startContentEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setEditContent(localContent);
    setIsEditingContent(true);
    setContentExpanded(true);
  };

  const cancelContentEdit = (e: React.MouseEvent) => {

    e.stopPropagation();
    setEditContent(localContent);
    setIsEditingContent(false);
  };

  const saveContentEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) {
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
        .eq('id', post.id)
        .eq('user_id', authUser.id);
      if (error) throw error;

      setLocalContent(nextContent);
      setEditContent(nextContent);
      setIsEditingContent(false);
      setContentExpanded(false);
      onUpdate?.(post.id, nextContent);
      showSuccess('컨텐츠가 수정되었습니다.');
    } catch (err) {
      showError('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingContent(false);
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
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            disabled={isSavingContent}
            className="min-h-[88px] resize-none rounded-2xl border-indigo-100 bg-indigo-50/40 text-sm text-gray-900 shadow-inner focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={saveContentEdit}
              disabled={isSavingContent || !editContent.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition active:scale-95 disabled:bg-gray-300"
              aria-label="새 컨텐츠"
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

    return (
      <div className="relative">
        <p
          ref={contentRef}
          className={cn(
            'text-sm text-gray-800 leading-snug break-words',
            contentExpanded ? '' : 'line-clamp-2',
            !contentExpanded && isContentClamped ? 'pr-14' : ''
          )}
        >
          <HashtagText text={content} />
        </p>
        {!contentExpanded && isContentClamped && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setContentExpanded(true); }}
            className="absolute bottom-0 right-0 bg-white pl-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            더 보기
          </button>
        )}
      </div>
    );
  };

  const renderDropdownMenu = () => (
    <PostMenuDropdown
      isMine={isMine}
      isAdmin={isAdmin}
      isAd={isAd}
      postOwnerId={user.id}
      zIndexClass="z-[200]"
      onEdit={canEditContent ? startContentEdit : undefined}
      onDelete={() => setIsDeleteDialogOpen(true)}
    />
  );

  // 광고 포스트는 createdAt이 항상 현재 시각으로 설정되므로 시간 표시 숨김
  const formattedDate = (!isAd && post.createdAt)
    ? formatRelativeTime(new Date(post.createdAt))
    : null;

  const showNewPostBadge = !isAd && isViewed === false;

  const renderInteractionButtons = (adFooterContent?: React.ReactNode) => {
    const commentsDisplayCount = Math.max(localComments.length, post.commentsCount || 0);
    const hasUserCommented = !!authUser?.id && (
      commentedPostIds.has(post.id) ||
      localComments.some(comment => comment.userId === authUser.id)
    );

    return (
      <PostActions
        className="px-4 pt-3 pb-2"
        postId={post.id}
        isLiked={isLiked}
        isSaved={isSaved}
        likesCount={likesCount}
        commentsCount={commentsDisplayCount}
        hasUserCommented={hasUserCommented}
        isAd={isAd}
        linkUrl={post.link_url}
        lat={lat}
        lng={lng}
        createdAt={post.createdAt}
        adIcon="shopping-bag"
        adFooterContent={adFooterContent}
        onLikeClick={handleLikeToggleLocal}
        onCommentClick={handleCommentClick}
        onSaveClick={handleSaveToggle}
        onLocationClick={onLocationClick}
      />
    );
  };

  const renderAdFooterContent = () => (
    <div className="flex gap-2 items-start">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>
      </div>
      <div className="flex-1 min-w-0">
        {renderContentBody()}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        // feed-card-cv: 화면 밖 카드의 페인트/레이아웃을 브라우저가 자동으로 건너뛴다.
        // (DOM/이벤트/IntersectionObserver는 그대로 유지되므로 동작에 영향 없음)
        "feed-card-cv w-full max-w-full overflow-x-hidden transition-none",
        !disablePulse && isNewRealtime && "animate-pulse ring-2 ring-indigo-500 ring-offset-2 rounded-2xl"
      )}
    >
      {isAd ? (
        <div className="ad-post-wrapper mx-2 my-1">
          <div className="ad-post-inner">
            {/* Header Section */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                <PostUserAvatar name={user.name} avatar={user.avatar} postId={post.id} userId={user.id} isAd={isAd} size="md" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 py-0.5">
                    <p className="text-sm font-bold text-gray-900 leading-[1.25] group-hover:text-indigo-600 transition-colors">
                      {user.name}
                    </p>
                    <div className="ad-badge-fancy"><span>AD</span></div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-0.5 mt-0.5",
                      isLocationMissing ? "text-gray-400" : "text-indigo-600 cursor-pointer hover:underline"
                    )}
                    onClick={handleHeaderLocationClick}
                  >
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{displayLocation || '알 수 없는 장소'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {!isAd && <PostCategoryBadge category={post.category} />}
                {formattedDate && (
                  <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>
                )}
                {renderDropdownMenu()}
              </div>
            </div>

            {/* Media Section */}
            <div className="relative mx-4 aspect-[9/16] w-auto rounded-2xl overflow-hidden bg-gray-200 group shadow-inner">
              <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
              {renderMedia()}
            </div>

            {renderInteractionButtons(renderAdFooterContent())}
          </div>
        </div>
      ) : (
        <div className="bg-white">
          {/* Header Section */}
          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
              <PostUserAvatar name={user.name} avatar={user.avatar} postId={post.id} userId={user.id} isAd={isAd} size="md" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 py-0.5">
                  <p className="text-sm font-bold text-gray-900 leading-[1.25] group-hover:text-indigo-600 transition-colors">
                    {user.name}
                  </p>
                  {post.isFriendPost && (
                    <span className="inline-flex items-center justify-center h-[1.25em] shrink-0 -translate-y-[2px]" aria-label="친구">
                      <UserIcon className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex items-center gap-0.5 mt-0.5",
                    isLocationMissing ? "text-gray-400" : "text-indigo-600 cursor-pointer hover:underline"
                  )}
                  onClick={handleHeaderLocationClick}
                >
                  <MapPin className="w-3 h-3" />
                  <span className="text-[10px] font-medium">{displayLocation || '알 수 없는 장소'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isAd && <PostCategoryBadge category={post.category} />}
              {formattedDate && (
                <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>
              )}
              {renderDropdownMenu()}
            </div>
          </div>

          {/* Media Section */}
          <div
            className={cn(
              "relative mx-4 aspect-[9/16] w-auto rounded-2xl overflow-hidden bg-gray-200 group shadow-inner",
              onMediaClick && "cursor-pointer"
            )}
            {...(onMediaClick ? {
              onPointerDown: (e: React.PointerEvent) => {
                tapStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
              },
              onPointerUp: (e: React.PointerEvent) => {
                const start = tapStartRef.current;
                tapStartRef.current = null;
                if (!start) return;
                const dx = Math.abs(e.clientX - start.x);
                const dy = Math.abs(e.clientY - start.y);
                const dt = Date.now() - start.t;
                // 짧은 시간 + 작은 이동 = 탭으로 간주 → 풀스크린 진입
                if (dt < 300 && dx < 10 && dy < 10) {
                  onMediaClick(post);
                }
              },
            } : {})}
          >
            <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
            {renderMedia()}
            {showNewPostBadge && (
              <span
                aria-label="새 포스팅"
                className="pointer-events-none absolute right-3 top-3 z-30 rounded-full border-2 border-white bg-yellow-400 px-2.5 py-1 text-[10px] font-black leading-none tracking-[0.08em] text-amber-950 shadow-[0_6px_16px_rgba(234,179,8,0.38)]"
              >
                NEW
              </span>
            )}
          </div>

          {renderInteractionButtons()}

          {/* Content Section - 일반 */}
          <div className="px-4 pt-2 pb-4 space-y-1">
            <div className="min-w-0">
              {renderContentBody()}
            </div>
          </div>
        </div>
      )}
      <PostCommentsDialog
        isOpen={isCommentsDialogOpen}
        onOpenChange={setIsCommentsDialogOpen}
        postId={post.id}
        initialComments={localComments}
        authUser={authUser}
        profile={profile}
        onCommentsChange={setLocalComments}
      />
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

/**
 * PostItem을 React.memo로 감싸 부모(피드 페이지) 리렌더링 시 모든 카드가 따라서
 * 리렌더링되는 것을 막는다. 부모는 좋아요 토글 등으로 매 렌더링마다 새 콜백을 만들지만,
 * 콜백 참조가 바뀌어도 \"보여지는 결과\"는 동일하므로 콜백 prop은 비교에서 제외하고
 * 의미 있는 데이터(post 내용, 표시 상태)만 비교한다.
 *
 * 이 비교는 모든 prop을 깊게 비교하지 않고, 카드가 실제로 다시 그려야 하는
 * 트리거가 되는 필드만 얕게 비교한다 (PostItem 내부의 useEffect들은 자체적으로
 * 필요한 부수 효과를 처리하므로 콜백 참조 변화는 화면에 영향을 주지 않는다).
 */
const arePostItemPropsEqual = (
  prev: PostItemProps,
  next: PostItemProps
): boolean => {
  if (prev.isViewed !== next.isViewed) return false;
  if (prev.disablePulse !== next.disablePulse) return false;
  if (prev.autoPlayVideo !== next.autoPlayVideo) return false;
  if (prev.isPlaying !== next.isPlaying) return false;

  const a = prev.post;
  const b = next.post;
  if (a === b) return true;
  if (!a || !b) return false;

  // 부모가 setPosts로 새 배열을 만들어도, 카드 내용에 영향을 주는 값들이 모두 같다면
  // PostItem은 다시 그릴 필요가 없다.
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.isLiked === b.isLiked &&
    a.isSaved === b.isSaved &&
    a.likes === b.likes &&
    a.commentsCount === b.commentsCount &&
    a.image_url === b.image_url &&
    a.image === b.image &&
    a.videoUrl === b.videoUrl &&
    a.images === b.images &&
    a.videoUrls === b.videoUrls &&
    a.comments === b.comments &&
    a.location === b.location &&
    a.category === b.category &&
    a.isNewRealtime === b.isNewRealtime &&
    a.isFriendPost === b.isFriendPost &&
    a.hasUserCommented === b.hasUserCommented &&
    a.user?.name === b.user?.name &&
    a.user?.avatar === b.user?.avatar &&
    a.user?.id === b.user?.id
  );
};

const PostItem = React.memo(PostItemInner, arePostItemPropsEqual);

export default PostItem;