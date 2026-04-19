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
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

// 포스팅 ID를 기반으로 고유한 확률적 등급을 반환하는 헬퍼 (일관성 유지)
const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  
  if (val < 0.01) return 'diamond'; // 1%
  if (val < 0.03) return 'gold';    // 2%
  if (val < 0.07) return 'silver';  // 4%
  if (val < 0.15) return 'popular'; // 8%
  return 'none';
};

const Popular = () => {
  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const hasLoaded = useRef(false);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const loadInitialData = useCallback(async () => {
    if (hasLoaded.current) return;
    
    setIsInitialLoading(true);
    
    try {
      // 1. 좋아요가 높은 상위 100개를 가져옴
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('likes', { ascending: false })
        .limit(100);

      if (error) throw error;

      const realPosts = (data || []).map(p => {
        const borderType = getTierFromId(p.id);
        return {
          id: p.id,
          isAd: p.content?.startsWith('[AD]'),
          isGif: p.content?.startsWith('[GIF]'),
          isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
          user: {
            id: p.user_id,
            name: p.user_name,
            avatar: p.user_avatar
          },
          content: p.content?.replace(/^\[(AD|GIF)\]\s*/, '') || '',
          location: p.location_name,
          lat: p.latitude,
          lng: p.longitude,
          likes: Number(p.likes || 0),
          commentsCount: 0,
          comments: [],
          image: p.image_url,
          youtubeUrl: p.youtube_url,
          videoUrl: p.video_url,
          isLiked: false,
          createdAt: new Date(p.created_at),
          borderType: borderType
        };
      }) as Post[];

      // 2. 목 데이터도 섞어서 추가
      let mockPosts = createMockPosts(37.5665, 126.9780, 20);
      
      // 3. 전체 리스트를 무작위로 섞음 (Shuffle)
      // 이렇게 하면 "인기 있는" 포스팅들이 매번 다른 순서로 나타남
      const combined = [...realPosts, ...mockPosts].sort(() => Math.random() - 0.5);
      
      setPosts(combined);
      hasLoaded.current = true;
    } catch (err) {
      console.error('[Popular] Fetch Error:', err);
      // 에러 시 목 데이터라도 셔플해서 보여줌
      setPosts(createMockPosts(37.5665, 126.9780, 30).sort(() => Math.random() - 0.5));
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (authUser) {
        loadInitialData();
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [authLoading, authUser, loadInitialData, navigate]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore || isInitialLoading) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      let newPosts = createMockPosts(37.5665, 126.9780, 15)
        .sort(() => Math.random() - 0.5);
      
      setPosts(prev => [...prev, ...newPosts]);
      setIsLoadingMore(false);
    }, 800);
  }, [isLoadingMore, isInitialLoading]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && posts.length > 0) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length]);

  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      const isLiked = !post.isLiked;
      return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
    }));
  }, []);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    const post = posts.find(p => p.lat === lat && p.lng === lng);
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleStartLocationSelection = () => {
    setIsWriteOpen(false);
    navigate('/', { state: { startSelection: true } });
  };

  if (authLoading || (isInitialLoading && posts.length === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-gray-400">인기 동영상을 섞는 중...</p>
        </div>
      </div>
    );
  }

  if (!authUser) return null;

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <Header />
      <div className="pt-[88px]">
        <StoryBar />
        <div className="flex flex-col">
          {filteredPosts.map((post) => (
            <PostItem
              key={post.id}
              id={post.id}
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
              youtubeUrl={post.youtubeUrl}
              videoUrl={post.videoUrl}
              disablePulse={true}
              onLikeToggle={() => handleLikeToggle(post.id)}
              onLocationClick={handleLocationClick}
              onDelete={handlePostDelete}
            />
          ))}
        </div>
        <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
          {isLoadingMore ? (
            <>
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">새로운 인기 포스팅을 찾는 중...</p>
            </>
          ) : (
            posts.length > 0 && <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
          )}
        </div>
      </div>
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost 
        isOpen={isWriteOpen} 
        onClose={() => setIsWriteOpen(false)} 
        onStartLocationSelection={handleStartLocationSelection}
      />
    </div>
  );
};

export default Popular;