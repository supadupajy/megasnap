"use client";

import React, { useState } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';

const MOCK_POPULAR = Array.from({ length: 20 }).map((_, i) => {
  // 10개 중 1개 꼴로 특별한 테두리 부여 (한 화면에 1~2개 정도 보이도록)
  let borderType: 'popular' | 'silver' | 'gold' | 'none' = 'none';
  if (i === 2) borderType = 'popular';
  if (i === 5) borderType = 'gold';
  if (i === 12) borderType = 'silver';
  if (i === 15) borderType = 'popular';

  return {
    id: `pop-${i}`,
    user: {
      name: `star_traveler_${i}`,
      avatar: `https://i.pravatar.cc/150?u=pop${i}`
    },
    content: "인기 급상승 중인 핫플레이스! 정말 아름다운 풍경입니다. #인기 #추천 #여행 #일상 #소통",
    location: ["서울 성수동", "제주 애월", "부산 해운대", "강릉 안목해변"][i % 4],
    likes: 2500 - (i * 50),
    image: `https://picsum.photos/seed/pop${i}/800/800`,
    isLiked: true,
    borderType
  };
});

const Popular = () => {
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header />
      
      <div className="pt-[88px]">
        {/* 상단 프로필 스토리 바 */}
        <StoryBar />

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
                borderType={post.borderType as any}
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