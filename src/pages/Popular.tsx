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

  const loadInitialData = useCallback(async (uid: string) => {
    if (hasLoaded.current) return;
    
    setIsInitialLoading(true);
    // 목업 데이터 생성 시 인플루언서와 인기 포스팅이 섞이도록 함
    let mockPosts = createMockPosts(37.5665, 126.9780, 20).sort((a, b) => b.likes - a.likes);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('likes', { ascending: false })
        .limit(20);

      if (error) throw error;

      const realPosts = (data || []).map(p => {
        const likes = Number(p.likes || 0);
        const isInfluencer = likes > 5000; 
        
        return {
          id: p.id,
          isAd: false,
          isGif: false,
          isInfluencer: isInfluencer,
          user: {
            id: p.user_id,
            name: p.user_name,
            avatar: p.user_avatar
          },
          content: p.content,
          location: p.location_name,
          lat: p.latitude,
          lng: p.longitude,
          likes: likes,
          commentsCount: 0,
          comments: [],
          image: p.image_url,
          isLiked: false,
          createdAt: new Date(p.created_at),
          borderType: likes >= 1500 ? 'popular' : (isInfluencer ? 'silver' : 'none')
        };
      }) as Post[];

      const combined = [...realPosts, ...mockPosts].sort((a, b) => b.likes - a.likes);
      setPosts(combined);
      hasLoaded.current = true;
    } catch (err) {
      console.error('[Popular] Fetch Error:', err);
      setPosts(mockPosts);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (authUser) {
        loadInitialData(authUser.id);
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
        .map(p => ({ ...p, likes: Math.floor(Math.random() * 2000) + 1000 }))
        .sort((a, b) => b.likes - a.likes);
      
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
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
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
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">인기 포스팅을 더 불러오는 중...</p>
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