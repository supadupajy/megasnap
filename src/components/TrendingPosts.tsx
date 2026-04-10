"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trophy } from "lucide-react";
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
  posts: Post[];                     // <-- dynamic posts passed from Index
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

  // Limit to at most 40 items for display  const displayPosts = posts.slice(0, 40);

  // Auto‑rotate when collapsed
  useEffect(() => {
    if (isExpanded) return;
    const timer = setInterval(
      () => setCurrentIndex((prev) => (prev + 1) % displayPosts.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [isExpanded, displayPosts]);

  const currentPost = displayPosts[currentIndex];

  const handleItemClick = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    onPostClick(post);
  };

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={cn(
        "bg-white/90 backdrop-blur-md rounded-[22px] shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all w-full",
        isExpanded ? "p-2" : "px-3",
      )}
      onClick={onToggle}
    >
      {/* Collapsed view */}
      {!isExpanded && (
        <div className="h-full flex items-center gap-2">
          <span className="text-green-600 font-black text-sm w-4 italic">
            {currentPost.rank}
          </span>
          <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
            <img src={currentPost.image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 overflow-hidden relative h-5">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentIndex}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-xs font-bold text-gray-800 truncate absolute inset-0 leading-5"
              >
                {currentPost.content}
              </motion.p>
            </AnimatePresence>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      )}

      {/* Expanded view – now sized to show up to 40 items */}
      {isExpanded && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-gray-50">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                Real-time Popular
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
          </div>

          {/* Height set to accommodate ~40 items (≈44 px each) */}
          <div className="max-h-[1760px] overflow-y-auto no-scrollbar">
            {displayPosts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: post.rank * 0.05 }}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                onClick={(e) => handleItemClick(e, post)}
              >
                <span
                  className={cn(
                    "text-sm font-black italic w-4",
                    post.rank <= 3 ? "text-green-500" : "text-gray-300",
                  )}
                >
                  {post.rank}
                </span>
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  <img src={post.image} alt="" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-bold text-gray-800 truncate flex-1">
                  {post.content}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TrendingPosts;