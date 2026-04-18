"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';
import { createMockPosts, YOUTUBE_LINKS } from '@/lib/mock-data';
import { Post } from '@/types';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { getYoutubeThumbnail } from '@/lib/utils';

const Popular = () => {
  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, profile, loading: authLoading } = useAuth();
  
  // 초기 상태를 목데이터로 설정하여 빈 화면 방지
  const [posts, setPosts] = useState<Post[]>(() => {
    return createMockPosts(37.5665, 126.9780, 10).sort((a, b) => b.likes - a.likes);
  });
  
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  const displayName = useMemo(() => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가', [profile, authUser]);
  const avatarUrl = useMemo(() => profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser?.id}`, [profile, authUser]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  useEffect(() => {
    const loadData = async () => {
      if (authLoading) return;
      
      setIsInitialLoading(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('likes', { ascending: false })
          .limit(20);

        if (error) throw error;

        const realPosts = (data || []).map(p => ({
          id: p.id,
          isAd: false,
          isGif: false,
          isInfluencer: false,
          user: {
            id: p.user_id,
            name: p.user_name || displayName,
            avatar: p.user_avatar || avatarUrl
          },
          content: p.content,
          location: p.location_name,
          lat: p.latitude,
          lng: p.longitude,
          likes: Number(p.likes || 0),
          commentsCount: 0,
          comments: [],
          image: p.image_url,
          isLiked: false,
          createdAt: new Date(p.created_at),
          borderType: Number(p.likes || 0) >= 1500 ? 'popular' : 'none'
        })) as Post[];

        // 목데이터와 실제 데이터를 합침
        const mockPosts = createMockPosts(37.5665, 126.9780, 10);
        const combined = [...realPosts, ...mockPosts].sort((a, b) => b.likes - a.likes);
        setPosts(combined);
      } catch (err) {
        console.error('[Popular] Fetch Error:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadData();
  }, [authLoading, displayName, avatarUrl]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      const newPosts = createMockPosts(37.5665, 126.9780, 10)
        .map(p => ({ ...p, likes: Math.floor(Math.random() * 1000) + 500 }))
        .sort((a, b) => b.likes - a.likes);
      
      setPosts(prev => [...prev, ...newPosts]);
      setIsLoadingMore(false);
    }, 800);
  }, [isLoadingMore]);

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
              youtubeUrl={post.youtubeUrl}
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
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Popular;