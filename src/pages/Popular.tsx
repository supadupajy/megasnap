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

  // ✅ Fix 1: false로 초기화
  // authLoading이 끝나기 전엔 데이터 로딩 자체를 시작하지 않으므로
  // true로 초기화하면 authLoading 중 loadInitialData가 조기 return할 때
  // isInitialLoading이 영원히 true로 남아 무한 스피너 발생
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // ✅ Fix 2: 타임아웃 제거 → authLoading 완료 후 redirect
  // 기존: isInitialLoading && !authUser 조건으로 3초 후 강제 이동
  // → 세션 복원이 3초 넘으면 로그인 페이지로 튕김
  // 수정: authLoading이 끝난 뒤에만 authUser 유무 판단
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, authUser, navigate]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const loadInitialData = useCallback(async () => {
    if (!authUser) return;

    // ✅ Fix 3: authLoading 의존성 제거
    // loadInitialData 실행 자체를 아래 useEffect에서 !authLoading && authUser 조건으로 제어하므로
    // 함수 내부에서 authLoading을 다시 체크할 필요 없음
    // authLoading이 의존성에 있으면 authLoading 변화마다 함수가 재생성되어 불필요한 재실행 유발

    setIsInitialLoading(true);
    const mockPosts = createMockPosts(37.5665, 126.9780, 20).sort((a, b) => b.likes - a.likes);

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
          name: p.user_name,
          avatar: p.user_avatar
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

      const combined = [...realPosts, ...mockPosts].sort((a, b) => b.likes - a.likes);
      setPosts(combined);
    } catch (err) {
      console.error('[Popular] DB Fetch Error:', err);
      setPosts(mockPosts);
    } finally {
      setIsInitialLoading(false);
    }
  }, [authUser]); // ✅ authLoading 제거

  // ✅ Fix 4: authLoading 완료 후에만 데이터 로드
  // 기존: loadInitialData 내부에서 authLoading 체크 후 return
  // → isInitialLoading이 true인 채로 멈춰 무한 스피너 가능
  // 수정: useEffect에서 조건부 실행으로 제어
  useEffect(() => {
    if (!authLoading && authUser) {
      loadInitialData();
    }
  }, [authLoading, authUser, loadInitialData]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore || isInitialLoading) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      const newPosts = createMockPosts(37.5665, 126.9780, 15)
        .map(p => ({ ...p, likes: Math.floor(Math.random() * 1000) + 500 }))
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

  // ✅ Fix 5: 로딩 조건 분리
  // - authLoading: 세션 복원 중 → 무조건 스피너
  // - isInitialLoading && posts.length === 0: 첫 데이터 로드 중 → 스피너
  // 기존 (isInitialLoading && !authUser) 조건은 세션 복원 완료 전엔 항상 true여서
  // 로그인된 사용자도 스피너에 갇힐 수 있었음
  if (authLoading || (isInitialLoading && posts.length === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // ✅ Fix 6: authUser 없으면 null 반환 (useEffect가 redirect 처리)
  if (!authUser) return null;

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        <StoryBar />
        {isInitialLoading && posts.length === 0 ? (
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