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
  const { viewedIds } = useViewedPosts(); // ✅ 현재 조회 상태를 가져옴
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // ✅ [FIX] 대전에서 서울 데이터가 나오지 않도록, 현재 지도의 영역(Bounds)을 엄격하게 유지
  // radiusOffset 대신 bounds 기반의 엄격한 필터링 사용
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pullUpDistance, setPullUpDistance] = useState(0);
  const isPullingRef = useRef(false);
  const isDraggingListRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  
  // ✅ [FIX] 지도가 이동할 때마다 initialPosts가 바뀌므로, 이때 hasMore를 다시 true로 리셋해줘야 합니다.
  useEffect(() => {
    setPosts(initialPosts || []);
    setHasMore(true); 
    setIsLoadingMore(false);
    setPullUpDistance(0);
    // radiusOffset 제거
  }, [initialPosts]);

  // Infinite Scroll Handler
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore) return;
    
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
      // 서울이면 서울 근교, 대전이면 대전 근교를 벗어나지 않도록 함
      const expandedLatMin = latMin - latDiff;
      const expandedLatMax = latMax + latDiff;
      const expandedLngMin = lngMin - lngDiff;
      const expandedLngMax = lngMax + lngDiff;

      console.log(`[PostListOverlay] Regional adaptive fetch before ${lastPostDate}...`);

      let { data, error } = await supabase
        .from('posts')
        .select('*')
        .gte('latitude', expandedLatMin)
        .lte('latitude', expandedLatMax)
        .gte('longitude', expandedLngMin)
        .lte('longitude', expandedLngMax)
        .lt('created_at', lastPostDate)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      if (data && data.length > 0) {
        const newPosts: Post[] = await Promise.all(data.map(async (p) => {
          // [FIX] Index.tsx와 동일한 닉네임/아바타 매핑 로직 적용 (p.user_id 기반 실시간 조회)
          let userName = p.user_name || '탐험가';
          let userAvatar = p.user_avatar || '';
          
          if (p.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('nickname, avatar_url')
              .eq('id', p.user_id)
              .maybeSingle();
            
            if (profileData) {
              userName = profileData.nickname || userName;
              userAvatar = profileData.avatar_url || userAvatar;
            }
          }

          let finalImage = p.image_url;
          if (finalImage?.includes('unsplash.com')) {
            finalImage = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";
          }
          
          return {
            id: p.id,
            user: { id: p.user_id, name: userName, avatar: userAvatar || `https://i.pravatar.cc/150?u=${p.user_id}` },
            content: p.content?.replace(/^\[AD\]\s*/, '') || '',
            location: p.location_name || '알 수 없는 장소',
            lat: p.latitude, lng: p.longitude,
            likes: Number(p.likes || 0),
            image: finalImage,
            images: p.images || [finalImage],
            videoUrl: p.video_url, youtubeUrl: p.youtube_url,
            createdAt: new Date(p.created_at),
            category: p.category || 'none',
            commentsCount: 0, comments: [],
            isLiked: false, isAd: p.content?.trim().startsWith('[AD]'), isGif: false,
            borderType: Number(p.likes || 0) >= 9000 ? 'popular' : 'none'
          };
        }));

        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = newPosts.filter(p => !existingIds.has(p.id));
          
          // ✅ [FIX] 추가로 불러온 포스팅들도 즉시 "읽음(조회)" 처리 트리거
          // 뷰어의 markAsViewed를 통해 로컬/서버에 읽음 상태 전파
          if (filteredNew.length > 0) {
            filteredNew.forEach(post => {
              window.dispatchEvent(new CustomEvent('mark-post-viewed', { detail: { id: post.id } }));
            });
          }
          
          return [...prev, ...filteredNew];
        });
      }
    } catch (err) {
      console.error('[PostListOverlay] Regional fetch failed:', err);
    } finally {
      setIsLoadingMore(false);
      setPullUpDistance(0);
    }
  }, [posts, isLoadingMore, currentBounds]);

  // Pull Up 제스처 핸들러 (마우스 이벤트 포함)
  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!scrollContainerRef.current || isLoadingMore) return;
    
    const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
    startYRef.current = pageY;
    startScrollTopRef.current = scrollContainerRef.current.scrollTop;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // 바닥 근처 여부를 더 넉넉하게 체크
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      isPullingRef.current = true;
    }
    
    isDraggingListRef.current = !('touches' in e);
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
    const diff = startYRef.current - pageY;

    // 마우스 드래그 스크롤 (웹 테스트용)
    if (isDraggingListRef.current) {
      scrollContainerRef.current.scrollTop = startScrollTopRef.current + diff;
    }

    // 추가 로드 풀업
    if (isPullingRef.current && diff > 0 && !isLoadingMore && hasMore) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      // 실제로 스크롤이 끝까지 내려간 상태에서만 게이지가 차도록 함
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setPullUpDistance(Math.min(diff * 0.5, 120));
      }
    }
  };

  const handleEnd = () => {
    if (isPullingRef.current) {
      if (pullUpDistance > 80) {
        loadMorePosts();
      } else {
        setPullUpDistance(0);
      }
    }
    
    isPullingRef.current = false;
    isDraggingListRef.current = false;
  };

  // window 객체에 상태 기록
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isPostListOpen = isOpen;
    }
  }, [isOpen]);

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
      className="fixed inset-0 top-[88px] z-[110] bg-white flex flex-col shadow-none overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white sticky top-0 z-10">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">주변 포스트</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total {posts.length} Posts</p>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      {/* List Content */}
      <div 
        ref={scrollContainerRef}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-white pb-40 custom-scrollbar select-none cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {posts.length > 0 ? (
          <div className="flex flex-col">
            {posts.map((post) => (
              <div key={post.id} className="border-b border-gray-100 last:border-0 bg-white">
                <ObservedPostItem 
                  post={post}
                  isViewed={viewedIds.has(post.id)} // ✅ 실제 조회 데이터 전달
                  onVisible={(id) => {
                    window.dispatchEvent(new CustomEvent('mark-post-viewed', { detail: { id } }));
                  }}
                  onLikeToggle={() => {}}
                  onLocationClick={(e, lat, lng) => {
                    window.dispatchEvent(new CustomEvent('focus-post', { detail: { post, lat, lng } }));
                  }}
                  onDelete={(id) => onDeletePost?.(id)}
                />
              </div>
            ))}
            
            {/* Pull Up Loading Area - 항상 로딩 시도가 가능하도록 노출 */}
            <div 
              className="py-2 flex flex-col items-center justify-center transition-all duration-200"
              style={{ height: `${Math.max(40, pullUpDistance + 20)}px` }}
            >
              <div className="flex flex-col items-center gap-2 mb-10">
                {isLoadingMore ? (
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                ) : (
                  <>
                    <motion.div
                      animate={{ y: pullUpDistance > 80 ? -5 : 0 }}
                      className={pullUpDistance > 80 ? "text-indigo-600" : "text-gray-400"}
                    >
                      <ChevronUp className="w-6 h-6" />
                    </motion.div>
                    <p className={`text-xs font-black uppercase tracking-tighter ${pullUpDistance > 80 ? "text-indigo-600" : "text-gray-400"}`}>
                      {pullUpDistance > 80 ? "놓아서 추가 포스팅 로드" : "위로 올려 더 많은 포스팅 보기"}
                    </p>
                  </>
                )}
              </div>
            </div>
            
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