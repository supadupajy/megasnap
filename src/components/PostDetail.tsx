"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Heart, MessageCircle, Share2, MapPin, X, ChevronDown, ChevronUp, Utensils, Car, TreePine, Navigation, PawPrint, Send, Bookmark, MoreHorizontal, ShoppingBag, AlertCircle, Ban, Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, getFallbackImage } from '@/lib/utils';

import { useNavigate } from 'react-router-dom';
import { Comment } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { showSuccess, showError } from '@/utils/toast';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { fetchCommentsByPostId, insertComment, isPersistedPostId } from '@/utils/comments';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { useLocationDisplay } from '@/hooks/use-location-display';
import { invalidateAdCache } from '@/hooks/use-ad';
import { handleShare } from '@/utils/share';
import { formatRelativeTime } from '@/lib/utils';

interface PostDetailProps {
  posts: any[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (postId: string) => void;
  onViewPost?: (id: string) => void;
  onLikeToggle?: (postId: string) => void;
  onLocationClick?: (lat: number, lng: number) => void;
}

const FALLBACK_IMAGE = "/placeholder.svg";

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onDelete, onViewPost, onLikeToggle, onLocationClick }: PostDetailProps) => {
  const navigate = useNavigate();
  const { user: authUser, profile: authProfile, isAdmin } = useAuth();
  const { blockUser } = useBlockedUsers();
  const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  
  const currentPost = useMemo(() => posts[currentPostIndex], [posts, currentPostIndex]);

  // ── 뒤로가기 버튼으로 닫기 (Android/브라우저 back 버튼) ──────
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // 더미 히스토리 항목 추가 (뒤로가기 시 이 항목이 pop됨)
    history.pushState({ postDetailOpen: true }, '');

    const handlePopState = () => {
      onCloseRef.current?.();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // cleanup에서는 history.back()을 절대 호출하지 않음
      // → history.back()이 popstate를 트리거해 onClose가 재호출되는 무한루프 방지
      // 더미 히스토리 항목은 사용자가 실제로 뒤로가기를 누를 때만 pop됨
      // (모달을 X버튼으로 닫으면 더미 항목이 남지만, 다음 뒤로가기에서 자연스럽게 처리됨)
    };
  }, [isOpen]);

  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const swipeStartXRef = useRef(0);
  const swipeStartYRef = useRef(0);
  const swipeMovedRef = useRef(false);

  useEffect(() => {
    if (!isOpen && !isDeleteDialogOpen) {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
    }
  }, [isOpen, isDeleteDialogOpen]);

  useEffect(() => {
    setAvatarError(false);
  }, [currentPostIndex]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentSectionRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  // 슬라이더 컨테이너 실제 픽셀 너비 측정 (aspect-ratio 계산 타이밍 버그 우회)
  useEffect(() => {
    const el = mediaContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setSliderWidth(w);
    });
    ro.observe(el);
    // 초기값 즉시 설정
    if (el.offsetWidth > 0) setSliderWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [isOpen, currentPostIndex]);

  // 현재 포스트의 모든 이미지를 백그라운드로 미리 로드 (슬라이드 전환 시 즉시 표시)
  useEffect(() => {
    if (!isOpen) return;
    const post = posts[currentPostIndex];
    if (!post) return;
    const imgs: string[] = Array.isArray(post.images) ? post.images : [];
    const single = post.image_url || post.image;
    const allImages = imgs.length > 0 ? imgs : single ? [single] : [];
    allImages.forEach((url) => {
      if (typeof url === 'string' && url.startsWith('http')) {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [isOpen, currentPostIndex, posts]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!imageScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - imageScrollRef.current.offsetLeft);
    setScrollLeft(imageScrollRef.current.scrollLeft);
  };
  const onMouseUp = () => {
    setIsDragging(false);
    if (imageScrollRef.current) {
      const index = Math.round(imageScrollRef.current.scrollLeft / imageScrollRef.current.clientWidth);
      setCurrentImageIndex(index);
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - imageScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    imageScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const handleViewport = () => {
      const offsetTop = vp.offsetTop ?? 0;
      const heightDiff = window.innerHeight - vp.height - offsetTop;
      setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
    };
    vp.addEventListener('resize', handleViewport);
    vp.addEventListener('scroll', handleViewport);
    return () => {
      vp.removeEventListener('resize', handleViewport);
      vp.removeEventListener('scroll', handleViewport);
    };
  }, []);

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
      setLocalComments(currentPost.comments || []);
      setIsSaved(currentPost.isSaved || false);
      setShowComments(false);
      if (imageScrollRef.current) imageScrollRef.current.scrollLeft = 0;

      const checkSaveStatus = async () => {
        if (!authUser || !isPersistedPostId(currentPost.id)) return;
        const { data } = await supabase.from('saved_posts').select('id').eq('post_id', currentPost.id).eq('user_id', authUser.id).maybeSingle();
        setIsSaved(!!data);
      };
      checkSaveStatus();
    }
  }, [currentPostIndex, isOpen, onViewPost, posts, authUser]);

  useEffect(() => {
    let cancelled = false;
    const currentPost = posts[currentPostIndex];
    const loadComments = async () => {
      if (!isOpen || !currentPost) return;
      if (!isPersistedPostId(currentPost.id)) {
        setLocalComments(currentPost.comments || []);
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

  if (!currentPost) return null;

  if (currentPost.isAdPending) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPortal>
          <DialogOverlay className="bg-black/40" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 max-w-[100vw] w-full h-[100dvh] p-0 gap-0 border-none bg-transparent overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
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
                <div className="w-full max-w-[420px] bg-white rounded-[28px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] p-8 flex flex-col items-center gap-5">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
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
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    );
  }

  const isDummyUrl = (url: any) => {
    if (!url || typeof url !== 'string') return true;
    const clean = url.trim();
    // supabase storage URL은 항상 유효한 것으로 처리
    if (clean.includes('supabase.co')) return false;
    // http(s)로 시작하는 URL은 유효한 것으로 처리
    if (clean.startsWith('http')) return false;
    // data URL (base64)도 유효
    if (clean.startsWith('data:')) return false;
    // 절대 경로도 유효
    if (clean.startsWith('/')) return false;
    return true;
  };

  const displayImage = (() => {
    if (!currentPost) return getFallbackImage('default');
    if (imgErrors[currentPost.id]) return getFallbackImage(currentPost.id);
    const rawUrl = currentPost.image || currentPost.image_url;
    return isDummyUrl(rawUrl) ? getFallbackImage(currentPost.id) : rawUrl;
  })();

  const isAd = currentPost?.isAd || false;

  const displayImages = (() => {
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

  const postDisplayName = currentPost?.user?.name || '익명';
  
  const isMine = (() => {
    if (!currentPost || !authUser) return false;
    const ownerId = currentPost.owner_id || currentPost.user_id;
    return ownerId === authUser.id || ownerId === 'me';
  })();

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;

  const formattedDate = currentPost?.createdAt
    ? formatRelativeTime(new Date(currentPost.createdAt))
    : null;

  const displayLocation = useLocationDisplay(
    currentPost?.location || '',
    currentPost?.lat ?? currentPost?.latitude,
    currentPost?.lng ?? currentPost?.longitude
  );

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) setCurrentImageIndex(index);
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMine) {
      onClose();
      navigate('/profile');
      return;
    }
    const targetUserId = currentPost.user.id || currentPost.user_id;
    const isValidUUID = targetUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    if (isValidUUID) {
      onClose();
      navigate(`/profile/${targetUserId}`);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTimeout(() => {
      if (commentSectionRef.current && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const target = commentSectionRef.current;
        const targetTop = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }, 50);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    if (!isPersistedPostId(currentPost.id)) { showError('이 포스팅은 저장할 수 없습니다.'); return; }
    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    try {
      if (prevSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', currentPost.id).eq('user_id', authUser.id);
        showSuccess('저장이 취소되었습니다.');
      } else {
        await supabase.from('saved_posts').insert({ post_id: currentPost.id, user_id: authUser.id });
        showSuccess('포스팅을 저장했습니다! ✨');
      }
    } catch (err) {
      setIsSaved(prevSaved);
      showError('저장 처리 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = async () => {
    if (!currentPost || !currentPost.id) { showError('유효하지 않은 포스팅입니다.'); return; }

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
      showSuccess('포스팅이 삭제되었습니다.');
    } catch (err: any) {
      console.error('[PostDetail] Delete error:', err);
      showError(`삭제 중 오류가 발생했습니다.`);
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim() || !authUser) return;
    setIsSubmittingComment(true);
    const newCommentText = commentInput.trim();
    const displayName = authProfile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    try {
      const savedComment = await insertComment({
        postId: currentPost.id,
        userId: authUser.id,
        userName: displayName,
        userAvatar: authProfile?.avatar_url,
        content: newCommentText,
      });
      setLocalComments((prev) => [...prev, savedComment]);
      setCommentInput('');
      showSuccess('댓글이 등록되었습니다.');
    } catch (err: any) {
      showError(err.message || '댓글 등록에 실패했습니다.');
    } finally { setIsSubmittingComment(false); }
  };

  const renderCategoryBadge = () => {
    const category = currentPost.category || 'none';
    if (category === 'none') return null;
    let Icon = null; let bgColor = ""; let label = "";
    switch (category) {
      case 'food': Icon = Utensils; bgColor = "bg-orange-500"; label = "맛집"; break;
      case 'accident': Icon = Car; bgColor = "bg-red-600"; label = "사고"; break;
      case 'place': Icon = TreePine; bgColor = "bg-green-600"; label = "명소"; break;
      case 'animal': Icon = PawPrint; bgColor = "bg-purple-600"; label = "동물"; break;
    }
    if (!Icon) return null;
    return (
      <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10", bgColor)}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  // 광고: 흰 배경 + object-contain 로고, 일반: 그라디언트 링 + object-cover
  const renderAvatarForAd = () => {
    if (avatarError || !currentPost.user.avatar) {
      return (
        <div className="w-9 h-9 rounded-full bg-white shrink-0 flex items-center justify-center border-2 border-gray-100 shadow-sm transition-transform group-active:scale-90">
          <span className="text-gray-700 font-black text-[9px] text-center leading-tight px-0.5">{postDisplayName}</span>
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-full bg-white shrink-0 flex items-center justify-center border-2 border-gray-100 shadow-sm overflow-hidden transition-transform group-active:scale-90">
        <img src={currentPost.user.avatar} alt={postDisplayName} className="w-full h-full object-contain p-1" onError={() => setAvatarError(true)} />
      </div>
    );
  };

  const renderAvatarForNormal = () => {
    if (avatarError || !currentPost.user.avatar) {
      return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shrink-0 flex items-center justify-center border-2 border-white transition-transform group-active:scale-90">
          <span className="text-white font-bold text-sm">{(postDisplayName || '?')[0].toUpperCase()}</span>
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
        <img src={currentPost.user.avatar} alt={postDisplayName} className="w-full h-full rounded-full object-cover border-2 border-white" onError={() => setAvatarError(true)} />
      </div>
    );
  };

  const renderCommentSection = () => (
    <div ref={commentSectionRef} className="border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
      <form onSubmit={handleAddComment} className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
        <Input
          ref={commentInputRef}
          placeholder="댓글 달기..."
          className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8"
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          disabled={isSubmittingComment}
        />
        <button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </form>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowComments(!showComments); }}
        className="w-full py-1 flex items-center justify-between group cursor-pointer mb-2"
      >
        <span className="text-xs text-gray-400 font-medium pointer-events-none">
          {showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}
        </span>
        {showComments ? 
          <ChevronUp className="w-3.5 h-3.5 text-gray-300 pointer-events-none" /> :
          <ChevronDown className="w-3.5 h-3.5 text-gray-300 pointer-events-none" />
        }
      </button>
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: showComments ? '1000px' : '0px', opacity: showComments ? 1 : 0 }}
      >
        <div className="space-y-2 pb-2">
          {localComments.slice(0, -1).map((c, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="flex gap-2 items-start flex-1 min-w-0">
                <span className="font-bold text-sm text-gray-900 shrink-0">{c.user}</span>
                <span className="text-sm text-gray-500">{c.text}</span>
              </div>
              {c.createdAt && (
                <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                  {formatRelativeTime(new Date(c.createdAt))}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {lastComment && (
        <div className="flex items-start justify-between gap-2 mt-1">
          <div className="flex gap-2 items-start flex-1 min-w-0">
            <span className="font-bold text-sm text-gray-900 shrink-0">{lastComment.user}</span>
            <span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span>
          </div>
          {lastComment.createdAt && (
            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
              {formatRelativeTime(new Date(lastComment.createdAt))}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const renderMediaArea = () => {
    console.log('[PostDetail renderMediaArea]', {
      postId: currentPost.id,
      videoUrl: currentPost.videoUrl,
      isAd: currentPost.isAd,
      currentImageIndex,
      displayImagesLength: displayImages.length,
      displayImages,
      currentImg: displayImages[currentImageIndex],
    });
    if (currentPost.videoUrl && !currentPost.isAd) {
      return (
        <div ref={mediaContainerRef} style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 24, overflow: 'hidden', background: '#000' }}>
          <video
            src={currentPost.videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            autoPlay loop playsInline controls
          />
        </div>
      );
    }

    return (
      <div
        ref={mediaContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 24,
          overflow: 'hidden',
          background: 'red', // 디버그용: 컨테이너 보이는지 확인
          touchAction: 'pan-y',
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          swipeStartXRef.current = t.clientX;
          swipeStartYRef.current = t.clientY;
          swipeMovedRef.current = false;
          console.log('[PostDetail TouchStart]', { x: t.clientX, y: t.clientY });
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          const dx = t.clientX - swipeStartXRef.current;
          const dy = t.clientY - swipeStartYRef.current;
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            swipeMovedRef.current = true;
          }
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          const dx = t.clientX - swipeStartXRef.current;
          console.log('[PostDetail TouchEnd]', { dx, moved: swipeMovedRef.current, currentImageIndex });
          if (!swipeMovedRef.current) return;
          if (dx < -50 && currentImageIndex < displayImages.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
          } else if (dx > 50 && currentImageIndex > 0) {
            setCurrentImageIndex(currentImageIndex - 1);
          }
        }}
      >
        {/* 단일 이미지 렌더링 (가장 단순/안전) */}
        {displayImages[currentImageIndex] ? (
          <img
            src={displayImages[currentImageIndex]}
            alt={`Post content ${currentImageIndex + 1}`}
            className="absolute inset-0 w-full h-full object-cover select-none"
            draggable={false}
            loading="eager"
            onLoad={() => console.log('[PostDetail img onLoad]', { src: displayImages[currentImageIndex] })}
            onError={(e) => {
              console.error('[PostDetail img onError]', { src: displayImages[currentImageIndex] });
              const target = e.currentTarget;
              target.src = '/placeholder.svg';
              target.style.objectFit = 'contain';
              target.style.padding = '20%';
              target.style.opacity = '0.3';
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-red-600 text-xs font-bold">
            NO IMG (idx={currentImageIndex}, len={displayImages.length})
          </div>
        )}

        {displayImages.length > 1 && (
          <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 30, pointerEvents: 'none' }}>
            {displayImages.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'white',
                  opacity: currentImageIndex === i ? 1 : 0.4,
                  width: currentImageIndex === i ? 24 : 6,
                  transition: 'all 0.3s',
                  boxShadow: currentImageIndex === i ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderActionButtons = () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(currentPost.id); }}>
            <Heart className={cn("w-6 h-6 transition-colors", currentPost.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
          </button>
          <button onClick={handleCommentClick} className="active:scale-110 transition-transform">
            <MessageCircle className="w-6 h-6 text-gray-700" />
          </button>
          <button className="text-gray-700 active:scale-110 transition-transform" onClick={(e) => handleShare(e, currentPost.id)}>
            <Share2 className="w-6 h-6" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="transition-transform active:scale-125" onClick={handleSaveToggle}>
            <Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} />
          </button>
          {renderCategoryBadge()}
          {currentPost.lat !== undefined && currentPost.lng !== undefined && (
            <button onClick={(e) => { e.stopPropagation(); onLocationClick?.(currentPost.lat, currentPost.lng); }} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100/50 hover:bg-indigo-100 active:scale-95 transition-all">
              <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
              <span className="text-[10px] font-black">위치보기</span>
            </button>
          )}
        </div>
      </div>
      {isAd && (
        <div className="flex justify-end mt-[-4px]">
          <a
            href={currentPost.link_url ? (currentPost.link_url.startsWith('http') ? currentPost.link_url : `https://${currentPost.link_url}`) : 'https://s.baemin.com/t3000fBqlbHGL'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-md border border-[#2AC1BC]/20 min-w-[78px]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black">상세정보</span>
          </a>
        </div>
      )}
    </div>
  );

  const renderDropdownMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all outline-none">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 rounded-2xl p-1.5 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[1200]">
        {(isMine || isAdmin) ? (
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none">
            <Trash2 className="w-4 h-4 text-red-600" />
            <span className="text-sm font-bold text-red-600">삭제하기</span>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고되었습니다.'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-gray-50 outline-none">
              <AlertCircle className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-bold text-gray-700">신고</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(currentPost.user.id); showError('차단되었습니다.'); onClose(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none">
              <Ban className="w-4 h-4 text-red-600" />
              <span className="text-sm font-bold text-red-600">차단</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPortal>
          <DialogOverlay className="bg-black/40" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 max-w-[100vw] w-full h-[100dvh] p-0 gap-0 border-none bg-transparent overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <VisuallyHidden.Root>
              <DialogTitle>포스트 상세 보기</DialogTitle>
              <DialogDescription>선택한 포스트의 상세 내용과 댓글을 확인할 수 있는 화면입니다.</DialogDescription>
            </VisuallyHidden.Root>
            
            <div className="relative flex-1 flex flex-col min-h-0">
              {/* 닫기 버튼 */}
              <div className="absolute top-0 left-0 right-0 z-50 flex items-start justify-end px-4 pt-7 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 active:scale-90 transition-all">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div
                className="relative w-full h-full flex items-center justify-center pointer-events-none px-4 transition-all duration-500"
                style={{
                  paddingTop: '16px',
                  paddingBottom: keyboardHeight > 0 ? `${keyboardHeight + 20}px` : '60px',
                  transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight / 2.5}px)` : 'translateY(0)'
                }}
              >
                <div className="w-full max-w-[420px] h-[75vh] max-h-[calc(100vh-144px)] relative pointer-events-auto">
                  {isAd ? (
                    /* ===== 광고 포스트 ===== */
                    <div className="ad-post-wrapper w-full h-full">
                      <div className="ad-post-inner w-full h-full flex flex-col bg-white rounded-[28px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative" onClick={onClose}>
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full z-[60] opacity-50" />
                        <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white">
                          {/* 헤더 */}
                          <div className="flex items-center justify-between px-4 py-4 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-[55] border-b border-gray-50">
                            <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                              {renderAvatarForAd()}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{postDisplayName}</p>
                                  <div className="ad-badge-fancy"><span>AD</span></div>
                                </div>
                                <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5" onClick={handleLocationClick}>
                                  <MapPin className="w-3 h-3" />
                                  <span className="text-[10px] font-medium hover:underline">{displayLocation || '알 수 없는 장소'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {formattedDate && <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>}
                              {renderDropdownMenu()}
                            </div>
                          </div>

                          <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain">
                            <div className="flex flex-col">
                              <div className="px-4 mt-2">
                                {renderMediaArea()}
                              </div>
                            </div>

                            <div className="px-4 pt-2 pb-4" onClick={(e) => e.stopPropagation()}>
                              {renderActionButtons()}
                              <div className="space-y-1.5 mb-4 mt-3 cursor-pointer" onClick={onClose}>
                                <p className="text-[13px] font-black text-gray-900">좋아요 {currentPost.likes.toLocaleString()}개</p>
                                <div className="flex gap-2 items-start">
                                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{postDisplayName}</span>
                                  <p className="text-gray-800 text-sm leading-snug">{currentPost.content}</p>
                                </div>
                              </div>
                              {renderCommentSection()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ===== 일반 포스트 ===== */
                    <div className="w-full h-full flex flex-col bg-white rounded-[30px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative" onClick={onClose}>
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full z-[60] opacity-50" />
                      <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-4 py-4 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-[55] border-b border-gray-50">
                          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                            {renderAvatarForNormal()}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{postDisplayName}</p>
                              </div>
                              <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5" onClick={handleLocationClick}>
                                <MapPin className="w-3 h-3" />
                                <span className="text-[10px] font-medium hover:underline">{displayLocation || '알 수 없는 장소'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {formattedDate && <span className="text-[11px] font-medium text-gray-500 shrink-0">{formattedDate}</span>}
                            {renderDropdownMenu()}
                          </div>
                        </div>

                        <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain">
                          <div className="flex flex-col">
                            <div className="px-4 mt-2">
                              {renderMediaArea()}
                            </div>
                          </div>

                          <div className="px-4 pt-2 pb-4" onClick={(e) => e.stopPropagation()}>
                            {renderActionButtons()}
                            <div className="space-y-1.5 mb-4 mt-3 cursor-pointer" onClick={onClose}>
                              <p className="text-[13px] font-black text-gray-900">좋아요 {currentPost.likes.toLocaleString()}개</p>
                              <div className="flex gap-2 items-start">
                                <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{postDisplayName}</span>
                                <p className="text-gray-800 text-sm leading-snug">{currentPost.content}</p>
                              </div>
                            </div>
                            {renderCommentSection()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default PostDetail;