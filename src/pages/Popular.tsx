"use client";

import React, { useState } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';

// Generate mock posts with guaranteed popular posts every 2 items
const generateMockPosts = () => {
  return Array.from({ length: 30 }).map((_, i) => {
    // Every 2nd post is 'popular' to ensure at least one is visible on screen at all times
    const isPopular = i % 2 === 0;
    
    return {
      id: `pop-${i}`,
      user: {
        name: `star_traveler_${i}`,
        avatar: `https://i.pravatar.cc/150?u=pop${i}`,
      },
      content: isPopular 
        ? "🔥 지금 가장 핫한 장소! 실시간 인기 포스팅입니다. #인기 #핫플 #추천"
        : "오늘의 추천 장소입니다. 분위기가 정말 좋네요. #일상 #여행 #소통",
      location: ["서울 성수동", "제주 애월", "부산 해운대", "강릉 안목해변"][i % 4],
      likes: isPopular ? 5000 - i * 20 : 1200 - i * 10,
      image: `https://picsum.photos/seed/pop${i}/800/800`,
      isLiked: true,
      borderType: isPopular ? 'popular' : 'none' as any,
    };
  });
};

const MOCK_POPULAR = generateMockPosts();

const Popular = () => {
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header />
      <div className="pt-[88px]">
        <StoryBar />
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
                borderType={post.borderType}
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