"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Post } from '@/types';
import { cn, getFallbackImage } from '@/lib/utils';

import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { fetchLikedPostIds, toggleLikeInDb } from '@/utils/like-utils';
import PostItem from '@/components/PostItem';
import AdMobBanner from '@/components/AdMobBanner';
import CollapsingHeader from '@/components/CollapsingHeader';
import { useCollapsingHeader } from '@/hooks/use-collapsing-header';
import { useViewedPosts } from '@/hooks/use-viewed-posts';

const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

const PAGE_SIZE = 15;

const mapPostImmediate = (p: any): Post => {
  const followers = Number(p.profiles?.followers ?? 0);
  const borderType = p.hot_since ? 'popular' : getTierFromFollowers(followers);
  const isAd = p.content?.trim().startsWith('[AD]');
  const finalImage = p.image_url || getFallbackImage(String(p.id));
  const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];
  return {
    id: p.id, isAd, isGif: false, isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
    user: { id: p.user_id, name: p.profiles?.nickname || p.user_name || '사용자', avatar: p.profiles?.avatar_url || p.user_avatar || '' },
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
    owner_id: p.user_id,
  };
};

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
  </div>
);

const AD_INSERT_INTERVAL = 3;

const ViewedAwareFriendPostItem = React.memo(({
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
    if (post.isAd) return;

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
  }, [post.id, post.isAd, onVisible]);

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

const FriendFeed = () => {

  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const { initialViewedIds, markAsViewed, hasLoadedViewedHistory } = useViewedPosts();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[] | null>(null); // null = 아직 로드 안 됨

  const { scrollRef, progress } = useCollapsingHeader(80);

  const isLoading = authLoading || isInitialLoading;

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const [dividerViewedIds, setDividerViewedIds] = useState<Set<string>>(new Set());
  const hasCapturedDividerSnapshotRef = useRef(false);

  useEffect(() => {
    if (hasCapturedDividerSnapshotRef.current || !hasLoadedViewedHistory) return;

    hasCapturedDividerSnapshotRef.current = true;
    if (initialViewedIds.size > 0) {
      setDividerViewedIds(new Set(initialViewedIds));
    }
  }, [hasLoadedViewedHistory, initialViewedIds]);

  const displayPosts = useMemo(() => {
    if (dividerViewedIds.size === 0) return filteredPosts;

    const unseenPosts = filteredPosts.filter(post => !dividerViewedIds.has(post.id));
    const seenPosts = filteredPosts.filter(post => dividerViewedIds.has(post.id));
    return [...unseenPosts, ...seenPosts];
  }, [filteredPosts, dividerViewedIds]);

  // 팔로잉 목록 + 포스트를 순서대로 로드 (타이밍 이슈 없이 단일 흐름으로)
  useEffect(() => {
    if (authLoading || !authUser?.id) return;

    let cancelled = false;

    const load = async () => {
      setIsInitialLoading(true);
      setPosts([]);
      setPage(0);
      setHasMore(true);

      // 1단계: 팔로잉 목록 로드
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', authUser.id);

      if (cancelled) return;

      const ids = (followsData || []).map((f: any) => f.following_id);
      setFollowingIds(ids);

      // 2단계: 팔로잉이 없으면 바로 종료
      if (ids.length === 0) {
        setIsInitialLoading(false);
        return;
      }

      // 3단계: 팔로잉 유저들의 포스트 + profiles JOIN으로 실제 닉네임/아바타 가져오기
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles!posts_user_id_fkey(nickname, avatar_url, followers)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (cancelled) return;

      if (!error) {
        if (!data || data.length < PAGE_SIZE) setHasMore(false);
        const likedIds = await fetchLikedPostIds((data || []).map((p: any) => p.id), authUser.id);
        setPosts((data || []).map((p: any) => ({ ...mapPostImmediate(p), isLiked: likedIds.has(String(p.id)) })));
      }

      setIsInitialLoading(false);
    };

    load();

    return () => { cancelled = true; };
  }, [authUser?.id, authLoading]);

  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore || !followingIds || followingIds.length === 0) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('posts')
      .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles!posts_user_id_fkey(nickname, avatar_url, followers)')
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data && data.length > 0) {
      const likedIds = await fetchLikedPostIds(data.map((p: any) => p.id), authUser?.id);
      setPosts(prev => [...prev, ...data.map((p: any) => ({ ...mapPostImmediate(p), isLiked: likedIds.has(String(p.id)) }))]);
      setPage(nextPage);
    }
    if (!data || data.length < PAGE_SIZE) setHasMore(false);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, page, followingIds, authUser?.id]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && posts.length > 0 && hasMore) loadMorePosts(); },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length, hasMore]);

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
    if (post?.id) markAsViewed(post.id);
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts, markAsViewed]);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const noFollowing = followingIds !== null && followingIds.length === 0;
  const noPostsButHasFriends = !isLoading && followingIds !== null && followingIds.length > 0 && filteredPosts.length === 0;

  return (
    <div ref={scrollRef} className="h-screen w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}>
      {/* 고정 상단 헤더 */}
      <div className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-white pt-[64px]">
        <CollapsingHeader
          progress={progress}
          Icon={Users}
          iconBgClass="bg-indigo-100"
          iconColorClass="text-indigo-600"
          title="친구 포스팅"
          subtitle="Friends Feed"
          ActionIcon={Search}
          actionLabel="친구 검색"
          onActionClick={() => navigate('/search')}
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

              displayPosts.forEach((post) => {
                items.push(
                  <ViewedAwareFriendPostItem
                    key={post.id}
                    post={post}
                    isViewed={dividerViewedIds.has(post.id)}
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

            {noFollowing && (
              <div className="py-24 flex flex-col items-center justify-center text-center px-10">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-5">
                  <Users className="w-10 h-10 text-indigo-300" />
                </div>
                <p className="text-base font-black text-gray-700 mb-2">아직 팔로우한 친구가 없어요</p>
                <p className="text-sm text-gray-400 font-medium leading-relaxed mb-6">
                  친구를 팔로우하면 이곳에서<br />친구들의 포스팅을 볼 수 있어요!
                </p>
                <button
                  onClick={() => navigate('/search')}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-md"
                >
                  <Search className="w-4 h-4" />
                  친구 찾기
                </button>
              </div>
            )}

            {noPostsButHasFriends && (
              <div className="py-24 flex flex-col items-center justify-center text-center px-10">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5">
                  <Users className="w-10 h-10 text-gray-200" />
                </div>
                <p className="text-sm text-gray-400 font-bold leading-relaxed">
                  친구들의 포스팅이 아직 없습니다.
                </p>
              </div>
            )}

            {hasMore && posts.length > 0 && (
              <div ref={loadMoreRef} className="py-10 flex justify-center">
                {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendFeed;