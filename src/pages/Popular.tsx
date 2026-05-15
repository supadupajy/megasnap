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

import { fetchLikedPostIds, toggleLikeInDb } from '@/utils/like-utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
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

// 친구 포스팅 - 조회 감지 컴포넌트
const ViewedAwarePostItem = React.memo(({
  post,
  isViewed,
  onVisible,
  onLikeToggle,
  onLocationClick,
  onDelete,
}: {
  post: Post;
  isViewed: boolean;
  onVisible: (id: string) => void;
  onLikeToggle: () => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete: (id: string) => void;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (post.isAd || !post.isFriendPost) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(post.id);
          observer.unobserve(entry.target);
        }
      },
      { threshold: [0.6], rootMargin: '-10% 0px -10% 0px' }
    );

    if (itemRef.current) observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [post.id, post.isAd, post.isFriendPost, onVisible]);

  return (
    <div ref={itemRef} className="border-b border-gray-100 last:border-0 bg-white">
      <PostItem
        post={post}
        isViewed={isViewed}
        onLikeToggle={onLikeToggle}
        onLocationClick={onLocationClick}
        onDelete={onDelete}
        autoPlayVideo={true}
        disablePulse={true}
      />
    </div>
  );
});

const mapPost = (p: any, isFriend = false): Post => {
  const followers = Number(p.profiles?.followers ?? 0);
  const borderType = p.hot_since ? 'popular' : getTierFromFollowers(followers);
  const isAd = p.content?.trim().startsWith('[AD]');
  const finalImage = p.image_url || getFallbackImage(String(p.id));
  const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];
  return {
    id: p.id,
    user_id: p.user_id,
    owner_id: p.user_id,
    isAd,
    isGif: false,
    isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
    isFriendPost: isFriend,
    user: {
      id: p.user_id,
      name: p.profiles?.nickname || p.user_name || '사용자',
      avatar: p.profiles?.avatar_url || p.user_avatar || '',
    },
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
};

// Fisher-Yates 셔플
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const Popular = () => {
  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const { initialViewedIds, markAsViewed, hasLoadedViewedHistory } = useViewedPosts();

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { scrollRef, progress } = useCollapsingHeader(80);

  // 셔플된 혼합 풀 (인기 + 친구 포스팅 created_at 정렬)
  const mergedPoolRef = useRef<Post[]>([]);
  // 상단 고정 새 친구 포스팅 (미열람)
  const newFriendPostsRef = useRef<Post[]>([]);
  const displayedCountRef = useRef(0);
  const hasLoaded = useRef(false);

  // 초기 열람 기록 스냅샷 (페이지 진입 시점 기준)
  const [dividerViewedIds, setDividerViewedIds] = useState<Set<string>>(new Set());
  const hasCapturedSnapshotRef = useRef(false);

  useEffect(() => {
    if (hasCapturedSnapshotRef.current || !hasLoadedViewedHistory) return;
    hasCapturedSnapshotRef.current = true;
    if (initialViewedIds.size > 0) {
      setDividerViewedIds(new Set(initialViewedIds));
    }
  }, [hasLoadedViewedHistory, initialViewedIds]);

  const isLoading = authLoading || (isInitialLoading && posts.length === 0);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const fetchAndBuildPool = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      // 1) 인기 포스팅 200개 (랜덤 셔플)
      const { data: popularData, error: popularError } = await supabase.rpc('get_popular_posts', { limit_count: 200 });
      if (popularError) throw popularError;

      const popularPosts: Post[] = (popularData || []).map((p: any) => mapPost(p, false));
      const shuffledPopular = shuffle(popularPosts);

      // 2) 팔로잉 목록
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', authUser.id);

      const followingIds = (followsData || []).map((f: any) => f.following_id);

      let allFriendPosts: Post[] = [];

      if (followingIds.length > 0) {
        // 3) 친구 포스팅 전체 (최신순, 최대 500개)
        const { data: friendData } = await supabase
          .from('posts')
          .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles!posts_user_id_fkey(nickname, avatar_url, followers)')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(500);

        allFriendPosts = (friendData || []).map((p: any) => mapPost(p, true));

        // 좋아요 상태 반영
        if (allFriendPosts.length > 0) {
          const likedIds = await fetchLikedPostIds(allFriendPosts.map(p => p.id), authUser.id);
          allFriendPosts = allFriendPosts.map(p => ({ ...p, isLiked: likedIds.has(String(p.id)) }));
        }
      }

      // 4) 인기 포스팅에도 좋아요 상태 반영
      let finalPopular = shuffledPopular;
      if (finalPopular.length > 0) {
        const likedIds = await fetchLikedPostIds(finalPopular.map(p => p.id), authUser.id);
        finalPopular = finalPopular.map(p => ({ ...p, isLiked: likedIds.has(String(p.id)) }));
      }

      // 5) 현재 열람 기록 스냅샷 (이 시점 기준)
      const viewedSnapshot = new Set(initialViewedIds);

      // 6) 새 친구 포스팅 (미열람) → 상단 고정, created_at 내림차순
      const newFriendPosts = allFriendPosts
        .filter(p => !viewedSnapshot.has(p.id))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // 7) 나머지 친구 포스팅 (이미 열람) + 인기 포스팅 → created_at 내림차순 혼합
      const viewedFriendPosts = allFriendPosts.filter(p => viewedSnapshot.has(p.id));

      // 인기 포스팅과 열람된 친구 포스팅을 created_at 기준으로 합쳐서 정렬
      // 단, 인기 포스팅은 셔플 순서를 유지하되 친구 포스팅과 시간 기준으로 인터리브
      const combined = [...finalPopular, ...viewedFriendPosts]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // 중복 제거 (친구 포스팅이 인기 포스팅에도 포함될 수 있음)
      const seenIds = new Set<string>();
      const deduped = combined.filter(p => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });

      newFriendPostsRef.current = newFriendPosts;
      mergedPoolRef.current = deduped;
      displayedCountRef.current = 0;
    } catch (err) {
      mergedPoolRef.current = [];
      newFriendPostsRef.current = [];
    }
  }, [authUser?.id, initialViewedIds]);

  const loadInitialData = useCallback(async () => {
    if (hasLoaded.current) return;
    setIsInitialLoading(true);
    await fetchAndBuildPool();

    // 새 친구 포스팅 + 혼합 풀 첫 PAGE_SIZE개
    const initial = mergedPoolRef.current.slice(0, PAGE_SIZE);
    displayedCountRef.current = initial.length;
    setPosts([...newFriendPostsRef.current, ...initial]);
    setHasMore(mergedPoolRef.current.length > PAGE_SIZE);
    hasLoaded.current = true;
    setIsInitialLoading(false);
  }, [fetchAndBuildPool]);

  useEffect(() => {
    if (!authLoading && !hasLoadedViewedHistory) return; // 열람 기록 로드 대기
    if (!authLoading) {
      if (authUser) loadInitialData();
      else navigate('/login', { replace: true });
    }
  }, [authLoading, authUser, loadInitialData, navigate, hasLoadedViewedHistory]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const next = mergedPoolRef.current.slice(displayedCountRef.current, displayedCountRef.current + PAGE_SIZE);
    if (next.length > 0) {
      displayedCountRef.current += next.length;
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...next.filter(p => !existingIds.has(p.id))];
      });
      setHasMore(displayedCountRef.current < mergedPoolRef.current.length);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && posts.length > 0 && hasMore) loadMore(); },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore, posts.length, hasMore]);

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

  return (
    <div ref={scrollRef} className="h-screen w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
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
          collapseActionToIcon
        />
      </div>

      <div>
        {isLoading ? (
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
                  <ViewedAwarePostItem
                    key={post.id}
                    post={post}
                    isViewed={post.isFriendPost ? dividerViewedIds.has(post.id) : false}
                    onVisible={markAsViewed}
                    onLikeToggle={() => handleLikeToggle(post.id)}
                    onLocationClick={handleLocationClick}
                    onDelete={handlePostDelete}
                  />
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
                모든 포스팅을 불러왔습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Popular;
