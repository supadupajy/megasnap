"use client";

import React, { useState } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';

// Generate mock posts with guaranteed 1 popular + 0~2 random special borders
const generateMockPosts = () => {
  // Create 20 posts with default borderType = 'none'
  const posts = Array.from({ length: 20 }).map((_, i) => ({
    id: `pop-${i}`,
    user: {
      name: `star_traveler_${i}`,
      avatar: `https://i.pravatar.cc/150?u=pop${i}`,
    },
    content:
      "인기 급상승 중인 핫플레이스! 정말 아름다운 풍경입니다. #인기 #추천 #여행 #일상 #소통",
    location: ["서울 성수동", "제주 애월", "부산 해운대", "강릉 안목해변"][i % 4],
    likes: 2500 - i * 50,
    image: `https://picsum.photos/seed/pop${i}/800/800`,
    isLiked: true,
    borderType: 'none' as 'popular' | 'silver' | 'gold' | 'none',
  }));

  // Create shuffled indices
  const indices = Array.from({ length: posts.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // GUARANTEE: First post always gets 'popular' (red animated border)
  const popularIndex = indices[0];
  posts[popularIndex].borderType = 'popular';

  // Additional 0~2 random special borders (silver or gold)
  const extraCount = Math.floor(Math.random() * 3); // 0, 1, or 2
  const borderTypes: Array<'silver' | 'gold'> = ['silver', 'gold'];
  
  for (let i = 1; i <= extraCount; i++) {
    const idx = indices[i];
    if (idx && posts[idx]) {
      posts[idx].borderType = borderTypes[i % borderTypes.length];
    }
  }

  return posts;
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