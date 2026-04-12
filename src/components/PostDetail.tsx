"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface PostDetailProps {
  posts: any[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const PostDetail = ({ posts, initialIndex, isOpen, onClose }: PostDetailProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialIndex !== -1) {
      setCurrentIndex(initialIndex);
      setDirection(0);
    }
  }, [isOpen, initialIndex]);

  // 포스팅이 바뀔 때마다 스크롤을 맨 위로 이동
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = 0;
    }
  }, [currentIndex]);

  if (!isOpen || !posts || posts.length === 0) return null;
  
  const activeIndex = (currentIndex >= 0 && currentIndex < posts.length) 
    ? currentIndex 
    : (initialIndex >= 0 ? initialIndex : 0);
    
  const post = posts[activeIndex];
  
  if (!post) return null;

  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 50;
    const velocityThreshold = 200;

    if (info.offset.y < -swipeThreshold || info.velocity.y < -velocityThreshold) {
      if (activeIndex < posts.length - 1) {
        setDirection(1);
        setCurrentIndex(activeIndex + 1);
      }
    } else if (info.offset.y > swipeThreshold || info.velocity.y > velocityThreshold) {
      if (activeIndex > 0) {
        setDirection(-1);
        setCurrentIndex(activeIndex - 1);
      }
    }
  };

  const variants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 600 : -600,
      x: 0,
      opacity: 0,
    }),
    center: {
      y: 0,
      x: 0,
      opacity: 1,
      transition: {
        y: { type: "spring", damping: 25, stiffness: 200 },
        opacity: { duration: 0.2 }
      }
    },
    exit: (direction: number) => ({
      y: direction > 0 ? -600 : 600,
      x: 0,
      opacity: 0,
      transition: {
        y: { type: "spring", damping: 25, stiffness: 200 },
        opacity: { duration: 0.2 }
      }
    })
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 bg-transparent border-none shadow-none w-screen h-screen max-w-none flex items-center justify-center overflow-hidden outline-none focus:ring-0">
        {/* Close Button */}
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

        {/* Navigation Indicators */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 max-h-[70vh] overflow-hidden py-4 px-1">
          {posts.map((p, idx) => (
            <div 
              key={p.id}
              className={cn(
                "w-1 rounded-full transition-all duration-300 shadow-sm",
                idx === activeIndex 
                  ? "h-10 bg-[#ccff00] shadow-[0_0_15px_rgba(204,255,0,1)]" 
                  : "h-1.5 bg-white/40"
              )}
            />
          ))}
        </div>

        {/* Post Card Container */}
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={post.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={handleDragEnd}
              className="pointer-events-auto w-[82vw] sm:max-w-[400px] bg-white rounded-[40px] overflow-hidden shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] flex flex-col max-h-[82vh] relative origin-center"
              style={{
                border: isAd ? "4px solid #3b82f6" : (isPopular ? "4px solid #ccff00" : "none")
              }}
            >
              <ScrollArea ref={scrollAreaRef} className="flex-1">
                <div className="flex flex-col">
                  <div className="aspect-square w-full bg-gray-100 relative overflow-hidden">
                    <img 
                      src={post.image} 
                      alt="" 
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {isAd ? (
                      <div className="absolute top-6 left-6 z-20 bg-blue-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-lg border border-white/10">
                        AD
                      </div>
                    ) : isPopular && (
                      <div className="absolute top-6 left-6 z-20 bg-[#ccff00] text-black px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-lg border border-black/5">
                        <Flame className="w-3.5 h-3.5 fill-black" />
                        HOT
                      </div>
                    )}
                  </div>

                  <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-green-500">
                        <img 
                          src={post.user.avatar} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover border-2 border-white" 
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-base leading-none">{post.user.name}</p>
                          {isAd && (
                            <a
                              href="https://s.baemin.com/t3000fBqlbHGL"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] bg-blue-500 text-white px-2.5 py-1 rounded-full font-bold hover:bg-blue-600 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              앱에서 보기
                            </a>
                          )}
                        </div>
                        <div className="flex items-center text-green-500 gap-1 mt-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{post.location}</span>
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

                    <div className="space-y-4 pb-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Recent Comments</p>
                      <div className="flex gap-3 items-start">
                        <span className="font-bold text-sm text-gray-900 whitespace-nowrap">여행가_A</span>
                        <span className="text-sm text-gray-500 leading-snug">와 여기 진짜 가보고 싶었는데! 정보 감사합니다.</span>
                      </div>
                      <div className="flex gap-3 items-start">
                        <span className="font-bold text-sm text-gray-900 whitespace-nowrap">SeoulLife</span>
                        <span className="text-sm text-gray-500 leading-snug">날씨 좋을 때 가면 최고죠 ㅎㅎ</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <div className="h-12 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm border-t border-gray-100 shrink-0">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1.5" />
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Swipe to explore</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetail;