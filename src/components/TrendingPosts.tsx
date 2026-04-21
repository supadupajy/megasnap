"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Heart, ExternalLink, ChevronDown as ScrollDownIcon, Sparkles } from 'lucide-react';
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
  const trendingContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80';
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // 하단 화살표: 바닥에서 20px 이상 떨어져 있을 때 표시
    setShowScrollDown(scrollTop + clientHeight < scrollHeight - 20);
    // 상단 화살표: 상단에서 20px 이상 내려왔을 때 표시
    setShowScrollUp(scrollTop > 20);
  };

  useEffect(() => {
    if (isExpanded) {
      // 펼쳐질 때 초기 상태 체크를 위해 지연 실행
      setTimeout(() => {
        if (trendingContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = trendingContainerRef.current;
          setShowScrollDown(scrollHeight > clientHeight);
          setShowScrollUp(scrollTop > 20);
        }
      }, 100);
    } else {
      setShowScrollDown(false);
      setShowScrollUp(false);
    }
  }, [isExpanded, posts]);

  return (
    <div 
      className={cn(
        "bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl transition-all duration-500 overflow-hidden border-2 border-indigo-600/20",
        isExpanded ? "max-h-[80vh]" : "max-h-[56px]"
      )}
    >
      <div 
        className="h-[56px] flex items-center px-5 cursor-pointer active:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm italic font-black text-indigo-600 tracking-tighter">HOT</span>
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-time HOT (Top 20)</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      <div 
        ref={trendingContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto no-scrollbar py-2 px-3 space-y-2 relative",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ maxHeight: isExpanded ? 'calc(80vh - 56px)' : '0' }}
      >
        {/* 상단 스크롤 안내 화살표 */}
        {isExpanded && showScrollUp && (
          <div className="sticky top-2 left-0 right-0 flex justify-center pointer-events-none z-30">
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce">
              <ScrollDownIcon className="w-5 h-5 text-indigo-600 rotate-180" />
            </div>
          </div>
        )}

        {/* 광고 구좌 (고정) */}
        <div className="relative h-[112px] w-full rounded-xl overflow-hidden mb-2 group cursor-pointer">
          <img 
            src="https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            alt="Ad Background"
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex flex-col justify-center px-4">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="bg-yellow-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm">AD</span>
              <Sparkles className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            </div>
            <h3 className="text-white font-black text-sm leading-tight mb-1">
              프리미엄 멤버십<br/>첫 달 0원 혜택!
            </h3>
            <p className="text-white/70 text-[10px] font-medium flex items-center gap-1">
              지금 바로 시작하기 <ExternalLink className="w-2.5 h-2.5" />
            </p>
          </div>
        </div>

        {/* 포스팅 리스트 */}
        {posts.map((post) => (
          <div 
            key={post.id}
            onClick={() => onPostClick(post)}
            className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <span
              className={cn(
                "text-sm font-black italic w-4 shrink-0 transition-colors",
                post.rank && post.rank <= 3 ? "text-indigo-600" : "text-gray-300 group-hover:text-gray-400",
              )}
            >
              {post.rank}
            </span>
            
            <div className={cn(
              "w-11 h-11 rounded-xl flex-shrink-0 relative transition-all duration-300",
              post.borderType === 'diamond' ? "diamond-border-container p-[2px]" :
              post.borderType === 'gold' ? "gold-border-container p-[2px]" :
              post.borderType === 'silver' ? "silver-border-container p-[2px]" :
              post.borderType === 'popular' ? "popular-border-container p-[2px]" : 
              "bg-gray-100 overflow-hidden"
            )}>
              <div className={cn(
                "w-full h-full relative bg-white",
                post.borderType !== 'none' ? "rounded-[9px] overflow-hidden" : ""
              )}>
                <img
                  src={post.image}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              </div>
            </div>
            
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 justify-between">
                <p className="text-xs font-bold text-gray-800 truncate max-w-[85%]">
                  {post.content}
                </p>
                {(post.isAd || (post.rank === 1 || post.rank === 4)) && (
                  <div className="shrink-0 flex items-center justify-center">
                    {post.isAd ? (
                      <span className="bg-blue-500 text-white text-[7px] font-black px-1 py-0.5 rounded-sm">Ad</span>
                    ) : (
                      <div className="bg-orange-50/50 rounded-full p-1 border border-orange-100">
                        <Flame className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                      </div>
                    )}
                  </div>
                )}

              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-medium text-gray-400">{post.location}</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[9px] font-bold text-gray-400 tracking-tighter">❤️ {post.likes}</span>
                </div>
              </div>

            </div>

          </div>
        ))}

        {/* 하단 스크롤 안내 화살표 */}
        {isExpanded && showScrollDown && (
          <div className="sticky bottom-2 left-0 right-0 flex justify-center pointer-events-none pb-2 z-30">
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce">
              <ScrollDownIcon className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingPosts;