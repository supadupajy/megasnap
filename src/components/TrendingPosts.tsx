"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Heart, ExternalLink, ChevronDown as ScrollDownIcon, ChevronUp as ScrollUpIcon, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Post } from "@/types";

interface TrendingPostsProps {
  posts: Post[];
  isExpanded: boolean;
  onToggle: () => void;
  onPostClick: (post: Post) => void;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const TrendingPosts: React.FC<TrendingPostsProps> = ({
  posts,
  isExpanded,
  onToggle,
  onPostClick,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollDownArrow, setShowScrollDownArrow] = useState(false);
  const [showScrollUpArrow, setShowScrollUpArrow] = useState(false);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setShowScrollDownArrow(!isAtBottom);

    const isAtTop = scrollTop < 10;
    setShowScrollUpArrow(!isAtTop);
  }, []);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80';
  };

  // FIX: Ensure useEffect doesn't change hook order based on props
  useEffect(() => {
    const el = listRef.current;
    if (isExpanded && posts.length > 5) {
      handleScroll();
      el?.addEventListener('scroll', handleScroll);
      return () => el?.removeEventListener('scroll', handleScroll);
    } else {
      setShowScrollDownArrow(false);
      setShowScrollUpArrow(false);
    }
  }, [isExpanded, posts.length, handleScroll]);

  return (
    <div 
      className={cn(
        "bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden border-2 border-indigo-600/20",
        isExpanded ? "max-h-[90vh]" : "max-h-[56px]"
      )}
    >
      <div 
        className="h-[56px] flex items-center px-5 cursor-pointer active:bg-gray-50 transition-colors shrink-0"
        onClick={onToggle}
      >
        <span className="text-indigo-600 font-black text-sm w-4 italic shrink-0">
          {isExpanded ? "HOT" : posts[0]?.rank}
        </span>
        
        {!isExpanded ? (
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <img
                src={posts[0]?.image}
                alt=""
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            </div>
            <div className="flex-1 overflow-hidden relative h-5">
              <AnimatePresence mode="wait">
                <motion.p
                  key={`${posts[0]?.id}-${0}`}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -15, opacity: 0 }}
                  transition={{ duration: 0.3, opacity: { duration: 0.2 } }}
                  className="text-xs font-bold text-gray-800 truncate absolute inset-0 leading-5"
                >
                  {posts[0]?.content}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
            <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0 fill-orange-500" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight whitespace-nowrap">
              Real-time HOT (Top 20)
            </span>
          </div>
        )}
        
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
        )}
      </div>

      <div 
        className={cn(
          "flex flex-col relative transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* 광고 구좌 (고정) */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-950 text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-yellow-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">AD</span>
                <Sparkles className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              </div>
              <h3 className="text-lg font-black leading-tight mb-1">
                프리미엄 멤버십<br />첫 달 0원 혜택!
              </h3>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-white/60 font-bold">지금 바로 시작하기</p>
                <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* 스크롤 가능한 포스팅 리스트 */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto no-scrollbar py-2 px-3 space-y-2 max-h-[40vh] relative"
        >
          {/* 상단 스크롤 안내 화살표 - 위로 스크롤 가능할 때만 나타남 */}
          {isExpanded && showScrollUpArrow && (
            <div className="sticky top-0 left-0 right-0 flex justify-center pointer-events-none z-30 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
                <ScrollUpIcon className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          )}

          {posts.map((post) => (
            <div 
              key={post.id}
              onClick={() => onPostClick(post)}
              className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer group"
            >
              <div className="w-6 text-center shrink-0">
                <span className={cn(
                  "text-sm font-black italic",
                  post.rank <= 3 ? "text-indigo-600" : "text-gray-300"
                )}>
                  {post.rank}
                </span>
              </div>
              
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-gray-100 bg-gray-50">
                <img 
                  src={post.image} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate leading-tight mb-1">
                  {post.content}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium text-gray-400 truncate">
                    {post.location || '위치 정보 없음'}
                  </p>
                  <div className="flex items-center gap-0.5 text-rose-500">
                    <Heart className="w-3 h-3 fill-rose-500" />
                    <span className="text-[10px] font-black">{post.likes}</span>
                  </div>
                </div>
              </div>

              {(post.rank === 1 || post.rank === 4) && (
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 하단 스크롤 안내 화살표 - 아래로 스크롤 가능할 때만 나타남 */}
        {isExpanded && posts.length > 5 && showScrollDownArrow && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none pb-2 z-20 animate-in fade-in duration-300">
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
              <ScrollDownIcon className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingPosts;