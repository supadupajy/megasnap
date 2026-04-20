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

const PostListOverlay = ({ isOpen, onClose, initialPosts, mapCenter, onDeletePost }: any) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mounted, setMounted] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    setMounted(true);
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

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
        <div className="fixed inset-0 z-[999999]">
          {/* 1. 투명한 배경 레이어: 눈에 보이지 않지만 클릭은 감지합니다. */}
          <div 
            onClick={onClose}
            className="fixed inset-0 bg-transparent cursor-default"
            style={{ zIndex: 1 }}
          />

          {/* 2. 콘텐츠 컨테이너: 리스트만 위로 올라오게 합니다. */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 bg-white shadow-[0_-8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden"
            style={{ 
              zIndex: 9999,
              transform: 'translateZ(0)' // 레이어 고정
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

            {/* 리스트 영역 */}
            <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pb-32">
              {filteredPosts.length > 0 ? (
                <>
                  {filteredPosts.map((post: any) => (
                    <div key={post.id} id={`post-${post.id}`}>
                      <PostItem 
                        {...post} 
                        isViewed={viewedIds.has(post.id)} 
                        onLikeToggle={() => {}} 
                        onLocationClick={() => {}} 
                        onDelete={() => {}} 
                      />
                    </div>
                  ))}
                  <div ref={loadMoreRef} className="py-10 flex justify-center">
                    {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-gray-400 font-medium">포스트가 없습니다.</div>
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