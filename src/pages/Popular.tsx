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
  const { loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      if (authLoading) return;
      
      // 안전장치: 3초 후에는 무조건 로딩 종료
      const timeoutId = setTimeout(() => {
        if (isMounted && isInitialLoading) {
          console.warn('[Popular] Loading timeout - forcing display');
          setIsInitialLoading(false);
        }
      }, 3000);

      try {
        // 1. Supabase 데이터 가져오기 (타임아웃 고려)
        const fetchPromise = supabase
          .from('posts')
          .select('*')
          .order('likes', { ascending: false })
          .limit(20);

        const { data, error } = await fetchPromise;

        const realPosts = (data || []).map(p => ({
          id: p.id,
          isAd: false,
          isGif: false,
          isInfluencer: false,
          user: {
            id: p.user_id,
            name: p.user_name,
            avatar: p.user_avatar
          },
          content: p.content,
          location: p.location_name,
          lat: p.latitude,
          lng: p.longitude,
          likes: Number(p.likes),
          commentsCount: 0,
          comments: [],
          image: p.image_url,
          isLiked: false,
          createdAt: new Date(p.created_at),
          borderType: Number(p.likes) >= 1500 ? 'popular' : 'none'
        })) as Post[];

        // 2. Mock 데이터 생성
        const mockPosts = createMockPosts(37.5665, 126.9780, 20)
          .sort((a, b) => b.likes - a.likes);
        
        if (isMounted) {
          const combined = [...realPosts, ...mockPosts].sort((a, b) => b.likes - a.likes);
          setPosts(combined);
        }
      } catch (err) {
        console.error('[Popular] Data load error:', err);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setIsInitialLoading(false);
      }
    };
    
    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [authLoading]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore || isInitialLoading) return;
    setIsLoadingMore(true);
    
    setTimeout(() => {
      const newPosts = createMockPosts(37.5665, 126.9780, 20)
        .map(p => ({
          ...p,
          likes: Math.floor(Math.random() * 1000) + 1000
        }))
        .sort((a, b) => b.likes - a.likes);
        
      setPosts(prev => [...prev, ...newPosts]);
      setIsLoadingMore(false);
    }, 800);
  }, [isLoadingMore, isInitialLoading]);

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

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        <StoryBar />
        
        {isInitialLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm font-bold text-gray-400">인기 포스팅을 불러오는 중...</p>
          </div>
        ) : (
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
        )}

        <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
          {isLoadingMore ? (
            <>
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">인기 포스팅을 더 불러오는 중...</p>
            </>
          ) : (
            !isInitialLoading && <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
          )}
        </div>
      </div>
      
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;