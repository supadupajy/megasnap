"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Flame, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getDiverseUnsplashUrl, getVerifiedYoutubeUrlByIndex, initializeYoutubePool, remapUnsplashDisplayUrl } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMediaBatch } from '@/utils/youtube-utils';
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

// 포스트 데이터를 즉시 매핑 (YouTube 검증 없이)
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
    user: { id: p.user_id, name: p.user_name, avatar: p.user_avatar },
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
  };
};

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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const hasLoaded = useRef(false);

  const isLoading = authLoading || (isInitialLoading && posts.length === 0);

  useEffect(() => {
    const handleOpenWrite = () => {};
    window.addEventListener('open-write-post', handleOpenWrite);
    return () => window.removeEventListener('open-write-post', handleOpenWrite);
  }, []);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const fetchPopularPosts = useCallback(async (pageNum: number) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar')
        .order('likes', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length < PAGE_SIZE) setHasMore(false);

      // ✅ 즉시 렌더링: YouTube 검증 없이 바로 표시
      const immediatePost = (data || []).map(mapPostImmediate);

      // ✅ YouTube 검증은 백그라운드에서 배치 처리
      const postsWithYoutube = (data || []).filter(p => p.youtube_url);
      if (postsWithYoutube.length > 0) {
        sanitizeYoutubeMediaBatch(postsWithYoutube).then(sanitized => {
          const sanitizedMap: Record<string, any> = Object.fromEntries(sanitized.map(p => [p.id, p]));
          setPosts(prev => prev.map(post => {
            const s = sanitizedMap[post.id];
            if (!s) return post;
            return mapPostImmediate(s);
          }));
        });
      }

      return immediatePost;
    } catch (err) {
      return [];
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (hasLoaded.current) return;
    setIsInitialLoading(true);
    // YouTube pool 초기화와 포스트 로딩을 병렬로
    const [initialPosts] = await Promise.all([
      fetchPopularPosts(0),
      initializeYoutubePool(),
    ]);
    setPosts(initialPosts);
    hasLoaded.current = true;
    setIsInitialLoading(false);
  }, [fetchPopularPosts]);

  useEffect(() => {
    if (!authLoading) {
      if (authUser) loadInitialData();
      else navigate('/login', { replace: true });
    }
  }, [authLoading, authUser, loadInitialData, navigate]);

  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const newPosts = await fetchPopularPosts(nextPage);
    if (newPosts.length > 0) {
      setPosts(prev => [...prev, ...newPosts]);
      setPage(nextPage);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, page, fetchPopularPosts]);

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

  return (
    <div className="h-screen overflow-y-auto bg-white pb-32 no-scrollbar">
      {/* 고정 상단 헤더 */}
      <div className="sticky top-0 z-40 bg-white pt-[64px]">
        <div className="px-4 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center shadow-sm">
                <Flame className="w-6 h-6 text-orange-600 fill-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">인기 포스팅</h2>
                <p className="text-[10px] text-gray-400 font-medium leading-none uppercase tracking-widest">Trending Now</p>
              </div>
            </div>
            <div className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      <div>
        {isLoading ? (
          // ✅ Skeleton UI로 즉각적인 피드백
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
            {!isLoading && filteredPosts.length === 0 && (
              <div className="text-center py-20 text-gray-400 font-medium px-10">
                표시할 인기 포스팅이 없습니다.
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

export default Popular;
