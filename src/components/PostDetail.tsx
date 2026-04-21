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
    
    const img1 = post.images?.length ? post.images[0] : post.image;
    const img3 = (post.images?.length > 1 && post.images[1] !== AD_IMAGE) ? post.images[1] : THIRD_PLACEHOLDER;
    return [img1, AD_IMAGE, img3];
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden outline-none">
      <div className="absolute inset-0 bg-black/60 z-0 cursor-pointer" onClick={onClose} />
      <div 
        className="absolute top-5 right-6 z-[1100] transition-transform duration-300"
        style={{ transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)' }}
      >
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded-2xl bg-white/80 backdrop-blur-xl hover:bg-white text-indigo-600 shadow-xl border border-white/40 w-11 h-11 active:scale-90 transition-all close-popup-btn"><X className="w-6 h-6 stroke-[2.5px]" /></Button>
      </div>
      <div 
        className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none px-4 transition-all duration-300 ease-out"
        style={{ 
          paddingTop: '16px',
          paddingBottom: keyboardHeight > 0 ? `${keyboardHeight + 60}px` : '60px',
          transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight / 3}px)` : 'translateY(0)'
        }}
      >
        <div className="w-full max-w-[420px] h-[75vh] max-h-[calc(100vh-144px)] relative pointer-events-auto">
          <div className="w-full h-full flex flex-col bg-white rounded-[30px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative" onClick={onClose}>

            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full z-50 opacity-50" />
            <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white">
              <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between px-4 py-4 shrink-0">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                      <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90"><img src={post.user.avatar} alt={post.user.name} className="w-full h-full rounded-full object-cover border-2 border-white" /></div>
                      <div>
                        <div className="flex items-center gap-1.5"><p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{post.user.name}</p>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div>
                        <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5"><MapPin className="w-3 h-3" /><span className="text-[10px] font-medium">{post.location}</span></div>
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
                            <DropdownMenuItem 
                              onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDeleteDialogOpen(true); 
                              }} 
                              className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-bold text-red-600">삭제하기</span>
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none">
                                <AlertCircle className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-bold text-gray-700">신고</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(post.user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none">
                                <Ban className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-bold text-red-600">차단</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="px-4">
                    <div ref={videoContainerRef} className={cn("relative aspect-[4/3] w-full rounded-2xl", mediaBorderContainerClass)}>
                      <div className={cn("w-full h-full overflow-hidden bg-white relative z-10", hasMediaBorder ? "rounded-[14px]" : "rounded-2xl")}>

                        {isPlayingVideo ? (
                          youtubeId ? (
                            <div className="relative w-full h-full">
                              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&loop=1&playlist=${youtubeId}&controls=1&modestbranding=1&rel=0&origin=${window.location.origin}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                              <button onClick={(e) => { e.stopPropagation(); window.open(post.youtubeUrl, '_blank'); }} className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-lg border border-white/20 active:scale-95 transition-all z-20"><ExternalLink className="w-3 h-3" /> 유튜브에서 보기</button>
                            </div>
                          ) : (
                            <video src={post.videoUrl} className="w-full h-full object-cover" controls={true} autoPlay playsInline loop onClick={(e) => e.stopPropagation()} />
                          )
                        ) : (
                          <div className="relative w-full h-full">
                            <div ref={imageScrollRef} onScroll={handleImageScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">{displayImages.map((img: string, idx: number) => (<div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative"><img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />{idx === adIndex && !isAd && !youtubeId && <div className="absolute top-4 right-4 z-20 bg-blue-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">AD</div>}</div>))}</div>
                            {(post.videoUrl || youtubeId) && (<div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"><div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"><Play className="w-6 h-6 text-white fill-white ml-1 opacity-50" /></div></div>)}
                            {displayImages.length > 1 && !(post.videoUrl || youtubeId) && (<div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">{displayImages.map((_: any, idx: number) => (<div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />))}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pt-3 pb-4" onClick={(e) => e.stopPropagation()}>
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
              </div>
            </div>
          </div>
        </div>
      </div>
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PostDetail;