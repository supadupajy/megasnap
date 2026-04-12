"use client";

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setDirection(0);
    }
  }, [isOpen, initialIndex]);

  if (!posts || posts.length === 0 || currentIndex === -1) return null;

  const post = posts[currentIndex];
  if (!post) return null;

  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 100;
    const velocityThreshold = 500;

    if (info.offset.y < -swipeThreshold || info.velocity.y < -velocityThreshold) {
      if (currentIndex < posts.length - 1) {
        setDirection(1);
        setCurrentIndex(prev => prev + 1);
      }
    } else if (info.offset.y > swipeThreshold || info.velocity.y > velocityThreshold) {
      if (currentIndex > 0) {
        setDirection(-1);
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  const variants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.9
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300
      }
    },
    exit: (direction: number) => ({
      y: direction > 0 ? -1000 : 1000,
      opacity: 0,
      scale: 0.9,
      transition: {
        duration: 0.3
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
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
          {posts.map((_, idx) => (
            <div 
              key={idx}
              className={cn(
                "w-1.5 rounded-full transition-all duration-300",
                idx === currentIndex ? "h-8 bg-[#ccff00]" : "h-1.5 bg-white/30"
              )}
            />
          ))}
        </div>

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
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              className="pointer-events-auto w-[92vw] sm:max-w-[400px] bg-white rounded-[40px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh] relative"
              style={{
                border: isAd ? "4px solid #3b82f6" : (isPopular ? "4px solid #ccff00" : "none")
              }}
            >
              <ScrollArea className="flex-1">
                <div className="flex flex-col">
                  {/* Image Section - Primary Drag Area */}
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
                    
                    {/* Swipe Hint Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Content Section */}
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

                    {/* Comments Preview */}
                    <div className="space-y-4">
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
              
              {/* Bottom Swipe Handle */}
              <div className="h-10 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm border-t border-gray-100 shrink-0">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1" />
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
