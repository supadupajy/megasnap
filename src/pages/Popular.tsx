"use client";

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const Popular = () => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  
  const posts = useMemo(() => createMockPosts(37.5665, 126.9780, 30).sort((a, b) => b.likes - a.likes), []);
  
  // 선택된 포스팅이 리스트의 맨 처음에 오도록 재정렬
  const detailPosts = useMemo(() => {
    if (!selectedPostId) return posts;
    const selected = posts.find(p => p.id === selectedPostId);
    const others = posts.filter(p => p.id !== selectedPostId);
    return selected ? [selected, ...others] : posts;
  }, [posts, selectedPostId]);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        <StoryBar />
        <div className="flex flex-col">
          {posts.map((post) => (
            <div key={post.id} onClick={() => setSelectedPostId(post.id)}>
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
      {selectedPostId && (
        <PostDetail 
          posts={detailPosts} 
          initialIndex={0} // 항상 0번(최상단)에서 시작
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
        />
      )}
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;