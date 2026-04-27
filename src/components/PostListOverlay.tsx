"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, MapPin, MessageSquare, Clock, Filter, Loader2, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import PostItem from './PostItem';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds, getTierFromId } from '@/hooks/use-supabase-posts';
import { getDiverseUnsplashUrl } from '@/lib/mock-data';

const ObservedPostItem = ({ 
  post, 
  onVisible, 
  isViewed, 
  onLikeToggle, 
  onLocationClick,
  onDelete,
  isPlaying,
  onPlayingChange
}: { 
  post: Post, 
  onVisible: (id: string) => void, 
  isViewed: boolean, 
  onLikeToggle: (id: string) => void, 
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number, fullPost: Post) => void,
  onDelete: (id: string) => void,
  isPlaying: boolean,
  onPlayingChange: (id: string, isIntersecting: boolean) => void
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isCurrentlyVisible, setIsCurrentlyVisible] = useState(false);
  const [isNearVisible, setIsNearVisible] = useState(false); // ✅ 화면 근처 도달 상태 추가
  const [fullPost, setFullPost] = useState<Post>(post);

  // ✅ [FIX] 화면에 보이기 전(근처 도달 시)에 상세 데이터를 미리 불러옴
  useEffect(() => {
    const fetchFullData = async () => {
      // ✅ [FIX] user.name이 '...'이거나, avatar가 없거나, location이 없으면 데이터를 새로 불러옴
      const needsFetch =
        fullPost.user.name === '...' ||
        !fullPost.user.avatar ||
        !fullPost.location ||
        fullPost.location === '알 수 없는 장소';

      if (!needsFetch) return;

      try {
        // [Optimized] select('*') → 필요한 컬럼만 + profiles JOIN을 동일 쿼리에서 처리 (round-trip 1회)
        const { data: p, error } = await supabase
          .from('posts')
          .select('id, content, location_name, user_id, user_name, user_avatar, profiles:user_id(nickname, avatar_url)')
          .eq('id', post.id)
          .single();

        if (p && !error) {
          const profile = (p as any).profiles;
          const userName = profile?.nickname || p.user_name || '탐험가';
          const userAvatar = profile?.avatar_url || p.user_avatar || `https://i.pravatar.cc/150?u=${p.user_id}`;

          setFullPost(prev => ({
            ...prev,
            user: { ...prev.user, name: userName, avatar: userAvatar },
            content: p.content?.replace(/^\[AD\]\s*/, '') || '',
            location: p.location_name || '알 수 없는 장소'
          }));
        }
      } catch (err) {
        console.error('[PostList] Full data fetch error:', err);
      }
    };

    if (isNearVisible || isCurrentlyVisible) {
      fetchFullData();
    }
  }, [post.id, fullPost.user.name, fullPost.user.avatar, isNearVisible, isCurrentlyVisible]);

  useEffect(() => {
    // 1. 읽음 처리용 옵저버 (기존 로직 유지)
    const viewObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(post.id);
          viewObserver.unobserve(entry.target);
        }
      },
      { threshold: [0.6], rootMargin: '-10% 0px -10% 0px' }
    );

    // 2. 동영상 재생용 실시간 가시성 옵저버 (인스타그램 방식)
    const playbackObserver = new IntersectionObserver(
      ([entry]) => {
        setIsCurrentlyVisible(entry.isIntersecting);
        onPlayingChange(post.id, entry.isIntersecting);
      },
      { 
        threshold: 0.2, // 20%만 보여도 로딩 시작 판단에 활용
        rootMargin: '0px'
      }
    );

    // 3. 프리로딩(Pre-loading)용 옵저버: 화면 아래 1000px 이내에 들어오면 로딩 시작
    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearVisible(true);
          preloadObserver.unobserve(entry.target);
        }
      },
      { 
        rootMargin: '0px 0px 1000px 0px' // 아래쪽으로 1000px 미리 감지
      }
    );

    if (itemRef.current) {
      viewObserver.observe(itemRef.current);
      playbackObserver.observe(itemRef.current);
      preloadObserver.observe(itemRef.current);
    }

    return () => {
      viewObserver.disconnect();
      playbackObserver.disconnect();
      preloadObserver.disconnect();
    };
  }, [post.id, onVisible, onPlayingChange]);

  return (
    <div ref={itemRef} id={`post-${post.id}`} className="scroll-mt-0">
      <PostItem 
        post={fullPost}
        isViewed={isViewed} 
        onLikeToggle={onLikeToggle}
        onLocationClick={(e, lat, lng) => onLocationClick(e, lat, lng, fullPost)}
        onDelete={onDelete}
        autoPlayVideo={isCurrentlyVisible}
      />
    </div>
  );
};

