"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const Popular = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 초기 데이터 로드
  useEffect(() => {
    const initialPosts = createMockPosts(37.5665, 126.9780, 20)
      .sort((a, b) => b.likes - a.likes);
    setPosts(initialPosts);
  }, []);

  // 추가 데이터 로드 함수
  const loadMorePosts = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    
    // 실제 API 호출을 시뮬레이션하기 위한 지연 시간
    setTimeout(() => {
      const newPosts = createMockPosts(37.5665, 126.9780, 20)
        .map(p => ({
          ...p,
          likes: Math.floor(Math.random() * 1000) + 500 // 인기 탭이므로 높은 좋아요 수 유지
        }))
        .sort((a, b) => b.likes - a.likes);
        
      setPosts(prev => [...prev, ...newPosts]);
      setIsLoadingMore(false);
    }, 800);
  }, [isLoadingMore]);

  // Intersection Observer 설정
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && posts.length > 0) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMorePosts, posts.length]);
  
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
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        <StoryBar />
        <div className="flex flex-col">
          {posts.map((post) => (
            <PostItem
              key={post.id}
              user={post.user}
              content={post.content}
              location={post.location}
              likes={post.likes}
              commentsCount={post.commentsCount}
              comments={post.comments}
              image={post.image}
              images={post.images}
              adImageIndex={post.adImageIndex}
              lat={post.lat}
              lng={post.lng}
              isLiked={post.isLiked}
              isAd={post.isAd}
              isGif={post.isGif}
              isInfluencer={post.isInfluencer}
              category={post.category}
              borderType={post.borderType}
              disablePulse={true}
              onLikeToggle={() => handleLikeToggle(post.id)}
              onLocationClick={handleLocationClick}
            />
          ))}
        </div>

        {/* 로딩 인디케이터 및 관찰 대상 */}
        <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
          {isLoadingMore ? (
            <>
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">인기 포스팅을 더 불러오는 중...</p>
            </>
          ) : (
            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
          )}
        </div>
      </div>
      
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;