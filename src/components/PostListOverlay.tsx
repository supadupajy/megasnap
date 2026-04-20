"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import PostItem from '@/components/PostItem';
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
      >
        <PostItem 
          {...post}
          isViewed={isViewed} 
          onLikeToggle={() => onLikeToggle(post.id)}
          onLocationClick={onLocationClick}
          onDelete={onDelete}
        />
      </motion.div>
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
  onDeletePost,
}: PostListOverlayProps) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expansionStep, setExpansionStep] = useState(0);
  
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
      setHasMore(true);
      setExpansionStep(0);
      return;
    }

    setPosts([]);
    setIsLoadingMore(false);
    setHasMore(true);
    setExpansionStep(0);
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
    if (isLoadingMore || !isOpen || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const loadedIds = new Set(posts.map((post) => post.id));
      let nextStep = expansionStep + 1;
      let foundPosts: Post[] = [];

      while (nextStep <= 12 && foundPosts.length === 0) {
        const previousBounds = getExpandedBounds(nextStep - 1);
        const nextBounds = getExpandedBounds(nextStep);
        const ringPosts = await fetchPostsInBounds(nextBounds.sw, nextBounds.ne);

        foundPosts = ringPosts
          .filter((post) => !loadedIds.has(post.id))
          .filter((post) => !isWithinBounds(post, previousBounds))
          .filter(matchesOverlayFilters)
          .sort((a, b) => getDistanceFromCenter(a) - getDistanceFromCenter(b));

        if (foundPosts.length > 0) {
          break;
        }

        nextStep += 1;
      }

      if (foundPosts.length === 0) {
        setHasMore(false);
        return;
      }

      const batch = foundPosts.slice(0, 12);
      setPosts((prev) => {
        const combined = [...prev, ...batch];
        const existingCacheIds = new Set(mapCache.posts.map((post) => post.id));
        const newCachePosts = batch.filter((post) => !existingCacheIds.has(post.id));
        if (newCachePosts.length > 0) {
          mapCache.posts = [...mapCache.posts, ...newCachePosts];
        }
        return combined;
      });

      if (foundPosts.length <= 12) {
        setExpansionStep(nextStep);
        if (nextStep >= 12) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('[PostListOverlay] Failed to load more real posts:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [expansionStep, getDistanceFromCenter, getExpandedBounds, hasMore, isLoadingMore, isOpen, isWithinBounds, matchesOverlayFilters, posts]);

  useEffect(() => {
    if (!isOpen || !hasMore) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visiblePosts.length > 0) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loadMorePosts, visiblePosts.length, isOpen]);

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
    setAllPosts(prev => prev.filter(p => p.id !== id));
    setDisplayedMarkers(prev => prev.filter(p => p.id !== id));
    if (onDeletePost) onDeletePost(id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          transition={{
            duration: 0.5,
            ease: [0.25, 1, 0.5, 1]
          }}
          // ✅ 위치 및 높이 조정: top-[88px] (헤더 아래) bottom-[106px] (BottomNav 위)
          className="fixed top-[88px] bottom-[80px] left-0 right-0 z-[1001] bg-white overflow-y-auto shadow-2xl no-scrollbar origin-bottom"
        >
          <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-30">
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

          <div className="flex flex-col pt-4 pb-4">
            {filteredPosts.length > 0 ? (
              <>
                {filteredPosts.map((post) => (
                  <ObservedPostItem
                    key={post.id}
                    post={post}
                    onVisible={markAsViewed}
                    isViewed={viewedIds.has(post.id)}
                    onLikeToggle={handleLikeToggle}
                    onLocationClick={handleLocationClick}
                    onDelete={handleLocalDelete}
                  />
                ))}
                
                {(isLoadingMore || hasMore) && (
                  <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">주변 실제 포스트를 불러오는 중...</p>
                      </>
                    ) : (
                      <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                    )}
                  </div>
                )}

                {!hasMore && (
                  <div className="py-10 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                    더 이상 주변 실제 포스트가 없습니다.
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center text-gray-400 font-medium">
                표시할 포스트가 없습니다.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PostListOverlay;