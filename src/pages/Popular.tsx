"use client";

import React, { useState } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';

// Generate mock posts with 1~3 random special borders
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
    // Default borderType is 'none'
    borderType: 'none' as 'popular' | 'silver' | 'gold' | 'none',
  }));

  // Determine how many special borders (1~3)
  const specialCount = Math.min(3, posts.length); // Ensure we don't exceed post count
  const indices = Array.from({ length: posts.length }, (_, i) => i); // Create [0,1,2,...]
  
  // Shuffle indices
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  // Assign random border types to 1~3 posts
  const borderTypes: Array<'popular' | 'silver' | 'gold'> = ['popular', 'silver', 'gold'];
  indices.slice(0, specialCount).forEach((idx, i) => {
    // Safely assign borderType only if post exists
    if (posts[idx]) {
      posts[idx].borderType = borderTypes[i % borderTypes.length];
    }
  });

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