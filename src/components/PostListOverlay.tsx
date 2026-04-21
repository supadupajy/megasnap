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

      // 한 번의 로딩 시도당 약 20개 내외를 목표로 검색
      // 데이터를 충분히(약 20개) 모으거나, 최대 10단계까지 확장할 때까지 반복
      for (let i = 0; i < 10; i++) {
        const nextStep = currentStep + 1;
        if (nextStep > 50) { // 총 탐색 한계치 증가
          setHasMore(false);
          break;
        }

        // 확장 반경을 더 세밀하게 조정 (0.1씩 증가)
        const multiplier = 1 + (0.2 * nextStep);
        const expandLat = baseLatSpan * multiplier;
        const expandLng = baseLngSpan * multiplier;

        const expandedBounds = {
          sw: { lat: mapCenter.lat - expandLat, lng: mapCenter.lng - expandLng },
          ne: { lat: mapCenter.lat + expandLat, lng: mapCenter.lng + expandLat }
        };

        console.log(`[PostList] Searching... Step: ${nextStep}, Multiplier: ${multiplier.toFixed(1)}x`);
        
        const newRawPosts = await fetchPostsInBounds(
          expandedBounds.sw,
          expandedBounds.ne,
          1,
          mapCenter
        );

        // 아직 로딩되지 않은 새로운 데이터만 추출
        const uniqueNewRawPosts = newRawPosts.filter(p => !loadedPostIds.current.has(p.id));
        
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
              videoUrl: p.video_url,
              youtubeUrl: p.youtube_url,
              category: p.category || 'none',
              isLiked: false,
              createdAt: new Date(p.created_at),
              borderType: 'none',
            } as Post;
          }));

          // 새로 찾은 포스트들을 ID 세트에 등록
          mappedPosts.forEach(p => loadedPostIds.current.add(p.id));
          
          // 현재 위치에서 가까운 순으로 정렬하여 배치에 추가
          const sortedNew = mappedPosts.sort((a, b) => {
            const distA = Math.sqrt(Math.pow((a.lat || 0) - mapCenter.lat, 2) + Math.pow((a.lng || 0) - mapCenter.lng, 2));
            const distB = Math.sqrt(Math.pow((b.lat || 0) - mapCenter.lat, 2) + Math.pow((b.lng || 0) - mapCenter.lng, 2));
            return distA - distB;
          });

          newPostsBatch = [...newPostsBatch, ...sortedNew];
          foundPostsCount += sortedNew.length;
          currentStep = nextStep;

          // 목표치(20개 내외)를 채웠다면 중단
          if (foundPostsCount >= 15) {
            // 너무 많이 가져오지 않도록 최대 25개로 제한
            if (newPostsBatch.length > 25) {
              newPostsBatch = newPostsBatch.slice(0, 25);
            }
            break;
          }
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
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          transition={{
            duration: 0.5,
            ease: [0.25, 1, 0.5, 1]
          }}
          // ✅ z-index를 최상위(2000)로 높여 종료 팝업(일반적으로 1000대)보다 위로 배치
          className="fixed top-[88px] bottom-[80px] left-0 right-0 z-[2000] bg-white overflow-y-auto shadow-2xl no-scrollbar origin-bottom"
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