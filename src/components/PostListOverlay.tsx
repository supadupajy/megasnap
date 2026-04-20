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

// --- ObservedPostItem 컴포넌트 (기존 로직 동일) ---
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

// --- 메인 PostListOverlay 컴포넌트 ---
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
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[99999]" 
          style={{ isolation: 'isolate' }} // [핵심 1] 내부 z-index가 외부와 절대 섞이지 않도록 격리
        >
          {/* 1. 불투명 배경 레이어 (Backdrop) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ zIndex: 1 }} // 가장 아래 레이어
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* 2. 실제 리스트 컨테이너 (Content) */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            style={{ 
              zIndex: 10, // 배경보다 명확히 높은 값
              willChange: 'transform', // [핵심 2] 브라우저에게 미리 레이어를 준비시키라고 명령
              transformStyle: 'preserve-3d', // [핵심 3] 3D 렌더링 공간을 강제하여 레이어 순서를 고정
              backfaceVisibility: 'hidden'
            }}
            className="absolute inset-0 bg-white shadow-2xl flex flex-col overflow-hidden"
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
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default PostListOverlay;