interface PostListOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosts: Post[];
  mapCenter: { lat: number; lng: number };
  currentBounds?: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  selectedCategories: string[];
  authUserId?: string | null;
  onDeletePost?: (id: string) => void;
}

const PostListOverlay = ({ 
  isOpen, 
  onClose, 
  initialPosts, 
  mapCenter, 
  currentBounds, 
  selectedCategories,
  authUserId,
  onDeletePost
}: PostListOverlayProps) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ✅ 읽은 포스트들의 ID를 Set으로 관리하여 지도 마커 색상을 제어합니다.
  useEffect(() => {
    if (viewedIds.size > 0) {
      window.dispatchEvent(new CustomEvent('update-viewed-markers', { 
        detail: { viewedIds: Array.from(viewedIds) } 
      }));
    }
  }, [viewedIds]);
  
  // ✅ [FIX] 지도가 이동할 때마다 initialPosts가 바뀌므로, 이때 hasMore를 다시 true로 리셋해줘야 합니다.
  useEffect(() => {
    setPosts(initialPosts || []);
    setHasMore(true); 
    setIsLoadingMore(false);
  }, [initialPosts]);

  // Infinite Scroll Handler
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const lastPost = posts[posts.length - 1];
      const lastPostDate = lastPost 
        ? new Date(lastPost.createdAt).toISOString()
        : new Date().toISOString();

      // 현재 영역(Bounds) 기준으로 확장 검색 시도
      const latMin = Math.min(currentBounds.sw.lat, currentBounds.ne.lat);
      const latMax = Math.max(currentBounds.sw.lat, currentBounds.ne.lat);
      const lngMin = Math.min(currentBounds.sw.lng, currentBounds.ne.lng);
      const lngMax = Math.max(currentBounds.sw.lng, currentBounds.ne.lng);

      // 현재 영역의 크기(너비/높이) 계산
      const latDiff = latMax - latMin;
      const lngDiff = lngMax - lngMin;

      // ✅ [동일 지역 확장 로직] 현재 보고 있는 영역을 기준으로 약 2~3배 넓은 '동일 생활권' 범위까지만 탐색
      const expandedLatMin = latMin - latDiff;
      const expandedLatMax = latMax + latDiff;
      const expandedLngMin = lngMin - lngDiff;
      const expandedLngMax = lngMax + lngDiff;

      let { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar')
        .gte('latitude', expandedLatMin)
        .lte('latitude', expandedLatMax)
        .gte('longitude', expandedLngMin)
        .lte('longitude', expandedLngMax)
        .lt('created_at', lastPostDate)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      const userIds = Array.from(new Set(
        data.map((p: any) => p.user_id).filter((id: any) => !!id)
      ));

      let profileMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', userIds);
        (profilesData || []).forEach((pf: any) => {
          profileMap.set(pf.id, { nickname: pf.nickname, avatar_url: pf.avatar_url });
        });
      }

      const newPosts: Post[] = data.map((p: any) => {
        const profile = p.user_id ? profileMap.get(p.user_id) : null;
        const userName = profile?.nickname || p.user_name || '탐험가';
        const userAvatar = profile?.avatar_url || p.user_avatar || '';

        const isAdPost = !!p.content?.trim().startsWith('[AD]');
        let borderType: string = 'none';
        if (!isAdPost) {
          if (Number(p.likes || 0) >= 9000) {
            borderType = 'popular';
          } else {
            borderType = getTierFromId(p.id);
          }
        }

        let finalImage = p.image_url;
        if (finalImage?.includes('unsplash.com')) {
          finalImage = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";
        }
        const isYoutubeThumb = typeof finalImage === 'string' && finalImage.includes('img.youtube.com');
        if (isAdPost && (!finalImage || isYoutubeThumb)) {
          finalImage = getDiverseUnsplashUrl(`ad:${p.id}`, 'food');
        }
        const finalImages = isAdPost ? [finalImage] : (p.images || [finalImage]);

        return {
          id: p.id,
          user: { id: p.user_id, name: userName, avatar: userAvatar || `https://i.pravatar.cc/150?u=${p.user_id}` },
          content: p.content?.replace(/^\[AD\]\s*/, '') || '',
          location: p.location_name || '알 수 없는 장소',
          lat: p.latitude, lng: p.longitude,
          latitude: p.latitude, longitude: p.longitude,
          likes: Number(p.likes || 0),
          image: finalImage,
          image_url: finalImage,
          images: finalImages,
          videoUrl: isAdPost ? undefined : p.video_url,
          youtubeUrl: isAdPost ? undefined : p.youtube_url,
          createdAt: new Date(p.created_at),
          category: isAdPost ? 'food' : (p.category || 'none'),
          commentsCount: 0, comments: [],
          isLiked: false, isAd: isAdPost, isGif: false,
          isInfluencer: borderType === 'gold' || borderType === 'diamond',
          borderType,
        };
      });

      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = newPosts.filter(p => !existingIds.has(p.id));
        if (filteredNew.length === 0) setHasMore(false);
        return [...prev, ...filteredNew];
      });
    } catch (err) {
      console.error('[PostListOverlay] Regional fetch failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [posts, isLoadingMore, hasMore, currentBounds]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && posts.length > 0 && hasMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length, hasMore]);

  // window 객체에 상태 기록 + BottomNav 동기화 이벤트 발생
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isPostListOpen = isOpen;
      window.dispatchEvent(
        new CustomEvent(isOpen ? 'open-post-list-overlay' : 'close-post-list-overlay')
      );
    }
  }, [isOpen]);

  const handlePlayingChange = (id: string, isIntersecting: boolean) => {
    if (isIntersecting) {
      setPlayingPostId(id);
    } else {
      setPlayingPostId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ y: "100vh" }}
      animate={{ y: 0 }}
      exit={{ y: "100vh" }}
      transition={{ 
        type: 'tween', 
        duration: 0.35, 
        ease: [0.32, 0.72, 0, 1] 
      }}
      style={{ willChange: 'transform' }}
      className="fixed inset-0 top-[calc(env(safe-area-inset-top,0px)+64px)] z-[90] bg-white flex flex-col shadow-none overflow-hidden"
    >
      {/* Header */}
