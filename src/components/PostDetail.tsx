"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Heart, MessageCircle, Share2, MapPin, X, ChevronDown, ChevronUp, Utensils, Car, TreePine, Navigation, PawPrint, Send, Bookmark, MoreHorizontal, ShoppingBag, AlertCircle, Ban, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, getYoutubeId } from '@/lib/utils';
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

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";
const COCA_COLA_AD = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";

const getFallbackImage = (postId: string) => {
  return `https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80`;
};

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onDelete, onViewPost, onLikeToggle, onLocationClick }: PostDetailProps) => {
  const navigate = useNavigate();
  const { user: authUser, profile: authProfile } = useAuth();
  const { blockUser } = useBlockedUsers();
  const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  
  // [FIX] currentPostIndex가 바뀔 때마다 최신 포스트 데이터를 안전하게 참조
  const currentPost = useMemo(() => posts[currentPostIndex], [posts, currentPostIndex]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // [FIX] youtubeId 변수 선언 위치를 상단으로 고정
  const youtubeId = useMemo(() => {
    if (!currentPost) return '';
    return getYoutubeId(currentPost.youtubeUrl || '');
  }, [currentPost]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageScrollRef = useRef<HTMLDivElement>(null);
  
  // 마우스 드래그를 위한 상태
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // 마우스 드래그 핸들러
  const onMouseDown = (e: React.MouseEvent) => {
    if (!imageScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - imageScrollRef.current.offsetLeft);
    setScrollLeft(imageScrollRef.current.scrollLeft);
  };

  const onMouseUp = () => {
    setIsDragging(false);
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
    const walk = (x - startX) * 1.5;
    imageScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 키보드 대응
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
      setShowComments(false);
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
      setShowComments(false);
      setCurrentImageIndex(0);
      setLocalComments(currentPost.comments || []);
      setIsSaved(currentPost.isSaved || false);
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
    if (!isOpen || !currentPost || !(currentPost.videoUrl || getYoutubeId(currentPost.youtubeUrl || ''))) return;
    const observer = new IntersectionObserver(([entry]) => { }, { threshold: 0.6 });
    if (videoContainerRef.current) observer.observe(videoContainerRef.current);
    return () => observer.disconnect();
  }, [currentPostIndex, isOpen, posts]);

  // [FIX] 'Post content 1' 등 텍스트 데이터가 이미지로 인식되는 것을 완전히 차단하는 헬퍼
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

  const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";

  const handleImageError = (postId: string) => {
    console.log(`[PostDetail] Image error for post: ${postId}, using fallback.`);
    setImgErrors(prev => ({ ...prev, [postId]: true }));
  };

  if (!currentPost) return null;

  // [CRITICAL FIX] 이미지 URL 유효성 검사 강화
  const isDummyUrl = (url: any) => {
    if (!url || typeof url !== 'string') return true;
    const clean = url.trim();
    
    // [FIX] 내가 직접 올린 이미지는 절대 더미로 판단하지 않음
    if (clean.includes('supabase.co/storage')) return false;

    // 텍스트가 섞인 비정상 URL 또는 더미 텍스트 감지
    return clean.length < 10 || 
           clean.toLowerCase().includes('post') || 
           clean.toLowerCase().includes('content') || 
           !clean.startsWith('http');
  };

  const displayImage = useMemo(() => {
    if (!currentPost) return getFallbackImage('default');
    if (imgErrors[currentPost.id]) return getFallbackImage(currentPost.id);
    
    // [FIX] post.image_url 필드도 체크
    const rawUrl = currentPost.image || currentPost.image_url;
    return isDummyUrl(rawUrl) ? getFallbackImage(currentPost.id) : rawUrl;
  }, [currentPost, imgErrors]);

  const isAd = currentPost?.isAd || false;
  const COCA_COLA_URL = "https://www.coca-cola.co.kr/";
  const COCA_COLA_IMAGE = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";

  const handleAdClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(COCA_COLA_URL, '_blank', 'noopener,noreferrer');
  };

  // [FIX] 모든 포스트의 두 번째 슬라이드에 코카콜라 광고 삽입
  const displayImages = useMemo(() => {
    if (!currentPost) return [];
    
    let baseImages: string[] = [];
    
    // 1. images 배열 확인
    if (Array.isArray(currentPost.images) && currentPost.images.length > 0) {
      baseImages = currentPost.images.filter((img: any) => !isDummyUrl(img));
    }
    
    // 2. image_url 또는 image 단일 필드 확인
    const singleImg = currentPost.image_url || currentPost.image;
    if (baseImages.length === 0 && singleImg && !isDummyUrl(singleImg)) {
      baseImages = [singleImg];
    }
    
    // 3. 그래도 없으면 계산된 displayImage 사용
    if (baseImages.length === 0) {
      baseImages = [displayImage];
    }
    
    // 코카콜라 광고 삽입 로직
    const imagesWithAd = [...baseImages];
    if (imagesWithAd.length > 0) {
      imagesWithAd.splice(1, 0, COCA_COLA_IMAGE);
    } else {
      imagesWithAd.push(COCA_COLA_IMAGE);
    }
    
    return imagesWithAd;
  }, [currentPost, displayImage]);

  const adLink = useMemo(() => {
    if (!currentPost) return "https://www.coca-cola.co.kr/";
    if (currentPost.content?.includes('나이키') || currentPost.image?.includes('nike'))
      return "https://www.nike.com/kr/";
    return "https://www.coca-cola.co.kr/";
  }, [currentPost]);

  // [CRITICAL FIX] 닉네임 표시 로직
  // use-supabase-posts.ts에서 이미 p.user_name을 우선하도록 가공된 currentPost.user.name을 그대로 사용합니다.
  const postDisplayName = useMemo(() => {
    if (!currentPost) return '익명';
    return currentPost.user.name;
  }, [currentPost]);
  
  const isSeed = useMemo(() => {
    if (!currentPost) return false;
    return currentPost.is_seed_data === true || currentPost.is_seed_data === 'true' || currentPost.is_seed_data === 1;
  }, [currentPost]);

  const isMine = useMemo(() => {
    if (!currentPost || !authUser) return false;
    // 시드 데이터가 아니고, ID가 일치할 때만 본인 포스팅으로 간주
    return (currentPost.user.id === authUser.id || currentPost.user.id === 'me') && !isSeed;
  }, [currentPost, authUser, isSeed]);

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) setCurrentImageIndex(index);
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    // [FIX] isMine 판정을 사용하여 본인 프로필로 갈지 타인 프로필로 갈지 결정
    if (isMine) navigate('/profile');
    else navigate(`/profile/${currentPost.user.id}`);
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
    try {
      if (!currentPost || !currentPost.id) { showError('유효하지 않은 포스팅입니다.'); return; }
      
      // [FIX] 삭제 프로세스 안정화:
      // 1. UI에서 즉시 제거될 수 있도록 핸들러 먼저 호출 (상위에서 setSelectedPostId(null) 수행)
      if (onDelete) onDelete(currentPost.id);
      
      // 2. 모달 즉시 닫기
      onClose();

      // 3. 실제 DB 삭제는 백그라운드에서 진행
      const { error } = await supabase.from('posts').delete().eq('id', currentPost.id);
      if (error) throw error;
      
      showSuccess('포스팅이 삭제되었습니다.');
    } catch (err: any) {
      console.error('[PostDetail] Delete error:', err);
      showError(`삭제 중 오류가 발생했습니다.`);
    } finally {
      setIsDeleteDialogOpen(false);
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
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-start justify-end px-4 pt-3 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 active:scale-90 transition-all"
                >
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
                <div className="w-full h-full flex flex-col bg-white rounded-[30px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative" onClick={onClose}>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full z-[60] opacity-50" />
                  <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white">
                    {/* 헤더 고정 영역 */}
                    <div className="flex items-center justify-between px-4 py-4 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-[55] border-b border-gray-50">
                      <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                        <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
                          <img src={currentPost.user.avatar} alt={postDisplayName} className="w-full h-full rounded-full object-cover border-2 border-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{postDisplayName}</p>
                            {isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}
                          </div>
                          <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5" onClick={handleLocationClick}>
                            <MapPin className="w-3 h-3" />
                            <span className="text-[10px] font-medium hover:underline">{currentPost.location}</span>
                          </div>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-gray-400 p-1 outline-none hover:bg-gray-100 rounded-full transition-colors">
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[1200]">
                            {isMine ? (
                              <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none">
                                <Trash2 className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-bold text-red-600">삭제하기</span>
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none">
                                  <AlertCircle className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-bold text-gray-700">신고</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(currentPost.user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none">
                                  <Ban className="w-4 h-4 text-red-600" />
                                  <span className="text-sm font-bold text-red-600">차단</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain">
                      <div className="flex flex-col">
                        {/* 미디어 영역 - mx-4로 좌우 여백 주어 본문과 넓이 일치 */}
                        <div className="px-4 mt-2">
                          <div className="relative aspect-square rounded-3xl overflow-hidden bg-black shadow-inner">
                            {youtubeId ? (
                              <iframe
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=1&loop=1&playlist=${youtubeId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : currentPost.videoUrl ? (
                              <video src={currentPost.videoUrl} className="w-full h-full object-cover" autoPlay loop playsInline controls />
                            ) : (
                              <div className="absolute inset-0 w-full h-full z-10">
                                {/* 이미지 슬라이더 (영상이 없을 때만 존재) */}
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
                                  {displayImages.map((img, index) => {
                                    const isAdSlide = img === COCA_COLA_IMAGE;
                                    if (isAdSlide) {
                                      return (
                                        <div
                                          key={index}
                                          className="w-full h-full shrink-0 snap-center relative cursor-pointer"
                                          style={{ scrollSnapStop: 'always' }}
                                          onClick={handleAdClick}
                                        >
                                          <img
                                            src={img}
                                            alt="Advertisement"
                                            className="w-full h-full object-cover pointer-events-none"
                                            draggable={false}
                                          />
                                          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-white/20 z-10 pointer-events-none">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span className="font-bold">AD</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div
                                        key={index}
                                        className="w-full h-full shrink-0 snap-center relative"
                                        style={{ scrollSnapStop: 'always' }}
                                        onClick={img === COCA_COLA_AD ? handleAdClick : undefined}
                                      >
                                        <img
                                          src={img}
                                          alt={`Post content ${index + 1}`}
                                          className="w-full h-full object-cover pointer-events-none"
                                          draggable={false}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* 인디케이터 */}
                                {displayImages.length > 1 && (
                                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-30 pointer-events-none">
                                    {displayImages.map((_, i) => (
                                      <div
                                        key={i}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${currentImageIndex === i ? "w-6 bg-white shadow-sm" : "w-1.5 bg-white/40"}`}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 액션 버튼 및 내용 - 아이콘 그룹과 버튼 그룹 분리 */}
                      <div className="px-4 pt-2 pb-4" onClick={(e) => e.stopPropagation()} >
                        <div className="flex flex-col gap-3">
                          {/* 상단: 아이콘 그룹과 기본 뱃지/위치보기 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button className="transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(currentPost.id); }} >
                                <Heart className={cn("w-6 h-6 transition-colors", currentPost.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} >
                                <MessageCircle className="w-6 h-6 text-gray-700" />
                              </button>
                              <button className="text-gray-700" onClick={(e) => e.stopPropagation()} >
                                <Share2 className="w-6 h-6" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button className="transition-transform active:scale-125" onClick={handleSaveToggle} >
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

                          {/* 하단: 광고 전용 주문하기 버튼 (광고일 때만 표시) */}
                          {isAd && (
                            <div className="flex justify-end mt-[-4px]">
                              <a 
                                href="https://s.baemin.com/t3000fBqlbHGL" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={(e) => e.stopPropagation()} 
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-md border border-[#2AC1BC]/20 min-w-[78px]"
                              >
                                <ShoppingBag className="w-3.5 h-3.5 fill-white" />
                                <span className="text-[10px] font-black">주문하기</span>
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 mb-4 mt-3 cursor-pointer" onClick={onClose}>
                          <p className="text-[13px] font-black text-gray-900">좋아요 {currentPost.likes.toLocaleString()}개</p>
                          <div className="flex gap-2 items-start">
                            <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{postDisplayName}</span>
                            <p className="text-gray-800 text-sm leading-snug">{currentPost.content}</p>
                          </div>
                        </div>
                        <div className="border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()} >
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
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation(); 
                              setShowComments(!showComments); 
                            }} 
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
                            className={cn(
                              "overflow-hidden transition-all duration-300 ease-in-out",
                              showComments ? "max-height-[500px] opacity-100 mt-2" : "max-height-0 opacity-0"
                            )}
                            style={{ maxHeight: showComments ? '1000px' : '0px' }}
                          >
                            <div className="space-y-2 pb-2">
                              {localComments.slice(0, -1).map((c, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                  <span className="font-bold text-sm text-gray-900">{c.user}</span>
                                  <span className="text-sm text-gray-500">{c.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {lastComment && (
                            <div className="flex gap-2 items-start mt-1">
                              <span className="font-bold text-sm text-gray-900">{lastComment.user}</span>
                              <span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span>
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

      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default PostDetail;