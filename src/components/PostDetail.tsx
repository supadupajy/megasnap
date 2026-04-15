"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star, ChevronDown, ChevronUp, Utensils, Car, TreePine, Sparkles, Navigation, PawPrint, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface PostDetailProps {
  posts: any[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onViewPost?: (id: string) => void;
  onLikeToggle?: (postId: string) => void;
  onLocationClick?: (lat: number, lng: number) => void;
}

const INITIAL_COMMENTS = [
  { user: "travel_lover", text: "와 여기 진짜 가보고 싶었는데! 정보 감사합니다." },
  { user: "photo_master", text: "날씨 좋을 때 가면 최고죠 ㅎㅎ" },
  { user: "seoul_explorer", text: "주차 공간은 넉넉한가요?" },
  { user: "daily_snap", text: "사진 필터 어떤 거 쓰셨나요? 너무 예뻐요!" }
];

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onViewPost, onLikeToggle, onLocationClick }: PostDetailProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const [commentInput, setCommentInput] = useState('');
  
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
      setComments(INITIAL_COMMENTS);
    }
    if (!isOpen) setHasInitialized(false);
  }, [isOpen, initialIndex, hasInitialized]);

  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (isOpen && currentPost && onViewPost) onViewPost(currentPost.id);
    setShowComments(false);
    setCurrentImageIndex(0);
  }, [currentIndex, isOpen, onViewPost]);

  const handleAddComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim()) return;
    setComments([...comments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
  };

  if (!isOpen || posts.length === 0) return null;
  const post = posts[currentIndex];
  if (!post) return null;

  const images = post.images || [post.image];
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  const category = post.category || 'none';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-black/40 backdrop-blur-sm border-none shadow-none w-full h-full max-w-none overflow-hidden outline-none" onClick={onClose}>
        <div className="absolute top-4 right-6 z-[110]">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded-2xl bg-white/80 backdrop-blur-xl text-indigo-600 w-11 h-11"><X className="w-6 h-6" /></Button>
        </div>

        <div className="relative w-full h-full flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div key={post.id} initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={onClose} className={cn("w-full max-w-[420px] h-[82vh] flex flex-col bg-white rounded-[40px] overflow-hidden shadow-2xl relative cursor-pointer", isAd && "border-4 border-blue-500", isPopular && "popular-border-container", isInfluencer && "influencer-border-container")}>
                <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white rounded-[36px]">
                  <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain">
                    <div className="flex flex-col">
                      <div className="aspect-square w-full bg-gray-100 relative overflow-hidden shrink-0">
                        <img src={images[0]} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                      </div>

                      <div className="px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3.5">
                            <button onClick={(e) => { e.stopPropagation(); onLikeToggle?.(post.id); }}><Heart className={cn("w-[18px] h-[18px]", post.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button>
                            <MessageCircle className="w-[18px] h-[18px] text-gray-400" />
                            <Share2 className="w-[18px] h-[18px] text-gray-400" />
                          </div>
                          {post.lat !== undefined && post.lng !== undefined && (
                            <button onClick={(e) => { e.stopPropagation(); onLocationClick?.(post.lat, post.lng); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100"><Navigation className="w-3.5 h-3.5 fill-indigo-600" /><span className="text-[10px] font-black">위치보기</span></button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0"><img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white" /></div>
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}><p className="font-bold text-gray-900 text-sm leading-none truncate">{post.user.name}</p><div className="flex items-center text-indigo-600 gap-1 mt-1"><MapPin className="w-3 h-3" /><span className="text-[10px] font-bold truncate">{post.location}</span></div></div>
                        </div>

                        <p className="text-gray-700 text-sm leading-relaxed mb-4 font-medium" onClick={(e) => e.stopPropagation()}>{post.content}</p>

                        <div className="border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
                          <form onSubmit={handleAddComment} className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
                            <Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} />
                            <button type="submit" disabled={!commentInput.trim()} className="text-indigo-600 disabled:text-gray-300"><Send className="w-4 h-4" /></button>
                          </form>

                          <AnimatePresence mode="wait">
                            {!showComments ? (
                              <motion.div key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {comments.length > 0 && (
                                  <div className="flex gap-2 items-start mt-1 mb-2">
                                    <span className="font-bold text-[13px] text-gray-900">{comments[comments.length - 1].user}</span>
                                    <span className="text-[13px] text-gray-500 line-clamp-1">{comments[comments.length - 1].text}</span>
                                  </div>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="w-full py-2 flex items-center justify-between group"><p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">View All Comments</p><ChevronDown className="w-3.5 h-3.5 text-gray-300" /></button>
                              </motion.div>
                            ) : (
                              <motion.div key="expanded" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="space-y-4 py-3">
                                  {comments.map((comment, i) => (
                                    <div key={i} className="flex gap-2 items-start"><span className="font-bold text-[13px] text-gray-900">{comment.user}</span><span className="text-[13px] text-gray-500">{comment.text}</span></div>
                                  ))}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setShowComments(false); }} className="w-full py-2 flex items-center justify-between group border-t border-gray-50 mt-2"><p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Close Comments</p><ChevronUp className="w-3.5 h-3.5 text-gray-300" /></button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetail;