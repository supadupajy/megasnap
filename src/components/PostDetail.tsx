"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star, ChevronDown, ChevronUp, Utensils, Car, TreePine, Sparkles, Navigation, PawPrint, Send, Bookmark, MoreHorizontal, ShoppingBag, Play, AlertCircle, Ban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { isGifUrl } from '@/lib/mock-data';
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

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onViewPost, onLikeToggle, onLocationClick, onDelete }: PostDetailProps) => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { blockUser } = useBlockedUsers();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
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
    if (!isOpen) setHasInitialized(false);
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
    }
  }, [currentIndex, isOpen, onViewPost, posts]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) setCurrentImageIndex(index);
  };

  const handleAddComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim()) return;
    setLocalComments([...localComments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
  };

  if (!isOpen || posts.length === 0) return null;
  const post = posts[currentIndex];
  if (!post) return null;

  const images = post.images || [post.image];
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  const isGif = isGifUrl(images[currentImageIndex]);
  const category = post.category || 'none';

  const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    navigate(`/profile/${post.user.id}`);
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    showSuccess('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
  };

  const handleBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    blockUser(post.user.id);
    showError(`${post.user.name} 님을 차단했습니다.`);
    onClose();
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      showSuccess('포스팅이 삭제되었습니다.');
      if (onDelete) onDelete(post.id);
      onClose();
    } catch (err) {
      console.error('Error deleting post:', err);
      showError('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const renderCategoryBadge = () => {
    if (category === 'none') return null;
    let Icon = null;
    let bgColor = "";
    let label = "";
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

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        onOpenAutoFocus={(e) => e.preventDefault()} 
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-black/60 backdrop-blur-sm border-none shadow-none w-full h-full max-w-none overflow-hidden translate-x-0 translate-y-0 left-0 top-0 outline-none data-[state=open]:animate-none data-[state=open]:duration-0"
      >
        <div 
          className="absolute inset-0 z-0 cursor-pointer" 
          onClick={onClose}
        />

        <div className="absolute top-4 right-6 z-[110]">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="rounded-2xl bg-white/80 backdrop-blur-xl hover:bg-white text-indigo-600 shadow-xl border border-white/40 w-11 h-11 active:scale-90 transition-all close-popup-btn"
          >
            <X className="w-6 h-6 stroke-[2.5px]" />
          </Button>
        </div>
        
        <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none p-4">
          <motion.div 
            key={post.id} 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              duration: 0.45, 
              ease: [0.4, 0, 0.2, 1]
            }}
            onClick={onClose}
            className={cn(
              "w-full max-w-[420px] h-[82vh] flex flex-col bg-white rounded-[40px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative pointer-events-auto cursor-pointer"
            )}
          >
            <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white">
              <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain">
                <div className="flex flex-col">
                  {/* Header - Stop propagation to allow profile clicks */}
                  <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
                      <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
                        <img src={post.user.avatar} alt={post.user.name} className="w-full h-full rounded-full object-cover border-2 border-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{post.user.name}</p>
                          {isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}
                        </div>
                        <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span className="text-[10px] font-medium">{post.location}</span>
                        </div>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[120]">
                        {isMine ? (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }}
                            className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-bold text-red-600">삭제하기</span>
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem 
                              onClick={handleReport}
                              className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"
                            >
                              <AlertCircle className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-bold text-gray-700">신고</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={handleBlock}
                              className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
                            >
                              <Ban className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-bold text-red-600">차단</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {/* Image Area - Clicking here will close the popup (bubbles to motion.div) */}
                  <div className="px-4">
                    <div className={cn(
                      "relative aspect-square w-full rounded-2xl transition-all duration-500", 
                      isInfluencer ? "influencer-border-container" : (isAd ? "ad-border-container" : (isPopular ? "popular-border-container" : ""))
                    )}>
                      <div className={cn("w-full h-full rounded-[14px] overflow-hidden bg-white relative z-10", isInfluencer && "shine-overlay")}>
                        <div ref={imageScrollRef} onScroll={handleImageScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
                          {images.map((img: string, idx: number) => (
                            <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                              <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                              {idx === post.adImageIndex && <div className="absolute top-4 right-4 z-20 bg-blue-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">AD</div>}
                            </div>
                          ))}
                        </div>
                        {images.length > 1 && (
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">
                            {images.map((_: any, idx: number) => (
                              <div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />
                            ))}
                          </div>
                        )}
                      </div>
                      {isInfluencer ? (
                        <div className="absolute top-4 left-4 z-20 bg-yellow-400 text-black px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-black/5"><Star className="w-3.5 h-3.5 fill-black" />INFLUENCER</div>
                      ) : isPopular && (
                        <div className="absolute top-4 left-4 z-20 bg-red-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10"><Flame className="w-3.5 h-3.5 fill-white" />HOT</div>
                      )}
                      {isGif && !isAd && <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md text-white p-1.5 rounded-full shadow-lg border border-white/20"><Play className="w-3 h-3 fill-white" /></div>}
                    </div>
                  </div>
                  
                  {/* Action Area - Stop propagation to allow interactions */}
                  <div className="px-4 pt-3 pb-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-4 pt-1.5">
                        <button className="transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(post.id); }}><Heart className={cn("w-6 h-6 transition-colors", post.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button>
                        <button className="text-gray-700" onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6" /></button>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3">
                          <button className="transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); setIsSaved(!isSaved); }}><Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} /></button>
                          {renderCategoryBadge()}
                          {post.lat !== undefined && post.lng !== undefined && (
                            <button onClick={(e) => { e.stopPropagation(); onLocationClick?.(post.lat, post.lng); }} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100"><Navigation className="w-3.5 h-3.5 fill-indigo-600" /><span className="text-[10px] font-black">위치보기</span></button>
                          )}
                        </div>
                        {isAd && (
                          <a href="https://s.baemin.com/t3000fBqlbHGL" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-sm border border-[#2AC1BC]/20"><ShoppingBag className="w-3.5 h-3.5 fill-white" /><span className="text-[10px] font-black">주문하기</span></a>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 mb-4">
                      <p className="text-sm font-bold text-gray-500">좋아요 {post.likes.toLocaleString()}개</p>
                      <div className="flex gap-2 items-start"><span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer" onClick={handleUserClick}>{post.user.name}</span><p className="text-gray-800 text-sm leading-snug">{post.content}</p></div>
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <form onSubmit={handleAddComment} className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"><Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} /><button type="submit" disabled={!commentInput.trim()} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button></form>
                      {lastComment && <div className="flex gap-2 items-start mt-1 mb-2"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>}
                      <AnimatePresence>{showComments && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="space-y-3 py-2">{localComments.slice(0, -1).map((comment, i) => (<div key={i} className="flex gap-2 items-start"><span className="font-bold text-sm text-gray-900">{comment.user}</span><span className="text-sm text-gray-500">{comment.text}</span></div>))}</div></motion.div>}</AnimatePresence>
                      <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="w-full py-1 flex items-center justify-between group"><span className="text-xs text-gray-400 font-medium">{showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}</span>{showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </DialogContent>

      <DeleteConfirmDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />
    </Dialog>
  );
};

export default PostDetail;