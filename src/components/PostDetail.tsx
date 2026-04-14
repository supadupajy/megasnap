"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star, ChevronDown, ChevronUp, Utensils, Car, TreePine, Sparkles, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const MOCK_COMMENTS = [
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
    }
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, initialthink
The previous response was cut off in the middle of the `PostDetail.tsx` file. I need to complete the file content exactly where it left off.

The last part of the previous response was:
```tsx
  useEffect(() => {
    if (isOpen && !hasInitialized && initialIndex !== -1) {
      setCurrentIndex(initialIndex);
      setHasInitialized(true);
      setShowComments(false);
      setCurrentImageIndex(0);
    }
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, initial
```

I will continue from `Index, hasInitialized]);` and complete the rest of the file.

Wait, looking at the previous turn's code block:
`useEffect(() => { if (isOpen && !hasInitialized && initialIndex !== -1) { setCurrentIndex(initialIndex); setHasInitialized(true); setShowComments(false); setCurrentImageIndex(0); } if (!isOpen) { setHasInitialized(false); } }, [isOpen, initial`

I need to finish the `useEffect` dependency array and the rest of the component.

Plan:
1. Complete `PostDetail.tsx`.
2. Ensure the "tap to close" logic is correctly implemented (buttons stop propagation, card triggers close).
3. Ensure the image slider has `snap-x snap-mandatory` and `scroll-snap-stop: always`.

Let's write the full file to be safe and follow the "ONE dyad-write block per file" rule.

Wait, the user said "Continue exactly where you left off without any preamble".
However, the system instructions say: "Only use ONE <dyad-write> block per file that you write!" and "do NOT be lazy and ALWAYS write the entire file. It needs to be a complete file."

So I will write the entire `src/components/PostDetail.tsx` file again, but this time complete.

Actually, the user's prompt "Continue exactly where you left off" is a direct instruction to finish the text. But as an AI editor, I must provide the full file in a `<dyad-write>` tag to ensure the codebase is valid.

Let's refine the logic for "tap to close":
- `DialogContent` has `onClick={onClose}` (backdrop).
- `motion.div` (the card) should have `onClick={onClose}`.
- Buttons inside the card should have `onClick={(e) => e.stopPropagation()}`.
- Image slider should have `onPointerDown={(e) => e.stopPropagation()}` or similar to allow swiping without closing.

Let's refine the image slider:
- `snap-x snap-mandatory`
- `scroll-snap-stop: always` on the children.

