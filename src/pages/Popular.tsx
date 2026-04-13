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
  const selectedIndex = useMemo(() => posts.findIndex(p => p.id === selectedPostId), [selectedPostId, posts]);

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
          posts={posts} 
          initialIndex={selectedIndex} 
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
        />
      )}
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;