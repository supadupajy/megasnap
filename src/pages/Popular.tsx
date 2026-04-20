"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import WritePost from '@/components/WritePost';
import StoryBar from '@/components/StoryBar';
import { createMockPosts, getDiverseUnsplashUrl, getVerifiedYoutubeUrlByIndex, initializeYoutubePool, remapUnsplashDisplayUrl } from '@/lib/mock-data';
import { Post } from '@/types';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { getYoutubeThumbnail } from '@/lib/utils';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';

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
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const hasLoaded = useRef(false);

  useEffect(() => {
    const handleOpenWrite = () => setIsWriteOpen(true);
    window.addEventListener('open-write-post', handleOpenWrite);
    return () => window.removeEventListener('open-write-post', handleOpenWrite);
  }, []);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => !blockedIds.has(p.user.id));
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
          isLiked: false, createdAt: new Date(p.created_at), borderType
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

  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const newPosts = await fetchPopularPosts(nextPage);
    if (newPosts.length > 0) { setPosts(prev => [...prev, ...newPosts]); setPage(nextPage); }
    else setHasMore(false);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, page, fetchPopularPosts]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && posts.length > 0 && hasMore) loadMorePosts(); }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length, hasMore]);

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

  if (authLoading || (isInitialLoading && posts.length === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /><p className="text-xs font-bold text-gray-400">인기 포스팅을 불러오는 중...</p></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <div className="pt-[88px]">
        <StoryBar />
        <div className="flex flex-col">
          {filteredPosts.map((post) => (
            <PostItem key={post.id} id={post.id} user={post.user} content={post.content} location={post.location} likes={post.likes} commentsCount={post.commentsCount} comments={post.comments} image={post.image} images={post.images} lat={post.lat} lng={post.lng} isLiked={post.isLiked} isAd={post.isAd} isGif={post.isGif} isInfluencer={post.isInfluencer} borderType={post.borderType} youtubeUrl={post.youtubeUrl} videoUrl={post.videoUrl} disablePulse={true} onLikeToggle={() => handleLikeToggle(post.id)} onLocationClick={handleLocationClick} onDelete={handlePostDelete} />
          ))}
        </div>
        <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
          {isLoadingMore ? (<><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">다음 인기 포스팅을 불러오는 중...</p></>) : (hasMore ? <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" /> : <p className="text-[10px] font-black text-gray-300 uppercase">모든 인기 포스팅을 확인했습니다</p>)}
        </div>
      </div>
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} onStartLocationSelection={() => { setIsWriteOpen(false); navigate('/', { state: { startSelection: true } }); }} />
    </div>
  );
};

export default Popular;