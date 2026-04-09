"use client";

import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';

const MOCK_POPULAR = Array.from({ length: 20 }).map((_, i) => ({
  id: `pop-${i}`,
  user: {
    name: `star_traveler_${i}`,
    avatar: `https://i.pravatar.cc/150?u=pop${i}`
  },
  content: "인기 급상승 중인 핫플레이스! 정말 아름다운 풍경입니다. #인기 #추천 #여행 #일상 #소통",
  location: ["서울 성수동", "제주 애월", "부산 해운대", "강릉 안목해변"][i % 4],
  likes: 2500 - (i * 50),
  image: `https://picsum.photos/seed/pop${i}/800/800`,
  isLiked: true
}));

const Popular = () => {
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header />
      
      <div className="pt-14">
        {/* Title Section */}
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center shadow-sm">
              <Trophy className="w-7 h-7 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">실시간 인기 피드</h2>
              <p className="text-xs text-gray-400 font-medium">지금 가장 많은 사랑을 받는 장소들</p>
            </div>
          </div>
        </div>

        {/* Instagram Style Feed */}
        <div className="flex flex-col">
          {MOCK_POPULAR.map((post) => (
            <div key={post.id} onClick={() => setSelectedPost(post)}>
              <PostItem 
                user={post.user}
                content={post.content}
                location={post.location}
                likes={post.likes}
                image={post.image}
                isLiked={post.isLiked}
              />
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