"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { createMockPosts } from '@/lib/mock-data';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';

// --- ObservedPostItem (변동 없음) ---
const ObservedPostItem = ({ post, onVisible, isViewed, onLikeToggle, onLocationClick, onDelete }: any) => {
  const itemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(post.id);
          observer.unobserve(entry.target);
        }
      },
      { threshold: [0, 0.6, 1.0], rootMargin: '-10% 0px -10% 0px' }
    );
    if (itemRef.current) observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [post.id, onVisible]);

  return (
    <div ref={itemRef} id={`post-${post.id}`} className="scroll-mt-[150px]">
      <PostItem {...post} isViewed={isViewed} onLikeToggle={() => onLikeToggle(post.id)} onLocationClick={onLocationClick} onDelete={onDelete} />
    </div>
  );
};

const PostListOverlay = ({ isOpen, onClose, initialPosts, mapCenter, onDeletePost }: any) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mounted, setMounted] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (isOpen) setPosts(initialPosts);
    else { setPosts([]); setIsLoadingMore(false); }
  }, [isOpen, initialPosts]);

  const filteredPosts = useMemo(() => posts.filter(p => !blockedIds.has(p.user.id)), [posts, blockedIds]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore || !isOpen) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      const newPosts = createMockPosts(mapCenter.lat, mapCenter.lng, 10);
      setPosts(prev => [...prev, ...newPosts]);
      setIsLoadingMore(false);
    }, 800);
  }, [isLoadingMore, mapCenter, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMorePosts(); }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, isOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* 1. 배경 레이어: 오직 배경만 담당 (z-index: 999998) */}
          <motion.div
            key="overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ 
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 999998 // 콘텐츠보다 무조건 낮음
            }}
          />

          {/* 2. 실시간 리스트 레이아웃: 무조건 최상단 (z-index: 999999) */}
          <motion.div
            key="overlay-content"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{ 
              position: 'fixed',
              inset: 0,
              backgroundColor: 'white',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 999999 // 이 세상 그 무엇보다 위에 있음
            }}
          >
            {/* 고정 헤더 */}
            <div className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-900">주변 포스트</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total {filteredPosts.length} Posts</p>
              </div>
              <button onClick={onClose} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-95">
                <ChevronLeft className="w-6 h-6 text-gray-600 -rotate-90" />
              </button>
            </div>

            {/* 스크롤 리스트 영역 */}
            <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pb-32">
              {filteredPosts.length > 0 ? (
                <>
                  {filteredPosts.map((post) => (
                    <ObservedPostItem
                      key={post.id}
                      post={post}
                      onVisible={markAsViewed}
                      isViewed={viewedIds.has(post.id)}
                      onLikeToggle={() => {}}
                      onLocationClick={() => {}}
                      onDelete={() => {}}
                    />
                  ))}
                  <div ref={loadMoreRef} className="py-10 flex justify-center">
                    {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-gray-400">포스트가 없습니다.</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body // DOM 최상단으로 강제 이동
  );
};

export default PostListOverlay;