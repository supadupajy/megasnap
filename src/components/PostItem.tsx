"use client";

import React, { useState, useEffect } from 'react';
import { Post } from '@/types';
import { getFallbackImage } from '@/lib/utils';
import { handleBrokenImage } from '@/lib/mock-data';
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
  const [imgError, setImgError] = useState(false);
  const [currentImage, setCurrentImage] = useState(post.image_url || post.image || getFallbackImage());
  const [videoLoaded, setVideoLoaded] = useState(false);

  const lat = post.latitude ?? post.lat;
  const lng = post.longitude ?? post.lng;

  // 유튜브 비디오 ID 추출
  const getYouTubeId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeId(post.youtubeUrl);

  // 이미지 에러 핸들러 강화
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

  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState<Comment[]>(post.comments || []);
  
  const { user: authUser, profile } = useAuth();
  const { blockUser } = useBlockedUsers();
  const navigate = useNavigate();

  const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');
  const isAd = post.isAd;
  const displayImage = imgError ? getFallbackImage(post.id) : post.image;
  const isLiked = post.isLiked;
  const likesCount = post.likes;
  const content = post.content;
  const user = post.user;
  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;

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
      showError(err.message || '댓글 등록에 실패했습니다.');
    } finally { setIsSubmittingComment(false); }
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
    return (
      <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10", bgColor)}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white p-4 transition-all",
        !disablePulse && isViewed && "opacity-80"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full rounded-full object-cover border-2 border-white" 
              onError={(e) => (e.target as HTMLImageElement).src = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg"} 
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">
                {user.name}
              </p>
            </div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5"><MapPin className="w-3 h-3" /><span className="text-[10px] font-medium">{post.location}</span></div>
          </div>
        </div>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-5 h-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">{isMine ? (<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Trash2 className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">삭제하기</span></DropdownMenuItem>) : (<><DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고가 접수되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu>
      </div>

      {/* Media Section */}
      <div 
        className="relative aspect-square mb-4 rounded-2xl overflow-hidden bg-gray-100 group shadow-inner"
        onClick={() => !videoId && onLocationClick?.({} as any, lat!, lng!)}
      >
        {videoId ? (
          <div className="w-full h-full">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoPlayVideo ? 1 : 0}&mute=0&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&showinfo=0`}
              className="w-full h-full object-cover"
              allow="autoplay; encrypted-media"
              allowFullScreen
              onLoad={() => setVideoLoaded(true)}
            />
            {!videoLoaded && (
              <img 
                src={currentImage} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
        ) : (
          <img
            src={currentImage}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 will-change-transform"
            onError={handleImageError}
          />
        )}
        
        {/* ... badges and buttons ... */}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4 pt-1.5"><button className="transition-transform active:scale-125" onClick={handleLikeToggleLocal}><Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button><button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button><button onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6 text-gray-700" /></button></div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <button className="transition-transform active:scale-125" onClick={handleSaveToggle}>
                <Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} />
              </button>
              
              {renderCategoryBadge()}
              
              {lat !== undefined && lng !== undefined && (
                <button onClick={(e) => onLocationClick(e, lat, lng)} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100">
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
        <div className="space-y-1"><p className="text-sm font-bold text-gray-500">좋아요 {likesCount.toLocaleString()}개</p><div className="flex gap-2 items-start"><div className="flex items-center gap-1.5 shrink-0"><span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div><p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p></div><form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"><Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={isSubmittingComment} /><button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button></form>{lastComment && (<div className="flex gap-2 items-start mt-1"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>)}<button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><span className="text-xs text-gray-400 font-medium">{showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}</span>{showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}</button><AnimatePresence>{showComments && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">{localComments.slice(0, -1).map((c, i) => (<div key={i} className="flex gap-2 items-start"><span className="font-bold text-sm text-gray-900">{c.user}</span><span className="text-sm text-gray-500 line-clamp-1">{c.text}</span></div>))}</motion.div>)}</AnimatePresence></div>
      </div>
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </motion.div>
  );
};

export default PostItem;