<div className="relative flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white sticky top-0 z-10">
  <button 
    onClick={onClose}
    className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
  >
    <ChevronDown className="w-6 h-6" />
  </button>
  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
    <h2 className="text-lg font-black text-gray-900 tracking-tight">주변 포스트</h2>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total {posts.length} Posts</p>
  </div>
  <div />
</div>
  

      {/* List Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-white pb-40 custom-scrollbar touch-pan-y"
      >
        {posts.length > 0 ? (
          <div className="flex flex-col">
            {posts.map((post) => (
              <ObservedPostItem 
                key={post.id}
                post={post}
                isViewed={viewedIds.has(post.id)}
                onVisible={(id) => markAsViewed(id)}
                onLikeToggle={() => {}}
                onLocationClick={(e, lat, lng, fullPost) => {
                  window.dispatchEvent(new CustomEvent('focus-post', { detail: { post: fullPost, lat, lng } }));
                }}
                onDelete={(id) => onDeletePost?.(id)}
                isPlaying={playingPostId === post.id}
                onPlayingChange={handlePlayingChange}
              />
            ))}
            
            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={loadMoreRef} className="py-10 flex justify-center">
                {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                이 지역의 모든 포스팅을 불러왔습니다.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <LayoutGrid className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-900 font-bold mb-1">표시할 포스팅이 없습니다</p>
            <p className="text-gray-400 text-xs">필터를 변경하거나 지도를 이동해보세요</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PostListOverlay;