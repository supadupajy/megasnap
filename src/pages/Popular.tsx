"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronUp } from 'lucide-react';
import { getDiverseUnsplashUrl, initializeYoutubePool, remapUnsplashDisplayUrl } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import PostItem from '@/components/PostItem';
import { motion } from 'framer-motion';

const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  if (val < 0.01) return 'diamond';
  if (val < 0.03) return 'gold';
  if (val < 0.07) return 'silver';
  if (val < 0.15) return 'popular';
  return 'none';
};

const PAGE_SIZE = 15;

const Popular = () => {
  const navigate = useNavigate();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const hasLoaded = useRef(false);
  
  const [pullUpDistance, setPullUpDistance] = useState(0);
  const isPullingRef = useRef(false);
  const startYRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isLoading = authLoading || (isInitialLoading && posts.length === 0);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const fetchPopularPosts = useCallback(async (pageNum: number) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      await initializeYoutubePool();
      const { data, error } = await supabase.from('posts').select('*').order('likes', { ascending: false }).range(from, to);
      if (error) throw error;
      if (!data || data.length < PAGE_SIZE) setHasMore(false);
      const sanitizedData = await Promise.all((data || []).map((post) => sanitizeYoutubeMedia(post)));
      const mappedPosts = sanitizedData.map(p => {
        const borderType = getTierFromId(p.id);
        const isAd = p.content?.trim().startsWith('[AD]');
        let finalImage = p.youtube_url ? (getYoutubeThumbnail(p.youtube_url) || p.image_url) : remapUnsplashDisplayUrl(p.image_url, p.id, isAd ? 'food' : 'general') || p.image_url;
        if (!isAd && !p.youtube_url && !p.video_url && finalImage.includes('img.youtube.com')) finalImage = getDiverseUnsplashUrl(p.id, 'general');
        return {
          id: p.id, isAd, isGif: false, isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
          user: { id: p.user_id, name: p.user_name, avatar: p.user_avatar },
          content: p.content?.replace(/^\[AD\]\s*/, '') || '', location: p.location_name, lat: p.latitude, lng: p.longitude,
          likes: Number(p.likes || 0), commentsCount: 0, comments: [], image: finalImage, youtubeUrl: p.youtube_url, videoUrl: p.video_url,
          isLiked: false, isSaved: false, createdAt: new Date(p.created_at), borderType,
          category: p.category || 'none',
        };
      }) as Post[];
      return mappedPosts;
    } catch (err) { return []; }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (hasLoaded.current) return;
    setIsInitialLoading(true);
    const initialPosts = await fetchPopularPosts(0);
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

  const loadNearbyPosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    
    try {
      const lastPost = posts[posts.length - 1];
      const lastPostDate = lastPost ? new Date(lastPost.createdAt).toISOString() : new Date().toISOString();
      const storedBounds = localStorage.getItem('map_bounds');
      let bounds = storedBounds ? JSON.parse(storedBounds) : null;
      
      let query = supabase.from('posts').select('*').lt('created_at', lastPostDate).order('created_at', { ascending: false }).limit(10);
      
      if (bounds) {
        const latMin = Math.min(bounds.sw.lat, bounds.ne.lat);
        const latMax = Math.max(bounds.sw.lat, bounds.ne.lat);
        const lngMin = Math.min(bounds.sw.lng, bounds.ne.lng);
        const lngMax = Math.max(bounds.sw.lng, bounds.ne.lng);
        query = query.gte('latitude', latMin).lte('latitude', latMax).gte('longitude', lngMin).lte('longitude', lngMax);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const sanitizedData = await Promise.all(data.map((post) => sanitizeYoutubeMedia(post)));
        const mappedPosts = sanitizedData.map(p => {
          const borderType = getTierFromId(p.id);
          const isAd = p.content?.trim().startsWith('[AD]');
          let finalImage = p.youtube_url ? (getYoutubeThumbnail(p.youtube_url) || p.image_url) : remapUnsplashDisplayUrl(p.image_url, p.id, isAd ? 'food' : 'general') || p.image_url;
          return {
            id: p.id, isAd, isGif: false, isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
            user: { id: p.user_id, name: p.user_name, avatar: p.user_avatar },
            content: p.content?.replace(/^\[AD\]\s*/, '') || '', location: p.location_name, lat: p.latitude, lng: p.longitude,
            likes: Number(p.likes || 0), commentsCount: 0, comments: [], image: finalImage, youtubeUrl: p.youtube_url, videoUrl: p.video_url,
            isLiked: false, isSaved: false, createdAt: new Date(p.created_at), borderType,
            category: p.category || 'none',
          };
        }) as Post[];

        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = mappedPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[Popular] Load nearby failed:', err);
    } finally {
      setIsLoadingMore(false);
      setPullUpDistance(0);
    }
  }, [isLoadingMore, hasMore, posts]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollContainerRef.current || isLoadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      isPullingRef.current = true;
      startYRef.current = e.touches[0].pageY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current) return;
    const pageY = e.touches[0].pageY;
    const diff = startYRef.current - pageY;
    if (diff > 0) {
      setPullUpDistance(Math.min(diff * 0.5, 120));
    }
  };

  const handleTouchEnd = () => {
    if (isPullingRef.current) {
      if (pullUpDistance > 80) {
        loadNearbyPosts();
      } else {
        setPullUpDistance(0);
      }
    }
    isPullingRef.current = false;
  };

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

  const handlePostDelete = useCallback((postId: string) => { setPosts(prev => prev.filter(p => p.id !== postId)); }, []);

  return (
    <div 
      ref={scrollContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="h-screen overflow-y-auto bg-white pb-32 no-scrollbar"
    >
      <div className="fixed top-[88px] inset-x-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">인기 포스팅</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trending Now</p>
        </div>
      </div>

      <div className="pt-[160px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-gray-400 font-bold text-sm">인기 포스팅을 불러오는 중...</p>
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
                />
              </div>
            ))}
            {!isLoading && filteredPosts.length === 0 && (
              <div className="text-center py-20 text-gray-400 font-medium px-10">
                표시할 인기 포스팅이 없습니다.
              </div>
            )}
            
            {hasMore && posts.length > 0 && (
              <div 
                className="py-10 flex flex-col items-center justify-center transition-all duration-200"
                style={{ height: `${Math.max(80, pullUpDistance + 40)}px` }}
              >
                {isLoadingMore ? (
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                ) : (
                  <>
                    <motion.div
                      animate={{ y: pullUpDistance > 80 ? -10 : 0 }}
                      className={pullUpDistance > 80 ? "text-indigo-600" : "text-gray-400"}
                    >
                      <ChevronUp className="w-8 h-8 stroke-[3px]" />
                    </motion.div>
                    <p className={cn(
                      "text-xs font-black uppercase tracking-tighter mt-2 transition-colors",
                      pullUpDistance > 80 ? "text-indigo-600" : "text-gray-400"
                    )}>
                      {pullUpDistance > 80 ? "놓아서 주변 포스팅 로드" : "페이지를 위로 당겨 포스팅 추가"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Popular;