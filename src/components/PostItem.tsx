"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Post } from '@/types';
import {

  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Navigation,
  Trash2,
  AlertCircle,
  Ban,
  MapPin,
  ShoppingBag,
  Utensils,
  Car,
  TreePine,
  PawPrint,
  Check,
  X,
  Pencil
} from 'lucide-react';
import { cn, getFallbackImage, formatRelativeTime, getOptimizedFeedImage } from '@/lib/utils';

import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from './AuthProvider';

import { supabase } from '@/integrations/supabase/client';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { showSuccess, showError } from '@/utils/toast';
import { fetchCommentsByPostId, isPersistedPostId } from '@/utils/comments';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import PostCommentsDialog from './PostCommentsDialog';
import { useLocationDisplay } from '@/hooks/use-location-display';

import { handleShare } from '@/utils/share';

interface PostItemProps {
  post: Post;
  onLikeToggle: (id: string) => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, content: string) => void;
  onSaveToggle?: (id: string, isSaved: boolean) => void;
  isViewed?: boolean;
  disablePulse?: boolean;
  autoPlayVideo?: boolean;
  isPlaying?: boolean;
}

const PostItem = ({ post, onLikeToggle, onLocationClick, onDelete, onUpdate, onSaveToggle, isViewed, disablePulse, autoPlayVideo, isPlaying = false }: PostItemProps) => {
  const navigate = useNavigate();
  const { user: authUser, profile: authProfile, isAdmin } = useAuth();
  const { blockUser } = useBlockedUsers();
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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [contentExpanded, setContentExpanded] = useState(false);
  const [isContentClamped, setIsContentClamped] = useState(false);
  const [localContent, setLocalContent] = useState(post.content || '');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [isSavingContent, setIsSavingContent] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  // 마우스 드래그를 위한 상태

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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

  // 프로필 이미지: 광고는 로고(object-contain), 일반은 프로필 사진
  const renderAvatar = (size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'md' ? 'w-10 h-10' : 'w-9 h-9';
    const initial = (user.name || '?')[0].toUpperCase();

    if (isAd) {
      // 광고: 흰 배경 원형에 로고 이미지 (object-contain)
      if (avatarError || !user.avatar) {
        return (
          <div className={`${sizeClass} rounded-full bg-white shrink-0 flex items-center justify-center border-2 border-gray-100 shadow-sm`}>
            <span className="text-gray-700 font-black text-[9px] text-center leading-tight px-0.5">{user.name}</span>
          </div>
        );
      }
      return (
        <div className={`${sizeClass} rounded-full bg-white shrink-0 flex items-center justify-center border-2 border-gray-100 shadow-sm overflow-hidden`}>
          <img
            src={user.avatar}
            alt={user.name}
            className="w-full h-full object-contain p-1"
            onError={() => setAvatarError(true)}
          />
        </div>
      );
    }

    // 일반 포스트: 그라디언트 링 + 프로필 사진
    if (avatarError || !user.avatar) {
      return (
        <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shrink-0 flex items-center justify-center border-2 border-white`}>
          <span className="text-white font-bold text-sm">{initial}</span>
        </div>
      );
    }
    return (
      <div className={`${sizeClass} rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 relative`}>
        <img
          src={user.avatar}
          alt={user.name}
          className="w-full h-full rounded-full object-cover border-2 border-white"
          onError={() => setAvatarError(true)}
        />
      </div>
    );
  };

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
    if (!isPersistedPostId(post.id)) return;
    if (post.comments && post.comments.length > 0) {
      commentsFetchedRef.current = true;
      return;
    }
    commentsFetchedRef.current = true;
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
          if (entry.isIntersecting && isReadyToPlay) {
            videoRef.current.play().catch(e => console.error("[PostItem] Video play error:", e));
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
  }, [autoPlayVideo, isReadyToPlay]);

  useEffect(() => {
    if (isVisible && isReadyToPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isVisible, isReadyToPlay]);

  useEffect(() => {
    setLocalContent(post.content || '');
    setEditContent(post.content || '');
    setIsEditingContent(false);
  }, [post.id, post.content]);

  useEffect(() => {
    setIsLiked(post.isLiked);
    setLikesCount(post.likes || 0);
  }, [post.id, post.isLiked, post.likes]);

  const lat = post.latitude ?? post.lat;

  const lng = post.longitude ?? post.lng;

  const displayLocation = useLocationDisplay(post.location || '', lat, lng);

  // 브라우저는 사용자 상호작용 없는 소리 있는 자동 재생을 차단하므로 무음 재생이 필수입니다.

  const renderMedia = () => {
    // 일반 업로드 동영상 처리 (광고는 영상 재생 금지)
    if (!isAd && post.videoUrl) {

      return (
        <div className="relative h-full w-full bg-gray-200">
          <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
          <video
            ref={videoRef}
            src={post.videoUrl}
            className="relative z-[1] w-full h-full object-cover bg-gray-200"
            muted
            loop
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
          />
          {/* 비디오 로드 전이나 화면에 보이지 않을 때만 썸네일 노출 */}
          {(!videoLoaded || !isVisible || !isReadyToPlay) && (
            <img 
              src={currentImage} 
              alt="" 
              className="absolute inset-0 z-10 w-full h-full object-cover bg-gray-200 pointer-events-none"
              onError={handleImageError}
            />
          )}
        </div>
      );
    }

    // 3. 일반 이미지 슬라이더 처리
    return (
      <div className="relative w-full h-full bg-gray-200 group/slider">
        <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
        <div
          ref={imageScrollRef}
          className={cn(
            "relative z-[1] flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar cursor-grab",
            isDragging && "cursor-grabbing snap-none" // 드래그 중에는 스냅 일시 중지하여 부드럽게
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
              className="relative w-full h-full shrink-0 snap-center snap-always bg-gray-200"
            >
              <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
              <img
                src={img}
                alt={`Content ${index}`}
                loading="lazy"
                decoding="async"
                className="relative z-[1] w-full h-full object-cover bg-gray-200 pointer-events-none"
                onError={handleImageError}
              />
            </div>
          ))}
        </div>

        {/* 페이지 인디케이터 (구분자) */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
            {displayImages.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  currentImageIndex === i ? "w-4 bg-white shadow-sm" : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // 이미지 슬라이더 데이터 준비 (피드용 최적화 URL 적용)
  const displayImages = useMemo(() => {
    const baseImages = isAd
      ? [post.image_url || post.image]
      : (Array.isArray(post.images) && post.images.length > 0 ? post.images : [post.image_url || post.image]);
    return baseImages.map((img) => getOptimizedFeedImage(img, post.id));
  }, [post.images, post.image, post.image_url, isAd, post.id]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isDragging) return; // 드래그 중에는 스크롤 이벤트에 의한 인덱스 업데이트 방지 (선택 사항)
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) setCurrentImageIndex(index);
  };

  // 마우스 드래그 핸들러
  const onMouseDown = (e: React.MouseEvent) => {
    if (!imageScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - imageScrollRef.current.offsetLeft);
    setScrollLeft(imageScrollRef.current.scrollLeft);
  };

  const onMouseUp = () => {
    setIsDragging(false);
    // 드래그 종료 시 가장 가까운 슬라이드로 스냅 (CSS snap-type이 이미 적용되어 있음)
    if (imageScrollRef.current) {
      const container = imageScrollRef.current;
      const index = Math.round(container.scrollLeft / container.clientWidth);
      setCurrentImageIndex(index);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - imageScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // 스크롤 속도 조절
    imageScrollRef.current.scrollLeft = scrollLeft - walk;
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
    console.log('[PostItem] Like button clicked for post:', post.id);
    onLikeToggle?.(post.id);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    onSaveToggle?.(post.id, !isSaved);
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMine) {
      navigate('/profile');
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

  const startContentEdit = (e: React.MouseEvent) => {
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
      showSuccess('포스팅이 수정되었습니다.');
    } catch (err) {
      showError('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingContent(false);
    }
  };

  const renderContentBody = () => {
    if (isEditingContent) {
      return (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            disabled={isSavingContent}
            autoFocus
            className="min-h-[88px] resize-none rounded-2xl border-indigo-100 bg-indigo-50/40 text-sm text-gray-900 shadow-inner focus-visible:ring-2 focus-visible:ring-indigo-400"
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

    return (
      <>
        <p ref={contentRef} className={`text-sm text-gray-800 leading-snug ${contentExpanded ? '' : 'line-clamp-2'}`}>{content}</p>
        {!contentExpanded && isContentClamped && (
          <button
            onClick={(e) => { e.stopPropagation(); setContentExpanded(true); }}
            className="text-xs text-gray-400 font-medium mt-0.5 hover:text-gray-600 transition-colors"
          >
            더 보기
          </button>
        )}
      </>
    );
  };

  const renderDropdownMenu = () => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all outline-none" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-2xl p-1.5 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[200] data-[side=bottom]:slide-in-from-top-0 data-[side=top]:slide-in-from-bottom-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0">
        {(isMine || isAdmin) ? (
          <>
            {!isAd && isMine && (
              <DropdownMenuItem onClick={startContentEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-indigo-50 outline-none">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-indigo-600">수정하기</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none">
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="text-sm font-bold text-red-600">삭제하기</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고가 접수되었습니다.'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(user.id); showError('차단되었습니다.'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // 광고 포스트는 createdAt이 항상 현재 시각으로 설정되므로 시간 표시 숨김
  const formattedDate = (!isAd && post.createdAt)
    ? formatRelativeTime(new Date(post.createdAt))
    : null;

  const renderCategoryBadge = () => {
    const category = post.category || 'none';
    if (category === 'none') return null;
    
    let Icon = null;
    let bgColor = "";
    let label = "";

    switch (category) {
      case 'food':
        Icon = Utensils;
        bgColor = "bg-orange-500";
        label = "맛집";
        break;
      case 'accident':
        Icon = Car;
        bgColor = "bg-red-600";
        label = "사고";
        break;
      case 'place':
        Icon = TreePine;
        bgColor = "bg-green-600";
        label = "명소";
        break;
      case 'animal':
        Icon = PawPrint;
        bgColor = "bg-purple-600";
        label = "동물";
        break;
    }

    if (!Icon) return null;

    return (
      <div className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10 shrink-0 whitespace-nowrap leading-none h-auto",
        bgColor
      )}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  const renderInteractionButtons = () => {
    const commentsDisplayCount = Math.max(localComments.length, post.commentsCount || 0);

    return (
      <div className="px-4 pt-3 pb-2 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              className={cn(
                "group inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-black transition-all active:scale-95",
                isLiked
                  ? "border-red-100 bg-red-50 text-red-500 shadow-sm shadow-red-100/50"
                  : "border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100"
              )}
              onClick={handleLikeToggleLocal}
              aria-label={`좋아요 ${likesCount.toLocaleString()}개`}
            >
              <Heart className={cn("h-[18px] w-[18px] transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600')} />
              <span className="tabular-nums leading-none">{likesCount.toLocaleString()}</span>
            </button>
            <button
              onClick={handleCommentClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 text-sm font-black text-gray-700 transition-all hover:bg-gray-100 active:scale-95"
              aria-label={`댓글 ${commentsDisplayCount.toLocaleString()}개`}
            >
              <MessageCircle className="h-[18px] w-[18px] text-gray-600" />
              <span className="tabular-nums leading-none">{commentsDisplayCount.toLocaleString()}</span>
            </button>
            <button
              onClick={(e) => handleShare(e, post.id)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-700 transition-all hover:bg-gray-100 active:scale-95"
              aria-label="공유하기"
            >
              <Share2 className="h-[18px] w-[18px] text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 transition-all hover:bg-gray-100 active:scale-95"
              onClick={handleSaveToggle}
              aria-label="저장하기"
            >
              <Bookmark className={cn("h-[18px] w-[18px] transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-600')} />
            </button>
            {isAd && (
              <a
                href={post.link_url ? (post.link_url.startsWith('http') ? post.link_url : `https://${post.link_url}`) : 'https://s.baemin.com/t3000fBqlbHGL'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-9 items-center justify-center gap-1.5 px-3 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-md border border-[#2AC1BC]/20 shrink-0 whitespace-nowrap"
              >
                <ShoppingBag className="w-3.5 h-3.5 fill-white" />
                <span className="text-[10px] font-black leading-none">보러가기</span>
              </a>
            )}
            {lat !== undefined && lng !== undefined && (
              <button
                onClick={(e) => onLocationClick(e, lat, lng)}
                className="inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-full active:scale-95 transition-all shrink-0 whitespace-nowrap"
                style={{ backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', isolation: 'isolate' }}
              >
                <Navigation className="w-3.5 h-3.5" style={{ fill: '#4f46e5', color: '#4f46e5', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#4f46e5', lineHeight: 1 }}>위치보기</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full max-w-full overflow-x-hidden transition-none",
        !disablePulse && isNewRealtime && "animate-pulse ring-2 ring-indigo-500 ring-offset-2 rounded-2xl"
      )}
    >
      {isAd ? (
        <div className="ad-post-wrapper mx-2 my-1">
          <div className="ad-post-inner">
            {/* Header Section */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                {renderAvatar('md')}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">
                      {user.name}
                    </p>
                    <div className="ad-badge-fancy"><span>AD</span></div>
                  </div>
                  <div className="flex items-center text-indigo-600 gap-0.5 mt-1 cursor-pointer hover:underline" onClick={handleHeaderLocationClick}>
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{displayLocation || '알 수 없는 장소'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {!isAd && renderCategoryBadge()}
                {formattedDate && (
                  <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>
                )}
                {renderDropdownMenu()}
              </div>
            </div>

            {/* Media Section */}
            <div className="relative mx-4 aspect-[3/4] w-auto rounded-2xl overflow-hidden bg-gray-200 group shadow-inner">
              <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
              {renderMedia()}
            </div>

            {renderInteractionButtons()}

            {/* Content Section - AD */}
            <div className="px-4 pt-2 pb-4 space-y-1">
              <div className="flex gap-2 items-start">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {renderContentBody()}
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white">
          {/* Header Section */}
          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
              {renderAvatar('md')}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">
                    {user.name}
                  </p>
                </div>
                <div className="flex items-center text-indigo-600 gap-0.5 mt-1 cursor-pointer hover:underline" onClick={handleHeaderLocationClick}>
                  <MapPin className="w-3 h-3" />
                  <span className="text-[10px] font-medium">{displayLocation || '알 수 없는 장소'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isAd && renderCategoryBadge()}
              {formattedDate && (
                <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>
              )}
              {renderDropdownMenu()}
            </div>
          </div>

          {/* Media Section */}
          <div className="relative mx-4 aspect-[3/4] w-auto rounded-2xl overflow-hidden bg-gray-200 group shadow-inner">
            <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
            {renderMedia()}
          </div>

          {renderInteractionButtons()}

          {/* Content Section - 일반 */}
          <div className="px-4 pt-2 pb-4 space-y-1">
            <div className="flex gap-2 items-start">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>
              </div>
              <div className="flex-1 min-w-0">
                {renderContentBody()}
              </div>
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

export default PostItem;