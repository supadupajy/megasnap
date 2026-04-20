"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { createMockPosts } from '@/lib/mock-data';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';

// ... ObservedPostItem 컴포넌트는 동일하므로 생략 ...

const PostListOverlay = ({ isOpen, onClose, initialPosts, mapCenter, onDeletePost }: PostListOverlayProps) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // [기존 로직 유지]
  useLayoutEffect(() => {
    if (isOpen) {
      setPosts(initialPosts);
      return;
    }
    setPosts([]);
    setIsLoadingMore(false);
  }, [isOpen, initialPosts]);

  const visiblePosts = useMemo(() => {
    if (!isOpen) return posts;
    if (posts.length === 0 && initialPosts.length > 0) return initialPosts;
    return posts;
  }, [isOpen, posts, initialPosts]);

  const filteredPosts = useMemo(() => {
    return visiblePosts.filter(p => !blockedIds.has(p.user.id));
  }, [visiblePosts, blockedIds]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore || !isOpen) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      const newPosts = createMockPosts(mapCenter.lat, mapCenter.lng, 10);
      setPosts(prev => {
        const combined = [...prev, ...newPosts];
        mapCache.posts = [...mapCache.posts, ...newPosts];
        return combined;
      });
      setIsLoadingMore(false);
    }, 800);
  }, [isLoadingMore, mapCenter, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [loadMorePosts, visiblePosts.length, isOpen]);

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
        <>
          {/* 1. 불투명 레이어 (Backdrop) - 리스트 뒤에 위치하도록 z-index 조정 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose} // 레이어 클릭 시 닫힘
            className="fixed inset-0 z-[1190] bg-black/40 backdrop-blur-sm"
          />

          {/* 2. 실시간 포스팅 리스트 (Content Container) */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }} // 밑에서 위로 올라오는 애니메이션 추천
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1]
            }}
            // z-index를 레이어보다 높게 설정하여 절대 겹치지 않게 함
            className="fixed inset-0 z-[1200] bg-white overflow-y-auto shadow-2xl no-scrollbar flex flex-col"
          >
            {/* 헤더 섹션 */}
            <div className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-30">
              <div>
                <h2 className="text-lg font-black text-gray-900">주변 포스트</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total {filteredPosts.length} Posts</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600 -rotate-90" />
              </button>
            </div>

            {/* 리스트 섹션 */}
            <div className="flex flex-col pt-4 pb-32">
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
                  
                  <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">새로운 추억을 불러오는 중...</p>
                      </>
                    ) : (
                      <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                    )}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-gray-400 font-medium">
                  표시할 포스트가 없습니다.
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PostListOverlay;