"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo, useDragControls, useAnimation } from 'framer-motion';

interface PostDetailProps {
  posts: any[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onViewPost?: (id: string) => void;
}

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onViewPost }: PostDetailProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const controls = useAnimation();

  const displayPosts = useMemo(() => {
    if (!isOpen || posts.length === 0 || initialIndex === -1) return [];
    const selected = posts[initialIndex];
    const others = posts.filter((_, idx) => idx !== initialIndex);
    return [selected, ...others];
  }, [isOpen, posts, initialIndex]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setDirection(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && displayPosts[currentIndex] && onViewPost) {
      onViewPost(displayPosts[currentIndex].id);
    }
  }, [currentIndex, isOpen, displayPosts, onViewPost]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = 0;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isOpen]);

  if (!isOpen || displayPosts.length === 0) return null;
  
  const post = displayPosts[currentIndex];
  if (!post) return null;

  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const screenWidth = window.innerWidth;
    const swipeThreshold = 50;
    const velocityThreshold = 300;

    // 1. 왼쪽 스와이프 (닫기) - 페이드 아웃 포함
    if (info.offset.x < -screenWidth / 4 || info.velocity.x < -velocityThreshold) {
      await controls.start({ 
        x: -screenWidth, 
        opacity: 0, 
        transition: { duration: 0.2, ease: "easeOut" } 
      });
      onClose();
      return;
    }

    // 2. 상하 스와이프 (포스팅 전환)
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      if (info.offset.y < -swipeThreshold || info.velocity.y < -velocityThreshold) {
        // 위로 스와이프 -> 다음 포스트
        if (currentIndex < displayPosts.length - 1) {
          setDirection(1);
          setCurrentIndex(prev => prev + 1);
          return;
        }
      } else if (info.offset.y > swipeThreshold || info.velocity.y > velocityThreshold) {
        // 아래로 스와이프 -> 이전 포스트
        if (currentIndex > 0) {
          setDirection(-1);
          setCurrentIndex(prev => prev - 1);
          return;
        }
      }
    }

    // 액션이 없으면 제자리로 복구
    controls.start("center");
  };

  const variants = {
    enter: (direction: number) => ({
      y: direction > 0 ? "100%" : direction < 0 ? "-100%" : 0,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      y: 0,
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        y: { type: "spring", damping: 30, stiffness: 400, mass: 0.8 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 }
      }
    },
    exit: (direction: number) => ({
      y: direction > 0 ? "-100%" : direction < 0 ? "100%" : 0,
      opacity: 0,
      scale: 0.95,
      transition: {
        y: { type: "spring", damping: 30, stiffness: 400, mass: 0.8 },
        opacity: { duration: 0.15 }
      }
    })
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 bg-transparent border-none shadow-none w-screen h-screen max-w-none flex items-center justify-center overflow-hidden outline-none focus:ring-0">
        <div className="absolute top-6 right-6 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/20 w-12 h-12"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="absolute left-1 top-32 bottom-32 w-1.5 z-50 flex flex-col items-center">
          <div className="w-[3px] h-full bg-white/10 rounded-full relative overflow-hidden">
            <motion.div 
              className={cn(
                "absolute w-full rounded-full",
                isInfluencer ? "bg-red-500 shadow-[0_0_20px_rgba(255,0,0,1)]" : "bg-[#ccff00] shadow-[0_0_20px_rgba(204,255,0,1)]"
              )}
              initial={false}
              animate={{ 
                height: `${Math.max(15, 100 / displayPosts.length)}%`,
                top: `${(currentIndex / displayPosts.length) * 100}%`
              }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            />
          </div>
          <div className="mt-4 flex flex-col items-center gap-1">
            <span className={cn("text-[10px] font-black drop-shadow-md", isInfluencer ? "text-red-500" : "text-[#ccff00]")}>{currentIndex + 1}</span>
            <div className="w-2 h-[1px] bg-white/20" />
            <span className="text-[10px] font-bold text-white/30">{displayPosts.length}</span>
          </div>
        </div>

        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={post.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate={controls}
              exit="exit"
              drag
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ left: -window.innerWidth, right: 0, top: -window.innerHeight, bottom: window.innerHeight }}
              dragElastic={{ left: 0.8, right: 0, top: 0.5, bottom: 0.5 }}
              onDragEnd={handleDragEnd}
              className={cn(
                "absolute pointer-events-auto w-[90vw] sm:max-w-[420px] rounded-[40px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] flex flex-col h-[82vh] will-change-transform bg-white"
              )}
              style={{
                border: isInfluencer ? "4px solid #ff0000" : (isAd ? "4px solid #3b82f6" : (isPopular ? "4px solid #ccff00" : "none")),
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div className="flex-1 h-full bg-white rounded-[36px] overflow-hidden flex flex-col">
                <ScrollArea 
                  ref={scrollAreaRef} 
                  className="flex-1 h-full no-scrollbar"
                  onPointerDown={(e) => {
                    dragControls.start(e);
                  }}
                >
                  <div className="flex flex-col">
                    <div className="aspect-square w-full bg-gray-100 relative overflow-hidden shrink-0">
                      <img 
                        src={post.image} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                      {isAd ? (
                        <div className="absolute top-6 left-6 z-20 bg-blue-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-lg border border-white/10">
                          AD
                        </div>
                      ) : isInfluencer ? (
                        <div className="absolute top-6 left-6 z-20 bg-red-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-lg border border-white/10">
                          <Star className="w-3.5 h-3.5 fill-white" />
                          INFLUENCER
                        </div>
                      ) : isPopular && (
                        <div className="absolute top-6 left-6 z-20 bg-[#ccff00] text-black px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-lg border border-black/5">
                          <Flame className="w-3.5 h-3.5 fill-black" />
                          HOT
                        </div>
                      )}
                    </div>

                    <div className="p-6 sm:p-8">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-green-500 shrink-0">
                          <img 
                            src={post.user.avatar} 
                            alt="" 
                            className="w-full h-full rounded-full object-cover border-2 border-white" 
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 text-base leading-none truncate">{post.user.name}</p>
                            {isAd && (
                              <a
                                href="https://s.baemin.com/t3000fBqlbHGL"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] bg-blue-500 text-white px-2.5 py-1 rounded-full font-bold hover:bg-blue-600 transition-colors shrink-0"
                              >
                                앱에서 보기
                              </a>
                            )}
                          </div>
                          <div className="flex items-center text-green-500 gap-1 mt-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold truncate">{post.location}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-700 text-sm leading-relaxed mb-8 font-medium">
                        {post.content}
                      </p>

                      <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                        <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors group">
                          <Heart className={cn("w-6 h-6 transition-transform group-active:scale-125", post.isLiked ? 'fill-red-500 text-red-500' : '')} />
                          <span className="text-sm font-bold">{post.likes}</span>
                        </button>
                        <button className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors">
                          <MessageCircle className="w-6 h-6" />
                          <span className="text-sm font-bold">12</span>
                        </button>
                        <button className="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
                          <Share2 className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="space-y-6 pb-10">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Recent Comments</p>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="font-bold text-sm text-gray-900 whitespace-nowrap">User_{i + 1}</span>
                            <span className="text-sm text-gray-500 leading-snug">
                              {["와 여기 진짜 가보고 싶었는데! 정보 감사합니다.", "날씨 좋을 때 가면 최고죠 ㅎㅎ", "주차 공간은 넉넉한가요?", "사진 필터 어떤 거 쓰셨나요? 너무 예뻐요!"][i % 4]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ScrollBar className="hidden" />
                </ScrollArea>
                
                <div 
                  onPointerDown={(e) => dragControls.start(e)}
                  className="h-16 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md border-t border-gray-100 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                >
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-2" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Swipe to explore</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetail;