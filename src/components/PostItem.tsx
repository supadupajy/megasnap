"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Navigation, Utensils, Car, TreePine, PawPrint, Send, ChevronDown, ChevronUp, Bookmark, ShoppingBag, AlertCircle, Ban, Trash2, Play, ExternalLink } from 'lucide-react';
import { cn, getYoutubeId } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
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

interface PostItemProps {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    followers?: number;
  };
  content: string;
  location: string;
  likes: number;
  commentsCount: number;
  comments: Comment[];
  image: string;
  images?: string[];
  adImageIndex?: number;
  lat?: number;
  lng?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isAd?: boolean;
  isGif?: boolean;
  isInfluencer?: boolean;
  isViewed?: boolean;
  category?: 'food' | 'accident' | 'place' | 'animal' | 'none';
  borderType?: 'popular' | 'silver' | 'gold' | 'diamond' | 'none';
  disablePulse?: boolean;
  videoUrl?: string;
  youtubeUrl?: string;
  onLikeToggle?: (e: React.MouseEvent) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete?: (postId: string) => void;
  onImageError?: (postId: string) => void;
  onClick?: () => void;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";
const AD_IMAGE = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80"; 
const THIRD_PLACEHOLDER = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80";

const PostItem = ({ 
  id,
  user, 
  content, 
  location, 
  likes: initialLikes, 
  commentsCount: initialCommentsCount = 0,
  comments: initialComments = [],
  image, 
  images = [],
  adImageIndex: initialAdIndex,
  lat,
  lng,
  isLiked: initialIsLiked, 
  isSaved: initialIsSaved,
  isAd, 
  isGif: initialIsGif, 
  isInfluencer,
  isViewed,
  category = 'none',
  borderType = 'none',
  disablePulse = false,
  videoUrl,
  youtubeUrl,
  onLikeToggle,
  onLocationClick,
  onDelete,
  onImageError,
  onClick
}: PostItemProps) => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const { blockUser } = useBlockedUsers();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved || false);
  const [localComments, setLocalComments] = useState<Comment[]>(initialComments || []);
  const [commentInput, setCommentInput] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const youtubeId = getYoutubeId(youtubeUrl || '');
  
  const displayImages = useMemo(() => {
    if (isAd) return [image];
    if (youtubeId) return [image]; 
    
    const img1 = images.length > 0 ? images[0] : image;
    const img3 = (images.length > 1 && images[1] !== AD_IMAGE) ? images[1] : THIRD_PLACEHOLDER;
    return [img1, AD_IMAGE, img3];
  }, [isAd, images, image, youtubeId]);

  const adIndex = 1;
  const isMine = authUser && (user.id === authUser.id || user.id === 'me');

  useEffect(() => {
    if (!(videoUrl || youtubeId)) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setIsPlayingVideo(entry.isIntersecting); },
      { threshold: 0.6 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [videoUrl, youtubeId]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (onImageError) onImageError(id);
    else (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
  };

  useEffect(() => {
    const checkStatus = async () => {
      if (!authUser || !id || !isPersistedPostId(id)) return;
      
      // 좋아요 상태 확인
      const { data: likeData } = await supabase.from('likes').select('id').eq('post_id', id).eq('user_id', authUser.id).maybeSingle();
      if (likeData) setIsLiked(true);

      // 저장 상태 확인
      const { data: saveData } = await supabase.from('saved_posts').select('id').eq('post_id', id).eq('user_id', authUser.id).maybeSingle();
      if (saveData) setIsSaved(true);
    };
    checkStatus();
  }, [authUser, id]);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      if (!isPersistedPostId(id)) {
        setLocalComments(initialComments || []);
        return;
      }

      try {
        const dbComments = await fetchCommentsByPostId(id);
        if (!cancelled) {
          setLocalComments(dbComments);
        }
      } catch (err) {
        console.error('[PostItem] Failed to load comments:', err);
        if (!cancelled) {
          setLocalComments(initialComments || []);
        }
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [id, initialComments]);

  const handleLikeToggleLocal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      if (prevLiked) {
        await supabase.from('likes').delete().eq('post_id', id).eq('user_id', authUser.id);
        await supabase.rpc('decrement_likes', { post_id: id });
      } else {
        await supabase.from('likes').insert({ post_id: id, user_id: authUser.id });
        await supabase.rpc('increment_likes', { post_id: id });
      }
    } catch (err) { setIsLiked(prevLiked); setLikesCount(prevCount); }
    if (onLikeToggle) onLikeToggle(e);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim() || !authUser) return;
    setIsSubmittingComment(true);
    const newCommentText = commentInput.trim();
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    try {
      const savedComment = await insertComment({
        postId: id,
        userId: authUser.id,
        userName: displayName,
        userAvatar: profile?.avatar_url,
        content: newCommentText,
      });
      setLocalComments((prev) => [...prev, savedComment]);
      setCommentInput('');
      showSuccess('댓글이 등록되었습니다.');
    } catch (err: any) {
      console.error('[PostItem] Comment insert failed:', err);
      showError(err.message || '댓글 등록에 실패했습니다.');
    } finally { setIsSubmittingComment(false); }
  };

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setCurrentImageIndex(index);
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMine) navigate('/profile');
    else navigate(`/profile/${user.id}`);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined && onLocationClick) onLocationClick(e, lat, lng);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    if (!isPersistedPostId(id)) { showError('이 포스팅은 저장할 수 없습니다.'); return; }

    const prevSaved = isSaved;
    setIsSaved(!prevSaved);

    try {
      if (prevSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', id).eq('user_id', authUser.id);
        showSuccess('저장이 취소되었습니다.');
      } else {
        await supabase.from('saved_posts').insert({ post_id: id, user_id: authUser.id });
        showSuccess('포스팅을 저장했습니다! ✨');
      }
    } catch (err) {
      setIsSaved(prevSaved);
      showError('저장 처리 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = async () => {
    try {
      if (id.length > 20) {
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (error) throw error;
      }
      showSuccess('포스팅이 삭제되었습니다.');
      if (onDelete) onDelete(id);
    } catch (err) { showError('삭제 중 오류가 발생했습니다.'); } finally { setIsDeleteDialogOpen(false); }
  };

  const renderCategoryBadge = () => {
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

  const getMediaBorderContainerClass = () => {
    if (isMine) return 'my-post-border-container';
    if (isAd) return 'ad-border-container';
    if (borderType === 'popular') return 'popular-border-container';
    if (borderType === 'diamond') return 'diamond-border-container';
    if (borderType === 'gold') return 'gold-border-container';
    if (borderType === 'silver') return 'silver-border-container';
    return '';
  };

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;
  const mediaBorderContainerClass = getMediaBorderContainerClass();
  const hasMediaBorder = mediaBorderContainerClass !== '';

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn(
        "relative bg-white mb-2 last:mb-20 cursor-pointer rounded-[28px] overflow-hidden border border-gray-100 shadow-sm",
        (borderType !== 'none' && !disablePulse) && "animate-influencer-float"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90"><img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover border-2 border-white" onError={(e) => (e.target as HTMLImageElement).src = FALLBACK_IMAGE} /></div>
          <div>
            <div className="flex items-center gap-1.5"><p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{user.name}</p>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5"><MapPin className="w-3 h-3" /><span className="text-[10px] font-medium">{location}</span></div>
          </div>
        </div>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-5 h-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">{isMine ? (<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Trash2 className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">삭제하기</span></DropdownMenuItem>) : (<><DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고가 접수되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu>
      </div>

      <div className="px-4">
        <div className={cn("relative aspect-square w-full rounded-2xl", mediaBorderContainerClass)}>
          <div className={cn("w-full h-full overflow-hidden bg-white relative z-10", hasMediaBorder ? "rounded-[14px]" : "rounded-2xl")}>
            {isPlayingVideo ? (
              youtubeId ? (
                <div className="relative w-full h-full">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&loop=1&playlist=${youtubeId}&controls=1&modestbranding=1&rel=0&origin=${window.location.origin}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                  <button onClick={(e) => { e.stopPropagation(); window.open(youtubeUrl, '_blank'); }} className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-lg border border-white/20 active:scale-95 transition-all z-20"><ExternalLink className="w-3 h-3" /> 유튜브에서 보기</button>
                </div>
              ) : (
                <video src={videoUrl} className="w-full h-full object-cover" controls={true} autoPlay playsInline loop onClick={(e) => e.stopPropagation()} />
              )
            ) : (
              <div className="relative w-full h-full">
                <div ref={scrollRef} onScroll={handleImageScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">{displayImages.map((img, idx) => (<div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative"><img src={img} alt={`post-${idx}`} className="w-full h-full object-cover transition-all duration-700" onError={handleImageError} />{idx === adIndex && !isAd && !youtubeId && <div className="absolute top-4 right-4 z-20 bg-blue-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">AD</div>}</div>))}</div>
                {(videoUrl || youtubeId) && (<div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"><div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"><Play className="w-6 h-6 text-white fill-white ml-1 opacity-50" /></div></div>)}
                {displayImages.length > 1 && !(videoUrl || youtubeId) && (<div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">{displayImages.map((_, idx) => (<div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />))}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4 pt-1.5"><button className="transition-transform active:scale-125" onClick={handleLikeToggleLocal}><Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button><button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button><button onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6 text-gray-700" /></button></div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <button className="transition-transform active:scale-125" onClick={handleSaveToggle}><Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} /></button>
              {renderCategoryBadge()}
              {lat !== undefined && lng !== undefined && (
                <button onClick={handleLocationClick} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100">
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
        <div className="space-y-1"><p className="text-sm font-bold text-gray-500">좋아요 {likesCount.toLocaleString()}개</p><div className="flex gap-2 items-start"><div className="flex items-center gap-1.5 shrink-0"><span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div><p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p></div><form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"><Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={isSubmittingComment} /><button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button></form>{lastComment && (<div className="flex gap-2 items-start mt-1"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>)}<button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><span className="text-xs text-gray-400 font-medium">{localComments.length > 0 ? (showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`) : '댓글이 없습니다.'}</span>{localComments.length > 0 && (showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />)}</button><AnimatePresence>{showComments && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">{localComments.slice(0, -1).map((c, i) => (<div key={i} className="flex gap-2 items-start"><span className="font-bold text-sm text-gray-900">{c.user}</span><span className="text-sm text-gray-500">{c.text}</span></div>))}</motion.div>)}</AnimatePresence></div>
      </div>
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PostItem;

</dyad-file>

<dyad-file path="src/components/PostDetail.tsx">

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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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
      if (post.id.length > 20) { await supabase.from('posts').delete().eq('id', post.id); }
      showSuccess('포스팅이 삭제되었습니다.');
      if (onDelete) onDelete(post.id);
      onClose();
    } catch (err) { showError('삭제 중 오류가 발생했습니다.'); } finally { setIsDeleteDialogOpen(false); }
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
      <div className="absolute top-4 right-6 z-[1100]"><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded-2xl bg-white/80 backdrop-blur-xl hover:bg-white text-indigo-600 shadow-xl border border-white/40 w-11 h-11 active:scale-90 transition-all close-popup-btn"><X className="w-6 h-6 stroke-[2.5px]" /></Button></div>
      <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none p-4">
        <div className="w-full max-w-[420px] h-[82vh] relative pointer-events-auto">
          <div className="w-full h-full flex flex-col bg-white rounded-[40px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative" onClick={onClose}>
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
                    <DropdownMenu><DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><button className="text-gray-400 p-1 outline-none"><MoreHorizontal className="w-5 h-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[1200]">{isMine ? (<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Trash2 className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">삭제하기</span></DropdownMenuItem>) : (<><DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(post.user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu>
                  </div>
                  <div className="px-4">
                    <div ref={videoContainerRef} className={cn("relative aspect-square w-full rounded-2xl", mediaBorderContainerClass)}>
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
                          <button className="transition-transform active:scale-125" onClick={handleSaveToggle}><Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} /></button>
                          {renderCategoryBadge()}
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
                    <div className="border-t border-gray-100 pt-4"><form onSubmit={handleAddComment} className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"><Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={isSubmittingComment} /><button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button></form>{lastComment && <div className="flex gap-2 items-start mt-1 mb-2"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>}<button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="w-full py-1 flex items-center justify-between group"><span className="text-xs text-gray-400 font-medium">{localComments.length > 0 ? (showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`) : '댓글이 없습니다.'}</span>{localComments.length > 0 && (showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />)}</button></div>
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

</dyad-file><dyad-problem-report summary="449 problems">
<problem file="src/components/PostItem.tsx" line="388" column="1" code="1128">Declaration or statement expected.</problem>
<problem file="src/components/PostItem.tsx" line="390" column="2" code="17008">JSX element 'dyad-file' has no corresponding closing tag.</problem>
<problem file="src/components/PostItem.tsx" line="406" column="1" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="415" column="8" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="418" column="16" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="419" column="30" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="420" column="36" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="421" column="49" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="422" column="32" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="423" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="429" column="134" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="430" column="3" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="431" column="15" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="431" column="35" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="437" column="61" code="1003">Identifier expected.</problem>
<problem file="src/components/PostItem.tsx" line="437" column="63" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="444" column="37" code="17008">JSX element 'HTMLDivElement' has no corresponding closing tag.</problem>
<problem file="src/components/PostItem.tsx" line="445" column="33" code="17008">JSX element 'HTMLDivElement' has no corresponding closing tag.</problem>
<problem file="src/components/PostItem.tsx" line="446" column="36" code="17008">JSX element 'HTMLDivElement' has no corresponding closing tag.</problem>
<problem file="src/components/PostItem.tsx" line="448" column="23" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="449" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="450" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="452" column="17" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="453" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="454" column="36" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="460" column="46" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="462" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="463" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="464" column="44" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="464" column="72" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="465" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="467" column="17" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="468" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="470" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="478" column="41" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="479" column="9" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="482" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="484" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="485" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="487" column="17" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="488" column="9" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="491" column="36" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="492" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="494" column="53" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="496" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="499" column="9" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="501" column="39" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="502" column="9" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="503" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="504" column="68" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="506" column="55" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="507" column="9" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="508" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="509" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="512" column="16" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="513" column="23" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="514" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="515" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="517" column="17" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="518" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="520" column="58" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="520" column="101" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="520" column="103" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="520" column="117" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="520" column="123" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="522" column="16" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="523" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="525" column="65" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="526" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="529" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="531" column="57" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="532" column="24" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="538" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="539" column="15" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="544" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="545" column="32" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="548" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="549" column="64" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="551" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="551" column="46" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="551" column="48" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="552" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="561" column="37" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="562" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="566" column="39" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="568" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="573" column="50" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="574" column="24" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="578" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="580" column="57" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="581" column="24" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="582" column="46" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="582" column="56" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="583" column="71" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="583" column="81" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="589" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="590" column="102" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="592" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="593" column="94" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="595" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="596" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="597" column="28" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="599" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="600" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="602" column="35" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="603" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="604" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="604" column="26" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="604" column="89" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="604" column="91" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="608" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="608" column="50" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="608" column="52" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="608" column="92" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="608" column="94" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="609" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="611" column="35" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="612" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="616" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="620" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="623" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="625" column="44" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="626" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="633" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="635" column="44" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="722" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="726" column="3" code="17002">Expected corresponding JSX closing tag for 'HTMLDivElement'.</problem>
<problem file="src/components/PostItem.tsx" line="745" column="2" code="17008">JSX element 'dyad-write' has no corresponding closing tag.</problem>
<problem file="src/components/PostItem.tsx" line="762" column="8" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="762" column="70" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="763" column="8" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="763" column="66" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="764" column="8" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="764" column="70" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="765" column="8" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="765" column="72" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="769" column="9" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="770" column="16" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="771" column="26" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="771" column="48" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="772" column="33" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="773" column="34" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="774" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="776" column="116" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="777" column="3" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="777" column="15" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="777" column="35" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="782" column="60" code="1003">Identifier expected.</problem>
<problem file="src/components/PostItem.tsx" line="782" column="109" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="784" column="17" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="785" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="787" column="73" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="788" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="790" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="792" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="793" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="795" column="17" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="796" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="799" column="32" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="804" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="808" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="810" column="32" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="811" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="820" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="821" column="16" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="831" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="849" column="9" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="850" column="13" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="854" column="21" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="854" column="84" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="869" column="9" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="871" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="872" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="873" column="50" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="875" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="876" column="29" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="877" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="878" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="880" column="36" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="881" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/PostItem.tsx" line="882" column="33" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="883" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="884" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="886" column="90" code="1382">Unexpected token. Did you mean `{'>'}` or `&gt;`?</problem>
<problem file="src/components/PostItem.tsx" line="887" column="29" code="1005">'}' expected.</problem>
<problem file="src/components/PostItem.tsx" line="888" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="973" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&rbrace;`?</problem>
<problem file="src/components/PostItem.tsx" line="975" column="26" code="1005">'</' expected.</problem>
<problem file="src/components/PostItem.tsx" line="9" column="10" code="2866">Import 'Comment' conflicts with global value used in this file, so must be declared with a type-only import when 'isolatedModules' is enabled.</problem>
<problem file="src/components/PostItem.tsx" line="388" column="3" code="2304">Cannot find name 'dyad'.</problem>
<problem file="src/components/PostItem.tsx" line="388" column="3" code="2365">Operator '>' cannot be applied to types 'number' and 'Element'.</problem>
<problem file="src/components/PostItem.tsx" line="388" column="8" code="2552">Cannot find name 'file'. Did you mean 'File'?</problem>
<problem file="src/components/PostItem.tsx" line="390" column="1" code="2339">Property 'dyad-file' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/PostItem.tsx" line="394" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="394" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="394" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="394" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="394" column="46" code="2304">Cannot find name 'useLayoutEffect'.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="395" column="48" code="2304">Cannot find name 'X'.</problem>
<problem file="src/components/PostItem.tsx" line="396" column="10" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="398" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="402" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="402" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="402" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="402" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="407" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="411" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="411" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="415" column="3" code="2304">Cannot find name 'posts'.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2304">Cannot find name 'posts'.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="23" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="30" code="2304">Cannot find name 'initialIndex'.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="44" code="2552">Cannot find name 'isOpen'. Did you mean 'open'?</problem>
<problem file="src/components/PostItem.tsx" line="429" column="52" code="2552">Cannot find name 'onClose'. Did you mean 'onclose'?</problem>
<problem file="src/components/PostItem.tsx" line="429" column="61" code="2304">Cannot find name 'onViewPost'.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="73" code="2304">Cannot find name 'onLikeToggle'.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="87" code="2304">Cannot find name 'onLocationClick'.</problem>
<problem file="src/components/PostItem.tsx" line="429" column="104" code="2304">Cannot find name 'onDelete'.</problem>
<problem file="src/components/PostItem.tsx" line="431" column="11" code="2304">Cannot find name 'user'.</problem>
<problem file="src/components/PostItem.tsx" line="432" column="11" code="2304">Cannot find name 'blockUser'.</problem>
<problem file="src/components/PostItem.tsx" line="437" column="54" code="2786">'Comment' cannot be used as a JSX component.
  Its type '{ new (data?: string): Comment; prototype: Comment; }' is not a valid JSX element type.
    Type '{ new (data?: string): Comment; prototype: Comment; }' is not assignable to type 'new (props: any, deprecatedLegacyContext?: any) => Component<any, any, any>'.
      Type 'CharacterData' is missing the following properties from type 'Component<any, any, any>': context, setState, forceUpdate, render, and 3 more.</problem>
<problem file="src/components/PostItem.tsx" line="444" column="37" code="2786">'HTMLDivElement' cannot be used as a JSX component.
  Its type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not a valid JSX element type.
    Type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not assignable to type 'new (props: any, deprecatedLegacyContext?: any) => Component<any, any, any>'.
      Type 'HTMLDivElement' is missing the following properties from type 'Component<any, any, any>': context, setState, forceUpdate, render, and 3 more.</problem>
<problem file="src/components/PostItem.tsx" line="445" column="33" code="2786">'HTMLDivElement' cannot be used as a JSX component.
  Its type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not a valid JSX element type.
    Type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not assignable to type 'new (props: any, deprecatedLegacyContext?: any) => Component<any, any, any>'.
      Type 'HTMLDivElement' is missing the following properties from type 'Component<any, any, any>': context, setState, forceUpdate, render, and 3 more.</problem>
<problem file="src/components/PostItem.tsx" line="446" column="36" code="2786">'HTMLDivElement' cannot be used as a JSX component.
  Its type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not a valid JSX element type.
    Type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not assignable to type 'new (props: any, deprecatedLegacyContext?: any) => Component<any, any, any>'.
      Type 'HTMLDivElement' is missing the following properties from type 'Component<any, any, any>': context, setState, forceUpdate, render, and 3 more.</problem>
<problem file="src/components/PostItem.tsx" line="454" column="7" code="2304">Cannot find name 'setCurrentIndex'.</problem>
<problem file="src/components/PostItem.tsx" line="454" column="23" code="2304">Cannot find name 'initialIndex'.</problem>
<problem file="src/components/PostItem.tsx" line="460" column="9" code="2304">Cannot find name 'setLocalComments'.</problem>
<problem file="src/components/PostItem.tsx" line="460" column="26" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="464" column="20" code="2304">Cannot find name 'setHasInitialized'.</problem>
<problem file="src/components/PostItem.tsx" line="480" column="17" code="2304">Cannot find name 'data'.</problem>
<problem file="src/components/PostItem.tsx" line="488" column="5" code="2304">Cannot find name 'let'.</problem>
<problem file="src/components/PostItem.tsx" line="494" column="9" code="2304">Cannot find name 'setLocalComments'.</problem>
<problem file="src/components/PostItem.tsx" line="494" column="26" code="2304">Cannot find name 'currentPost'.</problem>
<problem file="src/components/PostItem.tsx" line="501" column="11" code="2304">Cannot find name 'setLocalComments'.</problem>
<problem file="src/components/PostItem.tsx" line="501" column="28" code="2304">Cannot find name 'dbComments'.</problem>
<problem file="src/components/PostItem.tsx" line="504" column="64" code="2304">Cannot find name 'err'.</problem>
<problem file="src/components/PostItem.tsx" line="506" column="11" code="2304">Cannot find name 'setLocalComments'.</problem>
<problem file="src/components/PostItem.tsx" line="506" column="28" code="2304">Cannot find name 'currentPost'.</problem>
<problem file="src/components/PostItem.tsx" line="513" column="7" code="2304">Cannot find name 'cancelled'.</problem>
<problem file="src/components/PostItem.tsx" line="520" column="62" code="2304">Cannot find name 'setIsPlayingVideo'.</problem>
<problem file="src/components/PostItem.tsx" line="520" column="80" code="2304">Cannot find name 'entry'.</problem>
<problem file="src/components/PostItem.tsx" line="520" column="108" code="2304">Cannot find name 'threshold'.</problem>
<problem file="src/components/PostItem.tsx" line="525" column="47" code="2786">'HTMLDivElement' cannot be used as a JSX component.
  Its type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not a valid JSX element type.
    Type '{ new (): HTMLDivElement; prototype: HTMLDivElement; }' is not assignable to type 'new (props: any, deprecatedLegacyContext?: any) => Component<any, any, any>'.
      Type 'HTMLDivElement' is missing the following properties from type 'Component<any, any, any>': context, setState, forceUpdate, render, and 3 more.</problem>
<problem file="src/components/PostItem.tsx" line="532" column="5" code="2304">Cannot find name 'e'.</problem>
<problem file="src/components/PostItem.tsx" line="539" column="9" code="2304">Cannot find name 'postId'.</problem>
<problem file="src/components/PostItem.tsx" line="549" column="60" code="2304">Cannot find name 'err'.</problem>
<problem file="src/components/PostItem.tsx" line="551" column="17" code="2304">Cannot find name 'setIsSubmittingComment'.</problem>
<problem file="src/components/PostItem.tsx" line="574" column="5" code="2304">Cannot find name 'e'.</problem>
<problem file="src/components/PostItem.tsx" line="577" column="31" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="581" column="5" code="2304">Cannot find name 'e'.</problem>
<problem file="src/components/PostItem.tsx" line="590" column="67" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="590" column="90" code="2304">Cannot find name 'authUser'.</problem>
<problem file="src/components/PostItem.tsx" line="593" column="62" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="593" column="80" code="2304">Cannot find name 'authUser'.</problem>
<problem file="src/components/PostItem.tsx" line="597" column="7" code="2304">Cannot find name 'setIsSaved'.</problem>
<problem file="src/components/PostItem.tsx" line="597" column="18" code="2304">Cannot find name 'prevSaved'.</problem>
<problem file="src/components/PostItem.tsx" line="604" column="81" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="608" column="64" code="2304">Cannot find name 'setIsDeleteDialogOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="622" column="130" code="2304">Cannot find name 'bgColor'.</problem>
<problem file="src/components/PostItem.tsx" line="622" column="141" code="2304">Cannot find name 'Icon'.</problem>
<problem file="src/components/PostItem.tsx" line="622" column="215" code="2304">Cannot find name 'label'.</problem>
<problem file="src/components/PostItem.tsx" line="641" column="81" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/PostItem.tsx" line="642" column="57" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="642" column="131" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/PostItem.tsx" line="642" column="320" code="2304">Cannot find name 'X'.</problem>
<problem file="src/components/PostItem.tsx" line="642" column="361" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="645" column="158" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/PostItem.tsx" line="648" column="25" code="2304">Cannot find name 'scrollContainerRef'.</problem>
<problem file="src/components/PostItem.tsx" line="651" column="92" code="2304">Cannot find name 'handleUserClick'.</problem>
<problem file="src/components/PostItem.tsx" line="652" column="170" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="652" column="193" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="654" column="175" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="654" column="195" code="2304">Cannot find name 'isAd'.</problem>
<problem file="src/components/PostItem.tsx" line="655" column="164" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="658" column="352" code="2304">Cannot find name 'isMine'.</problem>
<problem file="src/components/PostItem.tsx" line="658" column="419" code="2304">Cannot find name 'setIsDeleteDialogOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="658" column="1040" code="2304">Cannot find name 'blockUser'.</problem>
<problem file="src/components/PostItem.tsx" line="658" column="1050" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="661" column="31" code="2304">Cannot find name 'videoContainerRef'.</problem>
<problem file="src/components/PostItem.tsx" line="661" column="109" code="2304">Cannot find name 'mediaBorderContainerClass'.</problem>
<problem file="src/components/PostItem.tsx" line="662" column="98" code="2304">Cannot find name 'hasMediaBorder'.</problem>
<problem file="src/components/PostItem.tsx" line="663" column="26" code="2304">Cannot find name 'isPlayingVideo'.</problem>
<problem file="src/components/PostItem.tsx" line="664" column="27" code="2304">Cannot find name 'youtubeId'.</problem>
<problem file="src/components/PostItem.tsx" line="666" column="103" code="2304">Cannot find name 'youtubeId'.</problem>
<problem file="src/components/PostItem.tsx" line="666" column="150" code="2304">Cannot find name 'youtubeId'.</problem>
<problem file="src/components/PostItem.tsx" line="667" column="90" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="670" column="41" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="674" column="39" code="2304">Cannot find name 'imageScrollRef'.</problem>
<problem file="src/components/PostItem.tsx" line="674" column="65" code="2304">Cannot find name 'handleImageScroll'.</problem>
<problem file="src/components/PostItem.tsx" line="674" column="167" code="2304">Cannot find name 'displayImages'.</problem>
<problem file="src/components/PostItem.tsx" line="674" column="459" code="2304">Cannot find name 'adIndex'.</problem>
<problem file="src/components/PostItem.tsx" line="674" column="471" code="2304">Cannot find name 'isAd'.</problem>
<problem file="src/components/PostItem.tsx" line="674" column="480" code="2304">Cannot find name 'youtubeId'.</problem>
<problem file="src/components/PostItem.tsx" line="675" column="31" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="675" column="48" code="2304">Cannot find name 'youtubeId'.</problem>
<problem file="src/components/PostItem.tsx" line="676" column="30" code="2304">Cannot find name 'displayImages'.</problem>
<problem file="src/components/PostItem.tsx" line="676" column="60" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="676" column="77" code="2304">Cannot find name 'youtubeId'.</problem>
<problem file="src/components/PostItem.tsx" line="676" column="176" code="2304">Cannot find name 'displayImages'.</problem>
<problem file="src/components/PostItem.tsx" line="676" column="305" code="2304">Cannot find name 'currentImageIndex'.</problem>
<problem file="src/components/PostItem.tsx" line="684" column="168" code="2304">Cannot find name 'onLikeToggle'.</problem>
<problem file="src/components/PostItem.tsx" line="684" column="183" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="684" column="246" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="684" column="367" code="2304">Cannot find name 'setShowComments'.</problem>
<problem file="src/components/PostItem.tsx" line="684" column="384" code="2304">Cannot find name 'showComments'.</problem>
<problem file="src/components/PostItem.tsx" line="687" column="94" code="2304">Cannot find name 'handleSaveToggle'.</problem>
<problem file="src/components/PostItem.tsx" line="687" column="165" code="2304">Cannot find name 'isSaved'.</problem>
<problem file="src/components/PostItem.tsx" line="688" column="28" code="2304">Cannot find name 'renderCategoryBadge'.</problem>
<problem file="src/components/PostItem.tsx" line="689" column="28" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="689" column="54" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="690" column="76" code="2304">Cannot find name 'onLocationClick'.</problem>
<problem file="src/components/PostItem.tsx" line="690" column="94" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="690" column="104" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="696" column="26" code="2304">Cannot find name 'isAd'.</problem>
<problem file="src/components/PostItem.tsx" line="710" column="77" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/PostItem.tsx" line="710" column="138" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="710" column="343" code="2304">Cannot find name 'handleUserClick'.</problem>
<problem file="src/components/PostItem.tsx" line="710" column="361" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="710" column="429" code="2304">Cannot find name 'post'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="84" code="2304">Cannot find name 'handleAddComment'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="316" code="2304">Cannot find name 'commentInput'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="347" code="2304">Cannot find name 'setCommentInput'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="390" code="2304">Cannot find name 'isSubmittingComment'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="446" code="2304">Cannot find name 'commentInput'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="469" code="2304">Cannot find name 'isSubmittingComment'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="604" code="2304">Cannot find name 'lastComment'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="720" code="2304">Cannot find name 'lastComment'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="798" code="2304">Cannot find name 'lastComment'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="876" code="2304">Cannot find name 'setShowComments'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="893" code="2304">Cannot find name 'showComments'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="1028" code="2304">Cannot find name 'localComments'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="1056" code="2304">Cannot find name 'showComments'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="1087" code="2304">Cannot find name 'localComments'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="1157" code="2304">Cannot find name 'localComments'.</problem>
<problem file="src/components/PostItem.tsx" line="711" column="1186" code="2304">Cannot find name 'showComments'.</problem>
<problem file="src/components/PostItem.tsx" line="719" column="36" code="2304">Cannot find name 'isDeleteDialogOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="719" column="71" code="2304">Cannot find name 'setIsDeleteDialogOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="719" column="112" code="2304">Cannot find name 'confirmDelete'.</problem>
<problem file="src/components/PostItem.tsx" line="726" column="1" code="2339">Property 'dyad-file' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/PostItem.tsx" line="737" column="1" code="2339">Property 'dyad-execute-sql' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/PostItem.tsx" line="739" column="77" code="2339">Property 'dyad-execute-sql' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/PostItem.tsx" line="745" column="1" code="2339">Property 'dyad-write' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/PostItem.tsx" line="748" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="748" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="748" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="748" column="47" code="2304">Cannot find name 'useCallback'.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2304">Cannot find name 'X'.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="749" column="62" code="2304">Cannot find name 'Loader2'.</problem>
<problem file="src/components/PostItem.tsx" line="750" column="10" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="751" column="10" code="2304">Cannot find name 'Textarea'.</problem>
<problem file="src/components/PostItem.tsx" line="756" column="10" code="2304">Cannot find name 'postDraftStore'.</problem>
<problem file="src/components/PostItem.tsx" line="757" column="10" code="2304">Cannot find name 'Post'.</problem>
<problem file="src/components/PostItem.tsx" line="758" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="759" column="10" code="2304">Cannot find name 'resolveOfflineLocationName'.</problem>
<problem file="src/components/PostItem.tsx" line="762" column="5" code="2304">Cannot find name 'key'.</problem>
<problem file="src/components/PostItem.tsx" line="763" column="5" code="2304">Cannot find name 'key'.</problem>
<problem file="src/components/PostItem.tsx" line="764" column="5" code="2304">Cannot find name 'key'.</problem>
<problem file="src/components/PostItem.tsx" line="765" column="5" code="2304">Cannot find name 'key'.</problem>
<problem file="src/components/PostItem.tsx" line="769" column="3" code="2304">Cannot find name 'isOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="771" column="23" code="2304">Cannot find name 'lat'.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="22" code="2304">Cannot find name 'isOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="22" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="22" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="22" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="22" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="30" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="39" code="2304">Cannot find name 'initialLocation'.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="56" code="2304">Cannot find name 'onPostCreated'.</problem>
<problem file="src/components/PostItem.tsx" line="776" column="71" code="2304">Cannot find name 'onStartLocationSelection'.</problem>
<problem file="src/components/PostItem.tsx" line="777" column="11" code="2304">Cannot find name 'user'.</problem>
<problem file="src/components/PostItem.tsx" line="787" column="7" code="2304">Cannot find name 'postDraftStore'.</problem>
<problem file="src/components/PostItem.tsx" line="787" column="28" code="18004">No value exists in scope for the shorthand property 'content'. Either declare one or provide an initializer.</problem>
<problem file="src/components/PostItem.tsx" line="787" column="44" code="2304">Cannot find name 'postDraftStore'.</problem>
<problem file="src/components/PostItem.tsx" line="799" column="7" code="2304">Cannot find name 'setIsLoadingAddress'.</problem>
<problem file="src/components/PostItem.tsx" line="801" column="44" code="2304">Cannot find name 'initialLocation'.</problem>
<problem file="src/components/PostItem.tsx" line="801" column="79" code="2304">Cannot find name 'initialLocation'.</problem>
<problem file="src/components/PostItem.tsx" line="817" column="77" code="2304">Cannot find name 'authUser'.</problem>
<problem file="src/components/PostItem.tsx" line="821" column="9" code="2304">Cannot find name 'content'.</problem>
<problem file="src/components/PostItem.tsx" line="833" column="15" code="2304">Cannot find name 'data'.</problem>
<problem file="src/components/PostItem.tsx" line="833" column="15" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/PostItem.tsx" line="833" column="21" code="2304">Cannot find name 'error'.</problem>
<problem file="src/components/PostItem.tsx" line="850" column="11" code="2304">Cannot find name 'id'.</problem>
<problem file="src/components/PostItem.tsx" line="854" column="19" code="2304">Cannot find name 'id'.</problem>
<problem file="src/components/PostItem.tsx" line="873" column="46" code="2304">Cannot find name 'err'.</problem>
<problem file="src/components/PostItem.tsx" line="876" column="7" code="2304">Cannot find name 'setIsSubmitting'.</problem>
<problem file="src/components/PostItem.tsx" line="882" column="7" code="2304">Cannot find name 'onStartLocationSelection'.</problem>
<problem file="src/components/PostItem.tsx" line="887" column="5" code="2304">Cannot find name 'setSelectedCategory'.</problem>
<problem file="src/components/PostItem.tsx" line="887" column="25" code="2304">Cannot find name 'key'.</problem>
<problem file="src/components/PostItem.tsx" line="893" column="107" code="2304">Cannot find name 'isOpen'.</problem>
<problem file="src/components/PostItem.tsx" line="895" column="26" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/PostItem.tsx" line="896" column="12" code="2304">Cannot find name 'X'.</problem>
<problem file="src/components/PostItem.tsx" line="899" column="10" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="900" column="20" code="2304">Cannot find name 'handlePost'.</problem>
<problem file="src/components/PostItem.tsx" line="901" column="22" code="2304">Cannot find name 'isReadyToPost'.</problem>
<problem file="src/components/PostItem.tsx" line="904" column="12" code="2304">Cannot find name 'isSubmitting'.</problem>
<problem file="src/components/PostItem.tsx" line="904" column="28" code="2304">Cannot find name 'Loader2'.</problem>
<problem file="src/components/PostItem.tsx" line="905" column="11" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="910" column="10" code="2304">Cannot find name 'postDraftStore'.</problem>
<problem file="src/components/PostItem.tsx" line="912" column="23" code="2304">Cannot find name 'postDraftStore'.</problem>
<problem file="src/components/PostItem.tsx" line="914" column="30" code="2304">Cannot find name 'postDraftStore'.</problem>
<problem file="src/components/PostItem.tsx" line="917" column="16" code="2304">Cannot find name 'X'.</problem>
<problem file="src/components/PostItem.tsx" line="923" column="10" code="2304">Cannot find name 'Textarea'.</problem>
<problem file="src/components/PostItem.tsx" line="925" column="18" code="2304">Cannot find name 'content'.</problem>
<problem file="src/components/PostItem.tsx" line="926" column="28" code="2304">Cannot find name 'setContent'.</problem>
<problem file="src/components/PostItem.tsx" line="935" column="56" code="2304">Cannot find name 'initialLocation'.</problem>
<problem file="src/components/PostItem.tsx" line="936" column="18" code="2304">Cannot find name 'isLoadingAddress'.</problem>
<problem file="src/components/PostItem.tsx" line="936" column="52" code="2304">Cannot find name 'address'.</problem>
<problem file="src/components/PostItem.tsx" line="939" column="14" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="940" column="24" code="2304">Cannot find name 'handleSelectLocation'.</problem>
<problem file="src/components/PostItem.tsx" line="945" column="16" code="2304">Cannot find name 'initialLocation'.</problem>
<problem file="src/components/PostItem.tsx" line="946" column="15" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="951" column="14" code="2304">Cannot find name 'CATEGORIES'.</problem>
<problem file="src/components/PostItem.tsx" line="952" column="34" code="2304">Cannot find name 'selectedCategory'.</problem>
<problem file="src/components/PostItem.tsx" line="954" column="18" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/components/PostItem.tsx" line="956" column="34" code="2304">Cannot find name 'handleCategorySelect'.</problem>
<problem file="src/components/PostItem.tsx" line="965" column="19" code="2304">Cannot find name 'Button'.</problem>
</dyad-problem-report>이 오류들은 `src/components/PostItem.tsx` 파일에 `PostDetail.tsx`와 `WritePost.tsx`의 코드가 잘못 삽입되어 발생한 구문 오류(Syntax Error)와, `WritePost` 컴포넌트의 코드가 `PostItem.tsx` 파일의 끝에 잘못 붙어 발생한 오류입니다.

`PostItem.tsx` 파일의 388번째 줄부터 끝까지의 잘못된 코드를 제거하고, `PostItem.tsx`와 `PostDetail.tsx`의 카테고리 뱃지 렌더링 로직을 복구하겠습니다.

### 1. `PostItem.tsx` 수정 (구문 오류 제거 및 카테고리 뱃지 로직 복구)

`PostItem.tsx` 파일의 388번째 줄부터 끝까지의 잘못된 코드를 제거하고, `renderCategoryBadge` 함수가 정상적으로 작동하도록 복구합니다.

<dyad-write path="src/components/PostItem.tsx" description="잘못 삽입된 PostDetail 및 WritePost 코드를 제거하고 카테고리 뱃지 렌더링 로직 복구">
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Navigation, Utensils, Car, TreePine, PawPrint, Send, ChevronDown, ChevronUp, Bookmark, ShoppingBag, AlertCircle, Ban, Trash2, Play, ExternalLink } from 'lucide-react';
import { cn, getYoutubeId } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
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

interface PostItemProps {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    followers?: number;
  };
  content: string;
  location: string;
  likes: number;
  commentsCount: number;
  comments: Comment[];
  image: string;
  images?: string[];
  adImageIndex?: number;
  lat?: number;
  lng?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isAd?: boolean;
  isGif?: boolean;
  isInfluencer?: boolean;
  isViewed?: boolean;
  category?: 'food' | 'accident' | 'place' | 'animal' | 'none';
  borderType?: 'popular' | 'silver' | 'gold' | 'diamond' | 'none';
  disablePulse?: boolean;
  videoUrl?: string;
  youtubeUrl?: string;
  onLikeToggle?: (e: React.MouseEvent) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete?: (postId: string) => void;
  onImageError?: (postId: string) => void;
  onClick?: () => void;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";
const AD_IMAGE = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80"; 
const THIRD_PLACEHOLDER = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80";

const PostItem = ({ 
  id,
  user, 
  content, 
  location, 
  likes: initialLikes, 
  commentsCount: initialCommentsCount = 0,
  comments: initialComments = [],
  image, 
  images = [],
  adImageIndex: initialAdIndex,
  lat,
  lng,
  isLiked: initialIsLiked, 
  isSaved: initialIsSaved,
  isAd, 
  isGif: initialIsGif, 
  isInfluencer,
  isViewed,
  category = 'none',
  borderType = 'none',
  disablePulse = false,
  videoUrl,
  youtubeUrl,
  onLikeToggle,
  onLocationClick,
  onDelete,
  onImageError,
  onClick
}: PostItemProps) => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const { blockUser } = useBlockedUsers();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved || false);
  const [localComments, setLocalComments] = useState<Comment[]>(initialComments || []);
  const [commentInput, setCommentInput] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const youtubeId = getYoutubeId(youtubeUrl || '');
  
  const displayImages = useMemo(() => {
    if (isAd) return [image];
    if (youtubeId) return [image]; 
    
    const img1 = images.length > 0 ? images[0] : image;
    const img3 = (images.length > 1 && images[1] !== AD_IMAGE) ? images[1] : THIRD_PLACEHOLDER;
    return [img1, AD_IMAGE, img3];
  }, [isAd, images, image, youtubeId]);

  const adIndex = 1;
  const isMine = authUser && (user.id === authUser.id || user.id === 'me');

  useEffect(() => {
    if (!(videoUrl || youtubeId)) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setIsPlayingVideo(entry.isIntersecting); },
      { threshold: 0.6 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [videoUrl, youtubeId]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (onImageError) onImageError(id);
    else (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
  };

  useEffect(() => {
    const checkStatus = async () => {
      if (!authUser || !id || !isPersistedPostId(id)) return;
      
      // 좋아요 상태 확인
      const { data: likeData } = await supabase.from('likes').select('id').eq('post_id', id).eq('user_id', authUser.id).maybeSingle();
      if (likeData) setIsLiked(true);

      // 저장 상태 확인
      const { data: saveData } = await supabase.from('saved_posts').select('id').eq('post_id', id).eq('user_id', authUser.id).maybeSingle();
      if (saveData) setIsSaved(true);
    };
    checkStatus();
  }, [authUser, id]);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      if (!isPersistedPostId(id)) {
        setLocalComments(initialComments || []);
        return;
      }

      try {
        const dbComments = await fetchCommentsByPostId(id);
        if (!cancelled) {
          setLocalComments(dbComments);
        }
      } catch (err) {
        console.error('[PostItem] Failed to load comments:', err);
        if (!cancelled) {
          setLocalComments(initialComments || []);
        }
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [id, initialComments]);

  const handleLikeToggleLocal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      if (prevLiked) {
        await supabase.from('likes').delete().eq('post_id', id).eq('user_id', authUser.id);
        await supabase.rpc('decrement_likes', { post_id: id });
      } else {
        await supabase.from('likes').insert({ post_id: id, user_id: authUser.id });
        await supabase.rpc('increment_likes', { post_id: id });
      }
    } catch (err) { setIsLiked(prevLiked); setLikesCount(prevCount); }
    if (onLikeToggle) onLikeToggle(e);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim() || !authUser) return;
    setIsSubmittingComment(true);
    const newCommentText = commentInput.trim();
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    try {
      const savedComment = await insertComment({
        postId: id,
        userId: authUser.id,
        userName: displayName,
        userAvatar: profile?.avatar_url,
        content: newCommentText,
      });
      setLocalComments((prev) => [...prev, savedComment]);
      setCommentInput('');
      showSuccess('댓글이 등록되었습니다.');
    } catch (err: any) {
      console.error('[PostItem] Comment insert failed:', err);
      showError(err.message || '댓글 등록에 실패했습니다.');
    } finally { setIsSubmittingComment(false); }
  };

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setCurrentImageIndex(index);
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMine) navigate('/profile');
    else navigate(`/profile/${user.id}`);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined && onLocationClick) onLocationClick(e, lat, lng);
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    if (!isPersistedPostId(id)) { showError('이 포스팅은 저장할 수 없습니다.'); return; }

    const prevSaved = isSaved;
    setIsSaved(!prevSaved);

    try {
      if (prevSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', id).eq('user_id', authUser.id);
        showSuccess('저장이 취소되었습니다.');
      } else {
        await supabase.from('saved_posts').insert({ post_id: id, user_id: authUser.id });
        showSuccess('포스팅을 저장했습니다! ✨');
      }
    } catch (err) {
      setIsSaved(prevSaved);
      showError('저장 처리 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = async () => {
    try {
      if (id.length > 20) {
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (error) throw error;
      }
      showSuccess('포스팅이 삭제되었습니다.');
      if (onDelete) onDelete(id);
    } catch (err) { showError('삭제 중 오류가 발생했습니다.'); } finally { setIsDeleteDialogOpen(false); }
  };

  const renderCategoryBadge = () => {
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

  const getMediaBorderContainerClass = () => {
    if (isMine) return 'my-post-border-container';
    if (isAd) return 'ad-border-container';
    if (borderType === 'popular') return 'popular-border-container';
    if (borderType === 'diamond') return 'diamond-border-container';
    if (borderType === 'gold') return 'gold-border-container';
    if (borderType === 'silver') return 'silver-border-container';
    return '';
  };

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;
  const mediaBorderContainerClass = getMediaBorderContainerClass();
  const hasMediaBorder = mediaBorderContainerClass !== '';

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn(
        "relative bg-white mb-2 last:mb-20 cursor-pointer rounded-[28px] overflow-hidden border border-gray-100 shadow-sm",
        (borderType !== 'none' && !disablePulse) && "animate-influencer-float"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90"><img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover border-2 border-white" onError={(e) => (e.target as HTMLImageElement).src = FALLBACK_IMAGE} /></div>
          <div>
            <div className="flex items-center gap-1.5"><p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{user.name}</p>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5"><MapPin className="w-3 h-3" /><span className="text-[10px] font-medium">{location}</span></div>
          </div>
        </div>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-5 h-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">{isMine ? (<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Trash2 className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">삭제하기</span></DropdownMenuItem>) : (<><DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고가 접수되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu>
      </div>

      <div className="px-4">
        <div className={cn("relative aspect-square w-full rounded-2xl", mediaBorderContainerClass)}>
          <div className={cn("w-full h-full overflow-hidden bg-white relative z-10", hasMediaBorder ? "rounded-[14px]" : "rounded-2xl")}>
            {isPlayingVideo ? (
              youtubeId ? (
                <div className="relative w-full h-full">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&loop=1&playlist=${youtubeId}&controls=1&modestbranding=1&rel=0&origin=${window.location.origin}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                  <button onClick={(e) => { e.stopPropagation(); window.open(youtubeUrl, '_blank'); }} className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-lg border border-white/20 active:scale-95 transition-all z-20"><ExternalLink className="w-3 h-3" /> 유튜브에서 보기</button>
                </div>
              ) : (
                <video src={videoUrl} className="w-full h-full object-cover" controls={true} autoPlay playsInline loop onClick={(e) => e.stopPropagation()} />
              )
            ) : (
              <div className="relative w-full h-full">
                <div ref={scrollRef} onScroll={handleImageScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">{displayImages.map((img, idx) => (<div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative"><img src={img} alt={`post-${idx}`} className="w-full h-full object-cover transition-all duration-700" onError={handleImageError} />{idx === adIndex && !isAd && !youtubeId && <div className="absolute top-4 right-4 z-20 bg-blue-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">AD</div>}</div>))}</div>
                {(videoUrl || youtubeId) && (<div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"><div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"><Play className="w-6 h-6 text-white fill-white ml-1 opacity-50" /></div></div>)}
                {displayImages.length > 1 && !(videoUrl || youtubeId) && (<div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">{displayImages.map((_, idx) => (<div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />))}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4 pt-1.5"><button className="transition-transform active:scale-125" onClick={handleLikeToggleLocal}><Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button><button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button><button onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6 text-gray-700" /></button></div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <button className="transition-transform active:scale-125" onClick={handleSaveToggle}><Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} /></button>
              {renderCategoryBadge()}
              {lat !== undefined && lng !== undefined && (
                <button onClick={handleLocationClick} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100">
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
        <div className="space-y-1"><p className="text-sm font-bold text-gray-500">좋아요 {likesCount.toLocaleString()}개</p><div className="flex gap-2 items-start"><div className="flex items-center gap-1.5 shrink-0"><span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div><p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p></div><form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"><Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={isSubmittingComment} /><button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button></form>{lastComment && (<div className="flex gap-2 items-start mt-1"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>)}<button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><span className="text-xs text-gray-400 font-medium">{localComments.length > 0 ? (showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`) : '댓글이 없습니다.'}</span>{localComments.length > 0 && (showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />)}</button><AnimatePresence>{showComments && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">{localComments.slice(0, -1).map((c, i) => (<div key={i} className="flex gap-2 items-start"><span className="font-bold text-sm text-gray-900">{c.user}</span><span className="text-sm text-gray-500">{c.text}</span></div>))}</motion.div>)}</AnimatePresence></div>
      </div>
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PostItem;