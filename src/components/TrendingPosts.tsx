"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_TRENDING = Array.from({ length: 10 }).map((_, i) => ({
  id: i + 1,
  rank: i + 1,
  title: [
    "성수동 힙한 카페 발견!",
    "제주도 숨은 명소 공유합니다",
    "여기 진짜 인생 맛집이에요..",
    "강릉 바다 보러 왔어요 🌊",
    "서울 야경 명소 추천!",
    "부산 광안리 드론쇼 직관 후기",
    "경주 황리단길 산책하기",
    "전주 한옥마을 먹거리 투어",
    "인천 송도 센트럴파크 피크닉",
    "대구 수성못 야경이 예쁘네요"
  ][i],
  image: `https://picsum.photos/seed/trend${i + 1}/100/100`
}));

interface TrendingPostsProps {
  isExpanded: boolean;
  onToggle: () => void;
}

const TrendingPosts = ({ isExpanded, onToggle }: TrendingPostsProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // 5초마다 순환하는 타이머
  useEffect(() => {
    if (isExpanded) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % 10);
    }, 5000);

    return () => clearInterval(timer);
  }, [isExpanded]);

  const currentPost = MOCK_TRENDING[currentIndex];

  return (
    <div className="w-full">
      <motion.div
        animate={{ 
          height: isExpanded ? 'auto' : '44px',
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "bg-white/90 backdrop-blur-md rounded-[22px] shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all w-full",
          isExpanded ? "p-2" : "px-3"
        )}
        onClick={onToggle}
      >
        {/* 닫혔을 때: 순환하는 한 줄 화면 */}
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
                  {currentPost.title}
                </motion.p>
              </AnimatePresence>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* 펼쳐졌을 때: 1~10위 리스트 */}
        {isExpanded && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-gray-50">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Real-time Popular</span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
            </div>
            <div className="max-h-[300px] overflow-y-auto no-scrollbar">
              {MOCK_TRENDING.map((post) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: post.rank * 0.05 }}
                  key={post.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <span className={cn(
                    "text-sm font-black italic w-4",
                    post.rank <= 3 ? "text-green-500" : "text-gray-300"
                  )}>
                    {post.rank}
                  </span>
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={post.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs font-bold text-gray-800 truncate flex-1">
                    {post.title}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default TrendingPosts;