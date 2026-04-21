"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Flame, ExternalLink, Sparkles } from "lucide-react";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayPosts = posts.slice(0, 20);

  useEffect(() => {
    if (isExpanded || displayPosts.length === 0) return;
    const timer = setInterval(
      () => setCurrentIndex((prev) => (prev + 1) % displayPosts.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [isExpanded, displayPosts.length]);

  const currentPost = displayPosts[currentIndex];

  const handleItemClick = (e: React.MouseEvent, post: Post) => {
    e.preventDefault();
    e.stopPropagation();
    // ✅ Re-calculate borderType for the clicked post if it's missing or inconsistent
    // This ensures that even if specific props weren't passed, the detail view gets the right identity
    onPostClick(post);
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = FALLBACK_IMAGE;
  };

  if (displayPosts.length === 0) return null;

  return (
    <div 
      className={cn(
        "pointer-events-auto w-full transition-all duration-300",
        isExpanded ? "z-30 relative" : "z-10"
      )} 
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className={cn(
          "bg-white/90 backdrop-blur-md shadow-2xl border border-gray-100 overflow-hidden rounded-[22px] transition-all duration-300",
          isExpanded ? "ring-1 ring-black/5" : ""
        )}
      >
        <div 
          className="h-[44px] px-3 flex items-center gap-2 cursor-pointer"
          onClick={handleHeaderClick}
        >
          <span className="text-indigo-600 font-black text-sm w-4 italic shrink-0">
            {isExpanded ? "HOT" : currentPost?.rank}
          </span>
          
          {!isExpanded ? (
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                <img
                  src={currentPost?.image}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              </div>
              <div className="flex-1 overflow-hidden relative h-5">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${currentPost?.id}-${currentIndex}`}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.3, opacity: { duration: 0.2 } }}
                    className="text-xs font-bold text-gray-800 truncate absolute inset-0 leading-5"
                  >
                    {currentPost?.content}
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
          
          <ChevronDown 
            className={cn(
              "w-4 h-4 text-gray-400 transition-transform duration-300",
              isExpanded && "rotate-180"
            )} 
          />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden border-t border-gray-50"
            >
              <div className="max-h-[450px] overflow-y-auto no-scrollbar overscroll-contain p-2 space-y-1">
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

                {displayPosts.map((post) => {
                  const isInfluencer = ['silver', 'gold', 'diamond'].includes(post.borderType);
                  // ✅ 인기 포스팅 판정 시 순위(rank) 강제 부여 로직을 제거하고 실제 데이터(borderType)만 따릅니다.
                  const isPopular = post.borderType === 'popular' || isInfluencer;
                  
                  return (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group"
                      onClick={(e) => handleItemClick(e, post)}
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
                            <span className="text-[9px] font-bold text-gray-400 tracking-tighter">👍 {post.likes}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TrendingPosts;