Let's write the file.<dyad-write path="src/components/PostDetail.tsx" description="카드 탭 시 닫기 기능 및 이미지 슬라이더 1장씩 스냅 기능 구현">
"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star, ChevronDown, ChevronUp, Utensils, Car, TreePine, Sparkles, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const MOCK_COMMENTS = [
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
    }
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, initialIndex, hasInitialized]);

  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (isOpen && currentPost && onViewPost) {
      onViewPost(currentPost.id);
    }
    setShowComments(false);
    setCurrentImageIndex(0);
    
    if (imageScrollRef.current) {
      imageScrollRef.current.scrollLeft = 0;
    }
  }, [currentIndex, isOpen, onViewPost]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) {
      setCurrentImageIndex(index);
    }
  };

  if (!isOpen || posts.length === 0) return null;
  
  const post = posts[currentIndex];
  if (!post) return null;

  const images = post.images || [post.image];
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  const category = post.category || 'none';

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    navigate(`/profile/${post.user.id}`);
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
    }
    if (!Icon) return null;
    return (
      <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10", bgColor)}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  const lastComment = MOCK_COMMENTS[MOCK_COMMENTS.length - 1];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-black/40 backdrop-blur-sm border-none shadow-none w-full h-full max-w-none overflow-hidden translate-x-0 translate-y-0 left-0 top-0 data-[state=open]:animate-none data-[state=closed]:animate-none outline-none"
        onClick={onClose}
      >
        <div className="absolute top-4 right-6 z-[110]">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="rounded-2xl bg-white/80 backdrop-blur-xl hover:bg-white text-indigo-600 shadow-xl border border-white/40 w-11 h-11 active:scale-90 transition-all"
          >
            <X className="w-6 h-6 stroke-[2.5px]" />
          </Button>
        </div>

        <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4">
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                onClick={onClose}
                className={cn(
                  "w-full max-w-[420px] h-[82vh] flex flex-col bg-white rounded-[40px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative",
                  isAd && "border-4 border-blue-500",
                  isPopular && "popular-border-container",
                  isInfluencer && "influencer-border-container"
                )}
              >
                {/* Status Bar */}
                {isInfluencer && (
                  <div className="h-10 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 flex items-center justify-center gap-2 shrink-0">
                    <Star className="w-4 h-4 fill-black" />
                    <span className="text-[11px] font-black text-black uppercase tracking-widest">Influencer Recommended</span>
                    <Star className="w-4 h-4 fill-black" />
                  </div>
                )}
                {isPopular && (
                  <div className="h-10 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 flex items-center justify-center gap-2 shrink-0">
                    <Flame className="w-4 h-4 fill-white text-white" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">Real-time Hot Post</span>
                    <Flame className="w-4 h-4 fill-white text-white" />
                  </div>
                )}
                {isAd && (
                  <div className="h-10 bg-blue-500 flex items-center justify-center gap-2 shrink-0">
                    <Sparkles className="w-4 h-4 fill-white text-white" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">Sponsored Content</span>
                    <Sparkles className="w-4 h-4 fill-white text-white" />
                  </div>
                )}

                <div 
                  className="flex-1 h-full overflow-hidden flex flex-col relative bg-white rounded-[36px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div 
                    ref={scrollContainerRef} 
                    className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain"
                  >
                    <div className="flex flex-col">
                      <div className="aspect-square w-full bg-gray-100 relative overflow-hidden shrink-0">
                        <div 
                          ref={imageScrollRef}
                          onScroll={handleImageScroll}
                          className="image-slider flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
                        >
                          {images.map((img: string, idx: number) => (
                            <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                              <img 
                                src={img} 
                                alt="" 
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                              />
                              {idx === post.adImageIndex && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-500 text-white px-10 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">
                                  AD
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {images.length > 1 && (
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">
                            {images.map((_: any, idx: number) => (
                              <div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3.5">
                            <button className="flex items-center gap-1 group" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(post.id); }}>
                              <Heart className={cn("w-[18px] h-[18px] transition-transform group-active:scale-125", post.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
                              <span className="text-[11px] font-bold text-gray-500">{post.likes}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="flex items-center gap-1">
                              <MessageCircle className="w-[18px] h-[18px] text-gray-400" />
                              <span className="text-[11px] font-bold text-gray-500">12</span>
                            </button>
                            <button className="text-gray-400" onClick={(e) => e.stopPropagation()}><Share2 className="w-[18px] h-[18px]" /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderCategoryBadge()}
                            {post.lat !== undefined && post.lng !== undefined && (
                              <button onClick={(e) => { e.stopPropagation(); onLocationClick?.(post.lat, post.lng); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                                <span className="text-[10px] font-black">위치보기</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer" onClick={handleUserClick}>
                            <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm leading-none truncate cursor-pointer" onClick={handleUserClick}>{post.user.name}</p>
                            <div className="flex items-center text-indigo-600 gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="text-[10px] font-bold truncate">{post.location}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-700 text-sm leading-relaxed mb-4 font-medium">{post.content}</p>

                        <div className="border-t border-gray-100 pt-2">
                          <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="w-full py-2 flex items-center justify-between group">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{showComments ? 'Hide Comments' : 'View All Comments'}</p>
                            {showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
                          </button>
                          {!showComments && (
                            <div className="flex gap-2 items-start mt-1 mb-2">
                              <span className="font-bold text-[13px] text-gray-900">{lastComment.user}</span>
                              <span className="text-[13px] text-gray-500 line-clamp-1">{lastComment.text}</span>
                            </div>
                          )}
                          <AnimatePresence>
                            {showComments && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="space-y-4 py-3 pb-6">
                                  {MOCK_COMMENTS.map((comment, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                      <span className="font-bold text-[13px] text-gray-900">{comment.user}</span>
                                      <span className="text-[13px] text-gray-500">{comment.text}</span>
                                    </div>
                                  ))}
                                </div>
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