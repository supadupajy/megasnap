"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, MapPin, MessageSquare, Clock, Filter, Loader2, LayoutGrid } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import PostItem from './PostItem';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds } from '@/hooks/use-supabase-posts';

const ObservedPostItem = ({ 
  post, 
  onVisible, 
  isViewed, 
  onLikeToggle, 
  onLocationClick,
  onDelete 
}: { 
  post: Post, 
  onVisible: (id: string) => void, 
  isViewed: boolean, 
  onLikeToggle: (id: string) => void, 
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void,
  onDelete: (id: string) => void
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(post.id);
          observer.unobserve(entry.target);
        }
      },
      { 
        threshold: [0, 0.6, 1.0],
        rootMargin: '-10% 0px -10% 0px'
      }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, [post.id, onVisible]);

  return (
    <div ref={itemRef} id={`post-${post.id}`} className="scroll-mt-[150px]">
      <PostItem 
        post={post}
        isViewed={isViewed} 
        onLikeToggle={onLikeToggle}
        onLocationClick={onLocationClick}
        onDelete={onDelete}
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
  timeValueHours: number;
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
  timeValueHours,
  authUserId,
  onDeletePost
}: PostListOverlayProps) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expansionStep, setExpansionStep] = useState(0);
  const loadedPostIds = useRef<Set<string>>(new Set(initialPosts.map(p => p.id)));
  
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const now = Date.now();
  const timeLimitMs = timeValueHours * 60 * 60 * 1000;
  const baseLatSpan = useMemo(() => {
    if (!currentBounds) return 0.08;
    return Math.max(currentBounds.ne.lat - currentBounds.sw.lat, 0.08);
  }, [currentBounds]);
  const baseLngSpan = useMemo(() => {
    if (!currentBounds) return 0.08;
    return Math.max(currentBounds.ne.lng - currentBounds.sw.lng, 0.08);
  }, [currentBounds]);

  useLayoutEffect(() => {
    if (isOpen) {
      setPosts(initialPosts);
      loadedPostIds.current = new Set(initialPosts.map(p => p.id));
      setHasMore(true);
      setExpansionStep(0);
    }
  }, [isOpen, initialPosts]);

  const matchesOverlayFilters = useCallback((post: Post) => {
    if (blockedIds.has(post.user.id)) return false;
    if (!post.isAd && (now - post.createdAt.getTime()) > timeLimitMs) return false;

    let matchesCategory = false;
    if (selectedCategories.includes('mine')) {
      matchesCategory = !!authUserId && post.user.id === authUserId;
    } else if (selectedCategories.includes('all')) {
      matchesCategory = true;
    } else {
      matchesCategory = selectedCategories.includes(post.category || 'none')
        || (selectedCategories.includes('hot') && post.borderType === 'popular')
        || (selectedCategories.includes('influencer') && post.isInfluencer);
    }

    return matchesCategory;
  }, [authUserId, blockedIds, now, selectedCategories, timeValueHours]);

  const visiblePosts = useMemo(() => {
    if (!isOpen) return posts;
    if (posts.length === 0 && initialPosts.length > 0) return initialPosts;
    return posts;
  }, [isOpen, posts, initialPosts]);

  const filteredPosts = useMemo(() => {
    return visiblePosts.filter(matchesOverlayFilters);
  }, [visiblePosts, matchesOverlayFilters]);

  const getExpandedBounds = useCallback((step: number) => {
    const multiplier = 1 + (step * 0.75);
    const latHalf = (baseLatSpan * multiplier) / 2;
    const lngHalf = (baseLngSpan * multiplier) / 2;

    return {
      sw: { lat: mapCenter.lat - latHalf, lng: mapCenter.lng - lngHalf },
      ne: { lat: mapCenter.lat + latHalf, lng: mapCenter.lng + lngHalf },
    };
  }, [baseLatSpan, baseLngSpan, mapCenter.lat, mapCenter.lng]);

  const isWithinBounds = useCallback((post: Post, bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }) => {
    return post.lat >= bounds.sw.lat
      && post.lat <= bounds.ne.lat
      && post.lng >= bounds.sw.lng
      && post.lng <= bounds.ne.lng;
  }, []);

  const getDistanceFromCenter = useCallback((post: Post) => {
    return Math.hypot(post.lat - mapCenter.lat, post.lng - mapCenter.lng);
  }, [mapCenter.lat, mapCenter.lng]);

  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore || !isOpen) return;

    setIsLoadingMore(true);
    
    try {
      let currentStep = expansionStep;
      let foundPostsCount = 0;
      let newPostsBatch: Post[] = [];

      for (let i = 0; i < 10; i++) {
        const nextStep = currentStep + 1;
        if (nextStep > 50) {
          setHasMore(false);
          break;
        }

        const multiplier = 1 + (0.2 * nextStep);
        const expandLat = baseLatSpan * multiplier;
        const expandLng = baseLngSpan * multiplier;

        const expandedBounds = {
          sw: { lat: mapCenter.lat - expandLat, lng: mapCenter.lng - expandLng },
          ne: { lat: mapCenter.lat + expandLat, lng: mapCenter.lng + expandLng }
        };

        // ✅ [수정] 여기보기 리스트를 위해 모든 정보를 포함한 데이터를 가져옵니다.
        // 마커는 가벼운 데이터를 쓰지만, 리스트는 전체 정보가 필요합니다.
        const { data: newRawPosts, error } = await supabase
          .from('posts')
          .select('*')
          .gte('latitude', Math.min(expandedBounds.sw.lat, expandedBounds.ne.lat))
          .lte('latitude', Math.max(expandedBounds.sw.lat, expandedBounds.ne.lat))
          .gte('longitude', Math.min(expandedBounds.sw.lng, expandedBounds.ne.lng))
          .lte('longitude', Math.max(expandedBounds.sw.lng, expandedBounds.ne.lng))
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const uniqueNewRawPosts = (newRawPosts || []).filter(p => !loadedPostIds.current.has(p.id));
        
        if (uniqueNewRawPosts.length > 0) {
          const mappedPosts = await Promise.all(uniqueNewRawPosts.map(async (p) => {
            const isAd = p.content?.trim().startsWith('[AD]');
            return {
  id: p.id,
  isAd,
  isGif: false,
  isInfluencer: false,
  user: { id: p.user_id, name: p.user_name || '탐험가', avatar: p.user_avatar },
  content: p.content?.replace(/^\[AD\]\s*/, '') || '',
  location: p.location_name || '알 수 없는 장소',
  lat: p.latitude,
  lng: p.longitude,
  likes: Number(p.likes || 0),
  commentsCount: 0,
  comments: [],
  image: p.image_url,
  images: Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []), // ✅ 추가
  videoUrl: p.video_url,
  youtubeUrl: p.youtube_url,
  category: p.category || 'none',
  isLiked: false,
  createdAt: new Date(p.created_at),
  borderType: 'none',
} as Post;
          }));

          mappedPosts.forEach(p => loadedPostIds.current.add(p.id));
          
          const sortedNew = mappedPosts.sort((a, b) => {
            const distA = Math.sqrt(Math.pow((a.lat || 0) - mapCenter.lat, 2) + Math.pow((a.lng || 0) - mapCenter.lng, 2));
            const distB = Math.sqrt(Math.pow((b.lat || 0) - mapCenter.lat, 2) + Math.pow((b.lng || 0) - mapCenter.lng, 2));
            return distA - distB;
          });

          newPostsBatch = [...newPostsBatch, ...sortedNew];
          foundPostsCount += sortedNew.length;
          currentStep = nextStep;

          if (foundPostsCount >= 10) break;
        } else {
          currentStep = nextStep;
        }
      }

      if (newPostsBatch.length > 0) {
        setPosts(prev => [...prev, ...newPostsBatch]);
        setExpansionStep(currentStep);
      } else if (currentStep >= 50) {
        setHasMore(false);
      } else {
        setExpansionStep(currentStep);
      }
    } catch (err) {
      console.error('[PostList] Load more error:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, isOpen, expansionStep, mapCenter, baseLatSpan, baseLngSpan]);

  useEffect(() => {
    if (!isOpen || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isOpen, hasMore, loadMorePosts]);

  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    const post = visiblePosts.find(p => p.lat === lat && p.lng === lng);
    onClose();
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, visiblePosts, onClose]);

  const handleLocalDelete = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    if (onDeletePost) onDeletePost(id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 top-[env(safe-area-inset-top,0px)] mt-16 z-[100] bg-white flex flex-col rounded-t-[32px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div>
              <h2 className="text-lg font-black text-gray-900">주변 포스트</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total {filteredPosts.length} Posts</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all close-popup-btn"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600 -rotate-90" />
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 pb-20 custom-scrollbar">
            {filteredPosts.length > 0 ? (
              <div className="flex flex-col">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="border-b border-gray-100 last:border-0 bg-white">
                    <PostItem 
                      post={post}
                      onLikeToggle={() => {}}
                      onLocationClick={(e, lat, lng) => {
                        onClose();
                        // Index.tsx의 focusPostOnMap이 동작하도록 이벤트 발생
                        window.dispatchEvent(new CustomEvent('focus-post', { detail: { post, lat, lng } }));
                      }}
                      onDelete={(id) => onDeletePost?.(id)}
                      autoPlayVideo={true} // 리스트에서 자동 재생 활성화
                    />
                  </div>
                ))}
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
      )}
    </AnimatePresence>
  );
};

export default PostListOverlay;