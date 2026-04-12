"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  rank: number;
  user: { name: string; avatar: string };
  content: string;
  location: string;
  likes: number;
  image: string;
  isLiked: boolean;
};

interface TrendingPostsProps {
  posts: Post[];
  isExpanded: boolean;
  onToggle: () => void;
  onPostClick: (post: Post) => void;
}

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
    e.stopPropagation();
    onPostClick(post);
  };

  if (displayPosts.length === 0) return null;

  return (
    <div className="pointer-events-auto w-full">
      <div 
        className={cn(
          "bg-white/90 backdrop-blur-md shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300",
          isExpanded ? "rounded-[24px]" : "rounded-full"
        )}
      >
        {/* Header: Always visible, acts as the trigger */}
        <div 
          className="h-[44px] px-3 flex items-center gap-2"
          onClick={onToggle}
        >
          <span className="text-green-600 font-black text-sm w-4 italic shrink-0">
            {isExpanded ? "HOT" : currentPost?.rank}
          </span>
          
          {!isExpanded ? (
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                <img
                  src={currentPost?.image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 overflow-hidden relative h-5">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${currentPost?.id}-${currentIndex}`}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
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

        {/* Dropdown Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden border-t border-gray-50"
            >
              <div className="max-h-[320px] overflow-y-auto no-scrollbar overscroll-contain p-2">
                {displayPosts.map((post, idx) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                    onClick={(e) => handleItemClick(e, post)}
                  >
                    <span
                      className={cn(
                        "text-sm font-black italic w-4 shrink-0",
                        post.rank <= 3 ? "text-green-500" : "text-gray-300",
                      )}
                    >
                      {post.rank}
                    </span>
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      <img
                        src={post.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-bold text-gray-800 truncate flex-1">
                      {post.content}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TrendingPosts;