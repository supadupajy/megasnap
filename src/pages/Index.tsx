"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import BottomNav from '@/components/BottomNav';
import NaverMapContainer from '@/components/NaverMapContainer';

const Index = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // 위경도 좌표를 포함한 목업 데이터
  const mockPosts = [
    {
      id: 1,
      user: { name: '지민', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
      content: '경복궁에서 한복 체험 🏯 너무 예뻐요!',
      location: '경복궁',
      lat: 37<dyad-write path="src/pages/Index.tsx" description="네이버 지도를 적용한 메인 페이지 업데이트">
"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import BottomNav from '@/components/BottomNav';
import NaverMapContainer from '@/components/NaverMapContainer';

const Index = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // 위경도 좌표를 포함한 목업 데이터
  const mockPosts = [
    {
      id: 1,
      user: { name: '지민', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
      content: '경복궁에서 한복 체험 🏯 너무 예뻐요!',
      location: '경복궁',
      lat: 37.5796,
      lng: 126.9770,
      likes: 234,
      image: 'https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=400',
      isLiked: false
    },
    {
      id: 2,
      user: { name: '수현', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
      content: '남산타워에서 본 야경이 정말 최고였어요 ✨',
      location: '남산서울타워',
      lat: 37.5512,
      lng: 126.9882,
      likes: 567,
      image: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400',
      isLiked: true
    },
    {
      id: 3,
      user: { name: '민준', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
      content: '한강 공원에서 피크닉 즐기기 딱 좋은 날씨네요 🍕',
      location: '반포한강공원',
      lat: 37.5115,
      lng: 126.9945,
      likes: 128,
      image: 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=400',
      isLiked: false
    }
  ];

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />

      {/* Map Area */}
      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <NaverMapContainer posts={mockPosts} />
      </main>

      {/* Bottom Sheet */}
      <motion.div 
        initial={{ y: "75%" }}
        animate={{ y: isSheetOpen ? "15%" : "75%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 pointer-events-none"
      >
        <div className="absolute inset-x-0 bottom-0 h-full bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pointer-events-auto flex flex-col">
          {/* Handle */}
          <div 
            className="w-full py-4 flex flex-col items-center cursor-pointer"
            onClick={() => setIsSheetOpen(!isSheetOpen)}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
            <div className="flex items-center gap-1 text-gray-500">
              <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isSheetOpen ? 'rotate-180' : ''}`} />
              <span className="text-sm font-medium">주변 게시물</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-40">
            {mockPosts.map(post => (
              <PostItem key={post.id} {...post} />
            ))}
            {/* Extra items for scrolling demo */}
            {mockPosts.map(post => (
              <PostItem key={`copy-${post.id}`} {...post} />
            ))}
          </div>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
};

export default Index;