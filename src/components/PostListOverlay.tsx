"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, MapPin, MessageSquare, Clock, Filter, Loader2, LayoutGrid, ChevronDown } from 'lucide-react';
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
  
  // Update local posts when initialPosts change (map movement)
  useEffect(() => {
    setPosts(initialPosts || []);
    setHasMore(true);
  }, [initialPosts]);

  // Infinite Scroll Handler
  const handleScroll = useCallback(async () => {
    if (!scrollContainerRef.current || isLoadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      setIsLoadingMore(true);
      
      try {
        // 현재 로드된 포스트들 중 가장 오래된 생성일자 기준
        const lastPostDate = posts.length > 0 
          ? new Date(posts[posts.length - 1].createdAt).toISOString()
          : new Date().toISOString();

        // fetchPostsInBounds 유틸리티가 있다면 좋겠지만, 
        // 여기서는 직접 supabase 쿼리를 통해 주변 포스트를 더 가져옵니다.
        const radius = 0.05; // 약 5km 반경 (경위도 기준 단순 근사치)
        
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .lt('created_at', lastPostDate)
          .gte('latitude', mapCenter.lat - radius)
          .lte('latitude', mapCenter.lat + radius)
          .gte('longitude', mapCenter.lng - radius)
          .lte('longitude', mapCenter.lng + radius)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        if (data && data.length > 0) {
          const newPosts: Post[] = data.map(p => ({
            id: p.id,
            user: { id: p.user_id, name: p.user_name || '탐험가', avatar: p.user_avatar },
            content: p.content,
            location: p.location_name,
            lat: p.latitude,
            lng: p.longitude,
            likes: p.likes || 0,
            image: p.image_url,
            images: p.images || [p.image_url],
            videoUrl: p.video_url,
            youtubeUrl: p.youtube_url,
            createdAt: new Date(p.created_at),
            category: p.category || 'none',
            commentsCount: 0,
            comments: [],
            isLiked: false,
            isAd: false,
            isGif: false
          }));

          setPosts(prev => [...prev, ...newPosts]);
          if (data.length < 10) setHasMore(false);
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error('Failed to load more posts:', err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [posts, isLoadingMore, hasMore, mapCenter, initialPosts]);

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
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-white pb-20 custom-scrollbar"
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
            {isLoadingMore && (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
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