"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getDiverseUnsplashUrl, remapUnsplashDisplayUrl } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { toggleLikeInDb } from '@/utils/like-utils';
import PostItem from '@/components/PostItem';

const getTierFromId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  if (val < 0.03) return 'diamond';
  if (val < 0.08) return 'gold';
  if (val < 0.15) return 'silver';
  if (val < 0.25) return 'popular';
  return 'none';
};

const PAGE_SIZE = 15;

const mapPostImmediate = (p: any): Post => {
  const borderType = getTierFromId(p.id);
  const isAd = p.content?.trim().startsWith('[AD]');
  let finalImage = p.youtube_url
    ? (getYoutubeThumbnail(p.youtube_url) || p.image_url)
    : remapUnsplashDisplayUrl(p.image_url, p.id, isAd ? 'food' : 'general') || p.image_url;
  if (!isAd && !p.youtube_url && !p.video_url && finalImage?.includes('img.youtube.com')) {
    finalImage = getDiverseUnsplashUrl(p.id, 'general');
  }
  return {
    id: p.id, isAd, isGif: false, isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
    user: { id: p.user_id, name: p.user_name || p.profiles?.nickname || '사용자', avatar: p.user_avatar || p.profiles?.avatar_url || '' },
    content: p.content?.replace(/^\[AD\]\s*/, '') || '',
    location: p.location_name, lat: p.latitude, lng: p.longitude,
    likes: Number(p.likes || 0), commentsCount: 0, comments: [],
    image: finalImage, image_url: finalImage,
    images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage],
    latitude: p.latitude, longitude: p.longitude,
    youtubeUrl: p.youtube_url, videoUrl: p.video_url,
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

const FriendFeed = () => {
  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[] | null>(null); // null = 아직 로드 안 됨

  const isLoading = authLoading || isInitialLoading;

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

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

      // 3단계: 팔로잉 유저들의 포스트 로드
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (cancelled) return;

      if (!error) {
        if (!data || data.length < PAGE_SIZE) setHasMore(false);
        setPosts((data || []).map(mapPostImmediate));
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
      .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar')
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data && data.length > 0) {
      setPosts(prev => [...prev, ...data.map(mapPostImmediate)]);
      setPage(nextPage);
    }
    if (!data || data.length < PAGE_SIZE) setHasMore(false);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, page, followingIds]);

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
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const noFollowing = followingIds !== null && followingIds.length === 0;
  const noPostsButHasFriends = !isLoading && followingIds !== null && followingIds.length > 0 && filteredPosts.length === 0;

  return (
    <div className="h-screen overflow-y-auto bg-white pb-32 no-scrollbar">
      {/* 고정 상단 헤더 */}
      <div className="sticky top-0 z-40 bg-white pt-[64px]">
        <div className="px-4 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">친구 포스팅</h2>
                <p className="text-[10px] text-gray-400 font-medium leading-none uppercase tracking-widest">Friends Feed</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/search')}
              className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-transform"
            >
              <Search className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredPosts.map((post) => (
              <div key={post.id} className="border-b border-gray-100 last:border-0 bg-white">
                <PostItem
                  post={post}
                  onLikeToggle={() => handleLikeToggle(post.id)}
                  onLocationClick={handleLocationClick}
                  onDelete={handlePostDelete}
                  autoPlayVideo={true}
                  disablePulse={true}
                />
              </div>
            ))}

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