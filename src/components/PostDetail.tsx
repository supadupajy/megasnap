"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Heart, MessageCircle, Share2, MapPin, X, ChevronDown, ChevronUp, Utensils, Car, TreePine, Navigation, PawPrint, Send, Bookmark, MoreHorizontal, ShoppingBag, AlertCircle, Ban, Trash2, Play, ExternalLink } from 'lucide-react';
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
  onViewPost?: (id: string) => void;
  onLikeToggle?: (postId: string) => void;
  onLocationClick?: (lat: number, lng: number) => void;
  onDelete?: (postId: string) => void;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";
const AD_IMAGE = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80"; 
const THIRD_PLACEHOLDER = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80";

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onViewPost, onLikeToggle, onLocationClick, onDelete }: PostDetailProps) => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const { blockUser } = useBlockedUsers();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // 키보드 대응 뷰포트 핸들러
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;

    const handleViewport = () => {
      const offsetTop = vp.offsetTop ?? 0;
      const heightDiff = window.innerHeight - vp.height - offsetTop;
      const isKeyboardOpen = heightDiff > 100;

      if (isKeyboardOpen) {
        setKeyboardHeight(heightDiff);
      } else {
        setKeyboardHeight(0);
      }
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
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitialized && initialIndex !== -1) {
      setCurrentIndex(initialIndex);
      setHasInitialized(true);
      setShowComments(false);
      setCurrentImageIndex(0);
      const post = posts[initialIndex];
      if (post) { 
        setLocalComments(post.comments || []); 
        setIsSaved(post.isSaved || false); 
      }
    }
    if (!isOpen) { setHasInitialized(false); setIsPlayingVideo(false); }
  }, [isOpen, initialIndex, hasInitialized, posts]);

  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (isOpen && currentPost) {
      if (onViewPost) onViewPost(currentPost.id);
      setShowComments(false);
      setCurrentImageIndex(0);
      setLocalComments(currentPost.comments || []);
      setIsSaved(currentPost.isSaved || false);
      if (imageScrollRef.current) imageScrollRef.current.scrollLeft = 0;

      // 저장 상태 확인
      const checkSaveStatus = async () => {
        if (!authUser || !isPersistedPostId(currentPost.id)) return;
        const { data } = await supabase.from('saved_posts').select('id').eq('post_id', currentPost.id).eq('user_id', authUser.id).maybeSingle();
        setIsSaved(!!data);
      };
      checkSaveStatus();
    }
  }, [currentIndex, isOpen, onViewPost, posts, authUser]);

  useEffect(() => {
    let cancelled = false;
    const currentPost = posts[currentIndex];

    const loadComments = async () => {
      if (!isOpen || !currentPost) return;
      if (!isPersistedPostId(currentPost.id)) {
        setLocalComments(currentPost.comments || []);
        return;
      }

      try {
        const dbComments = await fetchCommentsByPostId(currentPost.id);
        if (!cancelled) {
          setLocalComments(dbComments);
        }
      } catch (err) {
        console.error('[PostDetail] Failed to load comments:', err);
        if (!cancelled) {
          setLocalComments(currentPost.comments || []);
        }
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, isOpen, posts]);

  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (!isOpen || !currentPost || !(currentPost.videoUrl || getYoutubeId(currentPost.youtubeUrl || ''))) return;
    const observer = new IntersectionObserver(([entry]) => { setIsPlayingVideo(entry.isIntersecting); }, { threshold: 0.6 });
    if (videoContainerRef.current) observer.observe(videoContainerRef.current);
    return () => observer.disconnect();
  }, [currentIndex, isOpen, posts]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) setCurrentImageIndex(index);
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim() || !authUser) return;
    setIsSubmittingComment(true);
    const newCommentText = commentInput.trim();
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    try {
      const savedComment = await insertComment({
        postId: post.id,
        userId: authUser.id,
        userName: displayName,
        userAvatar: profile?.avatar_url,
        content: newCommentText,
      });
      setLocalComments((prev) => [...prev, savedComment]);
      setCommentInput('');
      showSuccess('댓글이 등록되었습니다.');
    } catch (err: any) {
      console.error('[PostDetail] Comment insert failed:', err);
      showError(err.message || '댓글 등록에 실패했습니다.');
    } finally { setIsSubmittingComment(false); }
  };

  if (!isOpen || posts.length === 0) return null;
  const post = posts[currentIndex];
  if (!post) return null;

  const isAd = post.isAd;
  const youtubeId = getYoutubeId(post.youtubeUrl || '');
  
  const displayImages = useMemo(() => {
    if (isAd) return [post.image];
    if (youtubeId) return [post.image]; 
    
    // ✅ 1. 사용자가 등록한 전체 이미지 목록(images 배열) 가져오기
    let userImages: string[] = [];
    
    // post.images가 배열인지, 그리고 내용이 있는지 철저히 검사
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      userImages = [...post.images];
    } else if (post.image) {
      // images 배열이 없는 경우를 대비한 Fallback
      userImages = [post.image];
    }
    
    // 2. 코카콜라 광고 이미지 (두 번째 자리에 고정)
    const COCA_COLA_AD = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";
    
    // 3. 이미지 조합 (1번 이미지 -> 광고 -> 나머지 이미지들)
    const result = [];
    if (userImages.length > 0) {
      // 첫 번째 이미지 추가
      result.push(userImages[0]);
      // 두 번째 자리에 광고 추가
      result.push(COCA_COLA_AD);
      // 세 번째 자리부터 나머지 이미지들 추가
      if (userImages.length > 1) {
        result.push(...userImages.slice(1));
      }
    } else {
      // 이미지가 아예 없는 경우 (그럴 일은 거의 없지만)
      result.push(FALLBACK_IMAGE, COCA_COLA_AD);
    }
    
    console.log('[PostDetail] Final display images count:', result.length, result);
    return result;
  }, [isAd, post.images, post.image, youtubeId]);

  const adIndex = 1;
  const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    if (isMine) navigate('/profile');
    else navigate(`/profile/${post.user.id}`);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    if (!isPersistedPostId(post.id)) { showError('이 포스팅은 저장할 수 없습니다.'); return; }

    const prevSaved = isSaved;
    setIsSaved(!prevSaved);

    try {
      if (prevSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', authUser.id);
        showSuccess('저장이 취소되었습니다.');
      } else {
        await supabase.from('saved_posts').insert({ post_id: post.id, user_id: authUser.id });
        showSuccess('포스팅을 저장했습니다! ✨');
      }
    } catch (err) {
      setIsSaved(prevSaved);
      showError('저장 처리 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = async () => {
    try {
      if (!post.id) {
        showError('유효하지 않은 포스팅입니다.');
        return;
      }

      console.log('[PostDetail] Attempting to delete post:', post.id);
      
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) {
        console.error('[PostDetail] Delete query error:', error);
        throw error;
      }

      console.log('[PostDetail] Delete success from DB');
      
      // 1. 성공 메시지 표시
      showSuccess('포스팅이 삭제되었습니다.');
      
      // 2. 다이얼로그 즉시 닫기
      setIsDeleteDialogOpen(false);
      
      // 3. 부모 컴포넌트(Index.tsx)에 삭제 알림 - 여기서 지도의 markers가 업데이트됨
      if (onDelete) {
        console.log('[PostDetail] Calling onDelete callback');
        onDelete(post.id);
      }
      
      // 4. 상세 팝업 닫기
      onClose();
      
    } catch (err: any) { 
      console.error('[PostDetail] Final delete error:', err);
      showError(`삭제 실패: ${err.message || '권한이 없거나 오류가 발생했습니다.'}`); 
      setIsDeleteDialogOpen(false);
    }
  };

  const renderCategoryBadge = () => {
    const category = post.category || 'none';
    if (category === 'none') return null;
    let Icon = null; let bgColor = ""; let label = "";
    switch (category) {
      case 'food': Icon = Utensils; bgColor = "bg-orange-500"; label = "맛집"; break;
      case 'accident': Icon = Car; bgColor = "bg-red-600"; label = "사고"; break;
      case 'place': Icon = TreePine; bgColor = "bg-green-600"; label = "명소"; break;
      case 'animal': Icon = PawPrint; bgColor = "bg-purple-600"; label = "동물"; break;
    }
    if (!Icon) return null;
    return (<div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10", bgColor)}><Icon className="w-3.5 h-3.5" /> <span className="text-[10px] font-black">{label}</span></div>);
  };

  const getMediaBorderContainerClass = () => {
    if (isMine) return 'my-post-border-container';
    if (isAd) return 'ad-border-container';
    if (post.borderType === 'popular') return 'popular-border-container';
    if (post.borderType === 'diamond') return 'diamond-border-container';
    if (post.borderType === 'gold') return 'gold-border-container';
    if (post.borderType === 'silver') return 'silver-border-container';
    return '';
  };

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;
  const mediaBorderContainerClass = getMediaBorderContainerClass();
  const hasMediaBorder = mediaBorderContainerClass !== '';

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Media Carousel - Forced 1:1 Aspect Ratio */}
        <div className="relative w-full aspect-square bg-gray-100 overflow-hidden">
          <div 
            className="flex transition-transform duration-300 ease-out h-full"
            style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
          >
            {allImages.map((img, idx) => (
              <div key={idx} className="w-full h-full flex-shrink-0 relative">
                {post.videoUrl && idx === 0 ? (
                  <video 
                    src={post.videoUrl} 
                    className="w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                  />
                ) : post.youtubeUrl && idx === 0 ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${post.youtubeUrl}?autoplay=1&mute=1&loop=1`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <img 
                    src={img} 
                    alt={`Post image ${idx + 1}`}
                    className="w-full h-full object-cover"
                    style={{ 
                      // 1:1 비율 내에서 원본 포스팅 시 설정한 위치를 보여주기 위해 object-fit: cover 사용
                      aspectRatio: '1/1' 
                    }}
                  />
                )}
                
                {/* Ad Overlay for injected Coca-Cola ad */}
                {idx === 1 && post.id !== 'coca-cola-ad' && (
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm z-10">
                    AD
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4 pt-1.5"><button className="transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(post.id); }}><Heart className={cn("w-6 h-6 transition-colors", post.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button><button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button><button className="text-gray-700" onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6" /></button></div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              {/* 저장 버튼 (북마크) */}
              <button className="transition-transform active:scale-125" onClick={handleSaveToggle}>
                <Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} />
              </button>
              
              {/* 카테고리 뱃지 */}
              {renderCategoryBadge()}
              
              {/* 위치보기 버튼 */}
              {post.lat !== undefined && post.lng !== undefined && (
                <button onClick={(e) => { e.stopPropagation(); onLocationClick?.(post.lat, post.lng); }} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                  <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                  <span className="text-[10px] font-black">위치보기</span>
                </button>
              )}
            </div>
            {isAd && (
              <a 
                href="https://s.baemin.com/t3000fBqlbHGL" 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-sm border border-[#2AC1BC]/20"
              >
                <ShoppingBag className="w-3.5 h-3.5 fill-white" />
                <span className="text-[10px] font-black">주문하기</span>
              </a>
            )}
          </div>
        </div>
        <div className="space-y-1 mb-4 cursor-pointer" onClick={onClose}><p className="text-sm font-bold text-gray-500">좋아요 {post.likes.toLocaleString()}개</p><div className="flex gap-2 items-start"><span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{post.user.name}</span><p className="text-gray-800 text-sm leading-snug">{post.content}</p></div></div>
        <div className="border-t border-gray-100 pt-4">
          <form 
            onSubmit={handleAddComment} 
            className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"
          >
            <Input 
              ref={commentInputRef}
              placeholder="댓글 달기..." 
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" 
              value={commentInput} 
              onChange={(e) => setCommentInput(e.target.value)} 
              disabled={isSubmittingComment} 
            />
            <button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button>
          </form>
          {lastComment && <div className="flex gap-2 items-start mt-1 mb-2"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>}<button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="w-full py-1 flex items-center justify-between group"><span className="text-xs text-gray-400 font-medium">{showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}</span>{showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}</button>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;