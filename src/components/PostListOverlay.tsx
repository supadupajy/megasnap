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
  
  // [FIX] window 객체에 상태 기록
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isPostListOpen = isOpen;
    }
  }, [isOpen]);

  const filteredPosts = useMemo(() => {
    return initialPosts.filter(post => {
      return true;
    });
  }, [initialPosts]);

  return (
    <motion.div 
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ 
        type: 'tween', 
        duration: 0.3, 
        ease: [0.32, 0.72, 0, 1] 
      }}
      style={{ willChange: 'transform' }}
      className="fixed inset-x-0 bottom-0 top-[88px] z-[110] bg-white flex flex-col shadow-none overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white sticky top-0 z-10">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">주변 포스트</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total {filteredPosts.length} Posts</p>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
        >
          <ChevronDown className="w-6 h-6" />
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
  );
};

export default PostListOverlay;