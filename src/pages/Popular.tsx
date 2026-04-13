"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const Popular = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  
  useEffect(() => {
    const initialPosts = createMockPosts(37.5665, 126.9780, 30).sort((a, b) => b.likes - a.likes);
    setPosts(initialPosts);
  }, []);
  
  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likes: isLiked ? post.likes + 1 : post.likes - 1
        };
      }
      return post;
    }));
  }, []);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    const post = posts.find(p => p.lat === lat && p.lng === lng);
    navigate('/map', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

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
                images={post.images}
                adImageIndex={post.adImageIndex}
                lat={post.lat}
                lng={post.lng}
                isLiked={post.isLiked}
                isGif={post.isGif}
                isInfluencer={post.isInfluencer}
                borderType={post.borderType}
                disablePulse={true}
                onLikeToggle={() => handleLikeToggle(post.id)}
                onLocationClick={handleLocationClick}
              />
            </div>
          ))}
        </div>
      </div>
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      {selectedPostId && (
        <PostDetail 
          posts={detailPosts} 
          initialIndex={0}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
          onLikeToggle={handleLikeToggle}
          onLocationClick={(lat, lng) => {
            navigate('/map', { state: { center: { lat, lng } } });
          }}
        />
      )}
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;