"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star, ChevronDown, ChevronUp, Move, Utensils, Car, TreePine, Sparkles, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
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
  const [direction, setDirection] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useLayoutEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitialized && initialIndex !== -1) {
      setCurrentIndex(initialIndex);
      setHasInitialized(true);
      setDirection(0);
      setShowComments(false);
      setCurrentImageIndex(0);
    }
    if (!isOpen) {
      setHasInitialized(false);
      setIsClosing(false);
    }
  }, [isOpen, initialIndex, hasInitialized]);

  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (isOpen && currentPost && onViewPost) {
      onViewPost(currentPost.id);
    }
    setShowComments(false);
    setCurrentImageIndex(0);
  }, [currentIndex, isOpen, onViewPost]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setCurrentImageIndex(index);
  };

  if (!isOpen || posts.length === 0) return null;
  
  const post = posts[currentIndex];
  if (!post) return null;

  const images = post.images || [post.image];
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  const category = post.category || 'none';

  const handleUserClick = () => {
    onClose();
    navigate(`/profile/${post.user.id}`);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);
    
    if (absX > absY && (absX > 80 || Math.abs(velocity.x) > 500)) {
      setDirection(offset.x > 0 ? 100 : -100);
      setIsClosing(true);
      return;
    }

    const threshold = 70;
    const velThreshold = 400;

    if (absY > absX) {
      if (offset.y < -threshold || velocity.y < -velThreshold) {
        if (currentIndex < posts.length - 1) {
          setDirection(1);
          setCurrentIndex(prev => prev + 1);
        }
      } else if (offset.y > threshold || velocity.y > velThreshold) {
        if (currentIndex > 0) {
          setDirection(-1);
          setCurrentIndex(prev => prev - 1);
        }
      }
    }
  };

  const variants = {
    enter: (direction: number) => ({
      y: (direction === 1 || direction === -1) ? (direction > 0 ? "100%" : "-100%") : 0,
      x: (direction === 100 || direction === -100) ? (direction > 0 ? "100%" : "-100%") : 0,
      opacity: 0,
      scale: 1,
    }),
    center: {
      y: 0,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        y: { type: "spring", damping: 30, stiffness: 300, mass: 1 },
        x: { type: "spring", damping: 30, stiffness: 300, mass: 1 },
        opacity: { duration: 0.2 }
      }
    },
    exit: (direction: number) => ({
      y: direction === 1 ? "-100%" : direction === -1 ? "100%" : 0,
      x: direction === 100 ? "100%" : direction === -100 ? "-100%" : 0,
      opacity: 0,
      scale: 1,
      transition: {
        y: { type: "spring", damping: 30, stiffness: 300, mass: 1 },
        x: { duration: 0.25, ease: "easeInOut" },
        opacity: { duration: 0.2 }
      }
    })
  };

  const renderCategoryBadge = () => {
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
    }

    if (!Icon) return null;

    return (
      <div className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10",
        bgColor
      )}>
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
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-transparent border-none shadow-none w-full h-full max-w-none overflow-visible translate-x-0 translate-y-0 left-0 top-0 data-[state=open]:animate-none data-[state=closed]:animate-none outline-none focus:ring-0"
      >
        <style>{`
          [data-radix-portal] div[data-state] {
            background-color: transparent !important;
            backdrop-filter: none !important;
          }
        `}</style>
        
        <div className="absolute top-4 right-6 z-[110]">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="rounded-2xl bg-white/80 backdrop-blur-xl hover:bg-white text-indigo-600 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40 w-11 h-11 active:scale-90 transition-all"
          >
            <X className="w-6 h-6 stroke-[2.5px]" />
          </Button>
        </div>

        <div className="absolute left-1 top-32 bottom-32 w-1.5 z-[110] flex flex-col items-center">
          <div className="w-[3px] h-full bg-white/10 rounded-full relative overflow-hidden">
            <motion.div 
              className="absolute w-full rounded-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.8)]"
              initial={false}
              animate={{ 
                height: `${Math.max(10, 100 / posts.length)}%`,
                top: `${(currentIndex / (posts.length - 1 || 1)) * (100 - Math.max(10, 100 / posts.length))}%`
              }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            />
          </div>
        </div>

        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={() => {
            if (isClosing) onClose();
          }}>
            {!isClosing && (
              <motion.div
                key={post.id}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                drag={true}
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.6}
                onDragEnd={handleDragEnd}
                className="absolute pointer-events-auto w-[90vw] sm:max-w-[420px] h-[82vh] flex flex-col rounded-[40px] overflow-hidden"
                style={{ 
                  boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)',
                  willChange: 'transform, opacity',
                  backfaceVisibility: 'hidden',
                  transformStyle: 'preserve-3d',
                  isolation: 'isolate',
                  width: '90vw',
                  height: '82vh'
                }}
              >
                {/* Background Border Layer - Separated to prevent layout shifts */}
                <div className={cn(
                  "absolute inset-0 z-0 rounded-[40px]",
                  isAd && "border-4 border-blue-500",
                  isPopular && "popular-border-container",
                  isInfluencer && "influencer-border-container"
                )} />

                {/* Main Content Container */}
                <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white rounded-[36px] m-[4px] z-10">
                  <div 
                    key={`scroll-container-${post.id}`}
                    ref={scrollContainerRef} 
                    className={cn(
                      "flex-1 h-full overflow-y-auto no-scrollbar",
                      !showComments && "touch-none"
                    )}
                  >
                    <div 
                      className="flex flex-col"
                      onPointerDown={(e) => {
                        if (!showComments) {
                          const target = e.target as HTMLElement;
                          if (!target.closest('.image-slider')) {
                            dragControls.start(e);
                          }
                        }
                      }}
                    >
                      <div className="aspect-square w-full bg-gray-100 relative overflow-hidden shrink-0">
                        <div 
                          ref={imageScrollRef}
                          onScroll={handleImageScroll}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="image-slider flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
                        >
                          {images.map((img: string, idx: number) => (
                            <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                              <img 
                                src={img} 
                                alt="" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = FALLBACK_IMAGE;
                                }}
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
                              <div 
                                key={idx}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                  currentImageIndex === idx ? "bg-white w-4" : "bg-white/40"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-4 sm:px-5 sm:py-5 relative">
                        {/* Action Bar */}
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3.5">
                            <button 
                              className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors group"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLikeToggle?.(post.id);
                              }}
                            >
                              <Heart className={cn("w-[18px] h-[18px] transition-transform group-active:scale-125", post.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400')} />
                              <span className="text-[11px] font-bold text-gray-500">{post.likes}</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowComments(!showComments);
                              }}
                              className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors"
                            >
                              <MessageCircle className="w-[18px] h-[18px]" />
                              <span className="text-[11px] font-bold text-gray-500">12</span>
                            </button>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors">
                              <Share2 className="w-[18px] h-[18px]" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {renderCategoryBadge()}
                            {post.lat !== undefined && post.lng !== undefined && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLocationClick?.(post.lat, post.lng);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100"
                              >
                                <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                                <span className="text-[10px] font-black">위치보기</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* User Info */}
                        <div className="flex items-center gap-3 mb-3">
                          <div 
                            className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer active:scale-95 transition-transform"
                            onClick={handleUserClick}
                          >
                            <img 
                              src={post.user.avatar} 
                              alt="" 
                              className="w-full h-full rounded-full object-cover border-2 border-white" 
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p 
                                className="font-bold text-gray-900 text-sm leading-none truncate cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={handleUserClick}
                              >
                                {post.user.name}
                              </p>
                              {isAd && (
                                <a
                                  href="https://s.baemin.com/t3000fBqlbHGL"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold hover:bg-blue-600 transition-colors shrink-0"
                                >
                                  앱에서 보기
                                </a>
                              )}
                            </div>
                            <div className="flex items-center text-indigo-600 gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="text-[10px] font-bold truncate">{post.location}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-700 text-sm leading-relaxed mb-4 font-medium pr-10">
                          {post.content}
                        </p>

                        <div className="border-t border-gray-100 pt-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowComments(!showComments);
                            }}
                            className="w-full py-2 flex items-center justify-between group"
                          >
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-gray-600 transition-colors">
                              {showComments ? 'Hide Comments' : 'View All Comments'}
                            </p>
                            {showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
                          </button>

                          {!showComments && (
                            <div className="flex gap-2 items-start mt-1 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                              <span className="font-bold text-[13px] text-gray-900 whitespace-nowrap">{lastComment.user}</span>
                              <span className="text-[13px] text-gray-500 leading-snug line-clamp-1 flex-1">
                                {lastComment.text}
                              </span>
                            </div>
                          )}

                          <AnimatePresence>
                            {showComments && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-4 py-3 pb-6">
                                  {MOCK_COMMENTS.map((comment, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                      <span className="font-bold text-[13px] text-gray-900 whitespace-nowrap">{comment.user}</span>
                                      <span className="text-[13px] text-gray-500 leading-snug">
                                        {comment.text}
                                      </span>
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
                  
                  <div 
                    onPointerDown={(e) => dragControls.start(e)}
                    className="h-16 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md border-t border-gray-100 shrink-0 cursor-grab active:cursor-grabbing touch-none z-10"
                  >
                    <Move className="w-4 h-4 text-gray-300 mb-1 animate-pulse" />
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">MOVE TO SWIPE</p>
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