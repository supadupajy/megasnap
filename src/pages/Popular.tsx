"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Flame, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Post } from '@/types';
import { getFallbackImage } from '@/lib/utils';

import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';

import { toggleLikeInDb } from '@/utils/like-utils';
import PostItem from '@/components/PostItem';
import AdMobBanner from '@/components/AdMobBanner';
import CollapsingHeader from '@/components/CollapsingHeader';
import { useCollapsingHeader } from '@/hooks/use-collapsing-header';

const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

const PAGE_SIZE = 15;
const AD_INSERT_INTERVAL = 3;

// Skeleton 카드 컴포넌트

const PostSkeleton = () => (
  <div className="border-b border-gray-100 p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <Skeleton className="w-full aspect-[4/3] rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
    <div className="flex gap-4">
      <Skeleton className="h-8 w-16 rounded-full" />
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  </div>
);

const Popular = () => {
  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { scrollRef, progress } = useCollapsingHeader(80);

  // 셔플된 전체 풀을 보관 (페이지네이션은 이 배열에서 슬라이싱)
  const shuffledPoolRef = useRef<Post[]>([]);
  const displayedCountRef = useRef(0);

  const hasLoaded = useRef(false);

  const isLoading = authLoading || (isInitialLoading && posts.length === 0);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  // Fisher-Yates 셔플
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const fetchAndShufflePool = useCallback(async () => {
    try {
      // likes_per_hour 기반 상위 200개를 가져와서 셔플 풀로 사용
      const { data, error } = await supabase.rpc('get_trending_posts', { limit_count: 200 });
      if (error) throw error;

      const mapped: Post[] = (data || []).map((p: any) => {
        const followers = Number(p.profiles?.followers ?? 0);
        const borderType = p.hot_since ? 'popular' : getTierFromFollowers(followers);
        const isAd = p.content?.trim().startsWith('[AD]');
        const finalImage = p.image_url || getFallbackImage(String(p.id));
        const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];
        const displayName = p.user_name;
        const displayAvatar = p.user_avatar;
        return {
          id: p.id,
          user_id: p.user_id,
          owner_id: p.user_id,
          isAd,
          isGif: false,
          isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
          user: { id: p.user_id, name: displayName, avatar: displayAvatar },
          content: p.content?.replace(/^\[AD\]\s*/, '') || '',
          location: p.location_name, lat: p.latitude, lng: p.longitude,
          likes: Number(p.likes || 0), commentsCount: 0, comments: [],
          image: finalImage, image_url: finalImage,
          images: finalImages,
          latitude: p.latitude, longitude: p.longitude,
          videoUrl: p.video_url,
          isLiked: false, isSaved: false,
          createdAt: new Date(p.created_at),
          borderType: borderType as any,
          category: p.category || 'none',
        };
      });

      // 매번 새로운 랜덤 순서로 셔플
      shuffledPoolRef.current = shuffle(mapped);
      displayedCountRef.current = 0;
    } catch (err) {
      shuffledPoolRef.current = [];
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (hasLoaded.current) return;
    setIsInitialLoading(true);
    await fetchAndShufflePool();
    const initial = shuffledPoolRef.current.slice(0, PAGE_SIZE);
    displayedCountRef.current = initial.length;
    setPosts(initial);
    setHasMore(shuffledPoolRef.current.length > PAGE_SIZE);
    hasLoaded.current = true;
    setIsInitialLoading(false);
  }, [fetchAndShufflePool]);

  useEffect(() => {
    if (!authLoading) {
      if (authUser) loadInitialData();
      else navigate('/login', { replace: true });
    }
  }, [authLoading, authUser, loadInitialData, navigate]);

  const loadNearbyPosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const next = shuffledPoolRef.current.slice(displayedCountRef.current, displayedCountRef.current + PAGE_SIZE);
    if (next.length > 0) {
      displayedCountRef.current += next.length;
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...next.filter(p => !existingIds.has(p.id))];
      });
      setHasMore(displayedCountRef.current < shuffledPoolRef.current.length);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && posts.length > 0 && hasMore) loadNearbyPosts(); },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadNearbyPosts, posts.length, hasMore]);

  const handleLikeToggle = useCallback((postId: string) => {
    if (!authUser?.id) return;
    let currentlyLiked = false;
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      currentlyLiked = post.isLiked;
      return { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 };
    }));
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        setPosts(prev => prev.map(post => post.id !== postId ? post
          : { ...post, isLiked: currentlyLiked, likes: currentlyLiked ? post.likes + 1 : post.likes - 1 }
        ));
      }
    });
  }, [authUser?.id]);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    const post = posts.find(p => p.lat === lat && p.lng === lng);
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  // PostItem에 안정적인 핸들러 참조를 전달하기 위해 post.id를 클로저로 캡처하지 않음
  // 대신 handleLikeToggle 자체가 useCallback으로 안정화되어 있으므로
  // 렌더 함수 내에서 인라인 화살표 함수 대신 직접 전달
  const handleLikeToggleById = useCallback((postId: string) => {
    handleLikeToggle(postId);
  }, [handleLikeToggle]);

  return (
    <div ref={scrollRef} className="h-screen w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}>
      {/* 고정 상단 헤더 */}
      <div className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-white pt-[64px]">
        <CollapsingHeader
          progress={progress}
          Icon={Flame}
          iconBgClass="bg-orange-100"
          iconColorClass="text-orange-600"
          iconFilled
          title="인기 포스팅"
          subtitle="Trending Now"
          ActionIcon={Search}
          actionLabel="검색"
          onActionClick={() => navigate('/post-search')}
        />
      </div>

      <div>
        {isLoading ? (
          // ✅ Skeleton UI로 즉각적인 피드백
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}
          </div>
        ) : (
          <div className="flex flex-col">
            {(() => {
              const items: React.ReactNode[] = [];
              let postCount = 0;

              filteredPosts.forEach((post) => {
                items.push(
                  <div key={post.id} className="border-b border-gray-100 last:border-0 bg-white">
                    <PostItem
                      post={post}
                      onLikeToggle={handleLikeToggleById}
                      onLocationClick={handleLocationClick}
                      onDelete={handlePostDelete}
                      autoPlayVideo={true}
                      disablePulse={true}
                    />
                  </div>
                );

                postCount++;

                if (postCount % AD_INSERT_INTERVAL === 0) {
                  items.push(
                    <AdMobBanner key={`ad-after-${post.id}`} />
                  );
                }
              });

              return items;
            })()}

            {!isLoading && filteredPosts.length === 0 && (
              <div className="text-center py-20 text-gray-400 font-medium px-10">
                표시할 인기 포스팅이 없습니다.
              </div>
            )}
            
            {hasMore && (
              <div ref={loadMoreRef} className="py-10 flex justify-center">
                {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                모든 인기 포스팅을 불러왔습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Popular;