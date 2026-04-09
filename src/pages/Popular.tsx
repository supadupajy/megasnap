"use client";

import React, { useState } from 'react';
import { Trophy, Heart } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';

const MOCK_POPULAR = Array.from({ length: 20 }).map((_, i) => ({
  id: `pop-${i}`,
  user: {
    name: `star_traveler_${i}`,
    avatar: `https://i.pravatar.cc/150?u=pop${i}`
  },
  content: "인기 급상승 중인 핫플레이스! 정말 아름다운 풍경입니다. #인기 #추천 #여행",
  location: ["서울", "제주", "부산", "강릉"][i % 4],
  likes: 2500 - (i * 50),
  image: `https://picsum.photos/seed/pop${i}/600/600`,
  isLiked: true
}));

const Popular = () => {
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header />
      
      <div className="pt-20 px-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">실시간 인기</h2>
            <p className="text-xs text-gray-400 font-medium">지금 가장 핫한 장소들을 확인해보세요</p>
          </div>
        </div>

        {/* 2열 그리드 레이아웃 */}
        <div className="grid grid-cols-2 gap-3">
          {MOCK_POPULAR.map((post) => (
            <div 
              key={post.id} 
              className="relative aspect-square rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform cursor-pointer group"
              onClick={() => setSelectedPost(post)}
            >
              <img 
                src={post.image} 
                alt="" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-white" />
                  <span className="text-[10px] font-bold">{post.likes}</span>
                </div>
                <span className="text-[10px] font-medium truncate max-w-[60px]">{post.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <PostDetail post={selectedPost} isOpen={!!selectedPost} onClose={() => setSelectedPost(null)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;