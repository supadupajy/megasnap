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
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pullUpDistance, setPullUpDistance] = useState(0);
  const isPullingRef = useRef(false);
  const isDraggingListRef = useRef(false); // ✅ 마우스 드래그 스크롤용 변수
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0); // ✅ 시작 시 스크롤 위치 기록
  
  // Update local posts when initialPosts change (map movement)
  useEffect(() => {
    setPosts(initialPosts || []);
    setHasMore(true);
  }, [initialPosts]);

  // Infinite Scroll Handler
  const loadMorePosts = useCallback(async () => {
    // isLoadingMore 체크를 강화하여 중복 호출 방지
    if (isLoadingMore || !hasMore) return;
    
    console.log('[PostListOverlay] Loading more posts...', { lastIndex: posts.length });
    setIsLoadingMore(true);
    
    try {
      // 마지막 포스트의 생성 날짜를 기준으로 다음 10개를 가져옴
      const lastPostDate = posts.length > 0 
        ? new Date(posts[posts.length - 1].createdAt).toISOString()
        : new Date().toISOString();

      let query = supabase
        .from('posts')
        .select('*')
        .lt('created_at', lastPostDate)
        .order('created_at', { ascending: false })
        .limit(10);

      // currentBounds가 있다면 해당 영역 내에서 검색
      if (currentBounds) {
        query = query
          .gte('latitude', Math.min(currentBounds.sw.lat, currentBounds.ne.lat))
          .lte('latitude', Math.max(currentBounds.sw.lat, currentBounds.ne.lat))
          .gte('longitude', Math.min(currentBounds.sw.lng, currentBounds.ne.lng))
          .lte('longitude', Math.max(currentBounds.sw.lng, currentBounds.ne.lng));
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const newPosts: Post[] = await Promise.all(data.map(async (p) => {
          // [FIX] 프로필 정보(닉네임, 아바타)를 올바르게 불러오기 위한 추가 쿼리
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
            user: { 
              id: p.user_id, 
              name: userName, 
              avatar: userAvatar || `https://i.pravatar.cc/150?u=${p.user_id}` 
            },
            content: p.content?.replace(/^\[AD\]\s*/, '') || '',
            location: p.location_name || '알 수 없는 장소',
            lat: p.latitude,
            lng: p.longitude,
            likes: Number(p.likes || 0),
            image: finalImage,
            images: p.images || [finalImage],
            videoUrl: p.video_url,
            youtubeUrl: p.youtube_url,
            createdAt: new Date(p.created_at),
            category: p.category || 'none',
            commentsCount: 0,
            comments: [],
            isLiked: false,
            isAd: p.content?.trim().startsWith('[AD]'),
            isGif: false,
            borderType: Number(p.likes || 0) >= 9000 ? 'popular' : 'none'
          };
        }));

        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
        
        // 10개를 꽉 채워서 가져오지 못했다면 더 이상 데이터가 없는 것으로 판단
        if (data.length < 10) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[PostListOverlay] Error loading more:', err);
    } finally {
      setIsLoadingMore(false);
      // 풀업 거리 초기화를 확실하게 처리
      setPullUpDistance(0);
    }
  }, [posts, isLoadingMore, hasMore, currentBounds]);

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
                <PostItem 
                  post={post}
                  onLikeToggle={() => {}}
                  onLocationClick={(e, lat, lng) => {
                    window.dispatchEvent(new CustomEvent('focus-post', { detail: { post, lat, lng } }));
                  }}
                  onDelete={(id) => onDeletePost?.(id)}
                  autoPlayVideo={true}
                />
              </div>
            ))}
            
            {/* Pull Up Loading Area */}
            {hasMore && (
              <div 
  className="pt-2 pb-0 flex flex-col items-center justify-start transition-all duration-200"
  style={{ height: `${Math.max(40, pullUpDistance + 20)}px` }}
>
  <div className="flex flex-col items-center gap-1">
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
            )}
            
            {!hasMore && (
              <div className="py-12 flex flex-col items-center justify-center text-gray-300">
                <div className="w-1 h-1 bg-gray-200 rounded-full mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">End of Map Results</p>
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