"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Flame, ExternalLink, Sparkles, TrendingUp } from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div 
        ref={containerRef}
        className={cn(
          "bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl border transition-all duration-500 overflow-hidden",
          isExpanded ? "max-h-[500px] border-indigo-200" : "max-h-16 border-indigo-100"
        )}
      >
        <div 
          onClick={onToggle}
          className="h-16 px-5 flex items-center justify-between cursor-pointer hover:bg-white/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-0.5">Live Trending</span>
              <span className="text-sm font-black text-gray-900 leading-none">실시간 인기 포스팅</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 mr-1">
              {posts.slice(0, 3).map((post, i) => (
                <div key={post.id} className="w-7 h-7 rounded-full border-2 border-white overflow-hidden bg-gray-100 shadow-sm">
                  <img src={post.image} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform duration-300", isExpanded && "rotate-180")} />
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar">
            {posts.map((post, index) => (
              <div 
                key={post.id}
                onClick={() => onPostClick(post)}
                className="group flex items-center gap-3 p-2.5 rounded-2xl hover:bg-indigo-50/50 transition-all cursor-pointer border border-transparent hover:border-indigo-100"
              >
                <div className="w-11 h-11 rounded-xl flex-shrink-0 relative transition-all duration-300">
                  <div className={cn(
                    "w-full h-full relative bg-white",
                    post.borderType !== 'none' ? "rounded-[9px] overflow-hidden" : ""
                  )}>
                    <img
                      src={post.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80';
                      }}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingPosts;