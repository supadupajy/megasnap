"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Post } from '@/types';
import { getFallbackImage } from '@/lib/utils';
import { handleBrokenImage } from '@/lib/mock-data';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  Navigation, 
  Send, 
  ChevronDown, 
  ChevronUp,
  Trash2,
  AlertCircle,
  Ban,
  MapPin,
  ShoppingBag,
  Utensils,
  Car,
  TreePine,
  PawPrint
} from 'lucide-react';
import { cn, getYoutubeId } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from 'framer-motion';
import { Comment } from '@/types';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { showSuccess, showError } from '@/utils/toast';
import { fetchCommentsByPostId, insertComment, isPersistedPostId } from '@/utils/comments';
import DeleteConfirmDialog from './DeleteConfirmDialog';

const COCA_COLA_AD = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";
const COCA_COLA_URL = "https://www.coca-cola.co.kr/";

interface PostItemProps {
  post: Post;
  onLikeToggle: (id: string) => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete?: (id: string) => void;
  onSaveToggle?: (id: string, isSaved: boolean) => void;
  isViewed?: boolean;
  disablePulse?: boolean;
  autoPlayVideo?: boolean;
}

const PostItem = ({ post, onLikeToggle, onLocationClick, onDelete, onSaveToggle, isViewed, disablePulse, autoPlayVideo }: PostItemProps) => {
  const navigate = useNavigate();
  const { user: authUser, session } = useAuth();
  const { blockUser } = useBlockedUsers();
  const [profile, setProfile] = useState<any>(null);
  
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState(post.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNewRealtime, setIsNewRealtime] = useState(post.isNewRealtime || false);
  const [imgError, setImgError] = useState(false);
  const [currentImage, setCurrentImage] = useState(post.image_url || post.image || getFallbackImage());
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  const { user, content, isAd } = post;
  const isMine = authUser?.id === user.id;

  const handleAdClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(COCA_COLA_URL, '_blank', 'noopener,noreferrer');
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

  // 프로필 정보 가져오기
  useEffect(() => {
    if (authUser?.id) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        if (data) setProfile(data);
      };
      fetchProfile();
    }
  }, [authUser]);

  // Intersection Observer to track visibility
  useEffect(() => {
    if (!autoPlayVideo) return;

    const observer = new IntersectionObserver(
  ([entry]) => {
    setIsVisible(entry.isIntersecting);
  },
  {
    threshold: 0.3,
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
  }, [autoPlayVideo]);

  const lat = post.latitude ?? post.lat;
  const lng = post.longitude ?? post.lng;

  // 유튜브 비디오 ID 추출
  const getYouTubeId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeId(post.youtubeUrl);

  // ✅ [FIX] 유튜브 자동 재생 정책(Autoplay Policy) 준수를 위해 'mute=1' 강제 적용
  // 브라우저는 사용자 상호작용 없는 소리 있는 자동 재생을 차단하므로 무음 재생이 필수입니다.
  const renderMedia = () => {
    // 1. 유튜브 영상 처리
    if (videoId) {
      const shouldPlay = autoPlayVideo && isVisible && isReadyToPlay;
      // ✅ [FIX] mute=0 설정을 통해 소리가 나오도록 변경
      // 오토플레이 정책상 사용자가 페이지와 한 번이라도 상호작용한 후에는 소리가 있는 자동재생이 허용됩니다.
      return (
        <div className="w-full h-full relative">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${shouldPlay ? 1 : 0}&mute=0&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&showinfo=0`}
            className="w-full h-full object-cover"
            allow="autoplay; encrypted-media"
            allowFullScreen
            onLoad={() => setVideoLoaded(true)}
          />
          {(!videoLoaded || !isVisible) && (
            <img 
              src={currentImage} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
            />
          )}
        </div>
      );
    }

    // 2. 일반 업로드 동영상 처리
    if (post.videoUrl) {
      return (
        <div className="w-full h-full relative">
          <video
            src={post.videoUrl}
            className="w-full h-full object-cover"
            autoPlay={autoPlayVideo && isVisible && isReadyToPlay}
            // ✅ [FIX] muted 속성 제거하여 소리 나오게 함
            loop
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
          />
          {/* 비디오 로드 전이나 화면에 보이지 않을 때만 썸네일 노출 */}
          {(!videoLoaded || !isVisible || !isReadyToPlay) && (
            <img 
              src={currentImage} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
              onError={handleImageError}
            />
          )}
        </div>
      );
    }

    // 3. 일반 이미지 슬라이더 처리
    return (
      <div className="relative w-full h-full">
        <div
          ref={imageScrollRef}
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={handleImageScroll}
        >
          {displayImages.map((img, index) => (
            <div 
              key={index} 
              className="w-full h-full shrink-0 snap-center relative"
              onClick={img === COCA_COLA_AD ? handleAdClick : undefined}
            >
              <img
                src={img}
                alt={`Content ${index}`}
                className={cn(
                  "w-full h-full object-cover",
                  img === COCA_COLA_AD && "cursor-pointer"
                )}
                onError={handleImageError}
              />
              {img === COCA_COLA_AD && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-bold z-10 border border-white/20">
                  AD
                </div>
              )}
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

  // 이미지 슬라이더 데이터 준비
  const displayImages = useMemo(() => {
    const baseImages = Array.isArray(post.images) && post.images.length > 0 ? post.images : [post.image_url || post.image];
    
    // [FIX] 광고를 삽입하되 원본 이미지가 누락되지 않도록 로직 수정
    const newImages = [...baseImages];
    // 두 번째 슬라이드(index 1) 위치에 코카콜라 광고 삽입
    newImages.splice(1, 0, COCA_COLA_AD);
    return newImages;
  }, [post.images, post.image, post.image_url]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) setCurrentImageIndex(index);
  };

  const handleImageError = async () => {
    if (imgError) return; // 무한 루프 방지
    
    setImgError(true);
    const fallback = getFallbackImage();
    setCurrentImage(fallback);
    
    // 백엔드에도 깨진 이미지임을 알리고 수정 시도
    if (post.id) {
      await handleBrokenImage(post.id, currentImage);
    }
  };

  useEffect(() => {
    setCurrentImage(post.image_url || post.image || getFallbackImage());
    setImgError(false);
  }, [post.image_url, post.image]);

  const handleLikeToggleLocal = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    if (isMine) navigate('/profile');
    else navigate(`/profile/${user.id}`);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined) {
      onLocationClick?.(e, lat, lng);
    }
  };

  const confirmDelete = async () => {
    if (onDelete) onDelete(post.id);
    setIsDeleteDialogOpen(false);
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim() || !authUser) return;
    setIsSubmittingComment(true);

    const newCommentText = commentInput.trim();
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    
    try {
      const newComment = {
        postId: post.id,
        userId: authUser.id,
        userName: displayName,
        userAvatar: profile?.avatar_url,
        content: newCommentText,
      };

      setLocalComments(prev => [...prev, { user: displayName, text: newCommentText }]);
      setCommentInput('');
      showSuccess('댓글이 등록되었습니다.');
    } catch (err) {
      showError('댓글 등록에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;

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
    return (
      <div className="px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* 상단: 아이콘 그룹과 기본 뱃지/위치보기 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="transition-transform active:scale-125" onClick={handleLikeToggleLocal}>
              <Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="active:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-gray-700" />
            </button>
            <button onClick={(e) => e.stopPropagation()} className="active:scale-110 transition-transform">
              <Share2 className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="transition-transform active:scale-125" onClick={handleSaveToggle}>
              <Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} />
            </button>
            {renderCategoryBadge()}
            {lat !== undefined && lng !== undefined && (
              <button 
                onClick={(e) => onLocationClick(e, lat, lng)} 
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-95 transition-all border border-indigo-100/50 shrink-0 whitespace-nowrap"
              >
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
    );
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "bg-white transition-none",
        !disablePulse && isNewRealtime && "animate-pulse ring-2 ring-indigo-500 ring-offset-2 rounded-2xl"
      )}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
          <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full rounded-full object-cover border-2 border-white"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">
                {user.name}
              </p>
              {isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}
            </div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-1">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-medium">{post.location}</span>
            </div>
          </div>
        </div>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-5 h-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">{isMine ? (<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Trash2 className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">삭제하기</span></DropdownMenuItem>) : (<><DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고가 접수되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu>
      </div>

      {/* Media Section */}
      <div 
        className="relative aspect-square mx-4 rounded-2xl overflow-hidden bg-gray-100 group shadow-inner"
        onClick={() => !videoId && !post.videoUrl && onLocationClick?.({} as any, lat!, lng!)}
      >
        {renderMedia()}
      </div>

      {renderInteractionButtons()}

      {/* Content Section */}
      <div className="px-4 pb-4 space-y-1">
        <p className="text-[13px] font-black text-gray-900">좋아요 {likesCount.toLocaleString()}개</p>
        <div className="flex gap-2 items-start">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>
            {isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}
          </div>
          <p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p>
        </div>
        <form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
          <Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={isSubmittingComment} />
          <button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>

        <button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}>
          <span className="text-xs text-gray-400 font-medium">{showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}</span>
          {showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
        </button>

        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-2 mt-2"
            >
              {localComments.slice(0, -1).map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="font-bold text-sm text-gray-900">{c.user}</span>
                  <span className="text-sm text-gray-500 line-clamp-1">{c.text}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {lastComment && (
          <div className="flex gap-2 items-start mt-1">
            <span className="font-bold text-sm text-gray-900">{lastComment.user}</span>
            <span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span>
          </div>
        )}
      </div>
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PostItem;