"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom'; // [핵심] Portal 추가
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { createMockPosts } from '@/lib/mock-data';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';

// --- ObservedPostItem 컴포넌트 (동일) ---
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
      { threshold: [0, 0.6, 1.0], rootMargin: '-10% 0px -10% 0px' }
    );
    if (itemRef.current) observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [post.id, onVisible]);

  return (
    <div ref={itemRef} id={`post-${post.id}`} className="scroll-mt-[150px]">
      <PostItem 
        {...post}
        isViewed={isViewed} 
        onLikeToggle={() => onLikeToggle(post.id)}
        onLocationClick={onLocationClick}
        onDelete={onDelete}
      />
    </div>
  );
};

// --- 메인 PostListOverlay 컴포넌트 ---
interface PostListOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosts: Post[];
  mapCenter: { lat: number; lng: number };
  onDeletePost?: (id: string) => void;
}

const PostListOverlay = ({ isOpen, onClose, initialPosts, mapCenter, onDeletePost }: PostListOverlayProps) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mounted, setMounted] = useState(false); // SSR 대응
  
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 클라이언트 사이드 렌더링 확인 (Portal용)
  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      setPosts(initialPosts);
    } else {
      setPosts([]);
      setIsLoadingMore(false);
    }
  }, [isOpen, initialPosts]);

  const visiblePosts = useMemo(() => {
    if (!isOpen) return posts;
    return posts.length === 0 && initialPosts.length > 0 ? initialPosts : posts;
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
        if (entry.isIntersecting && visiblePosts.length > 0) loadMorePosts();
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, visiblePosts.length, isOpen]);

  const handleLikeToggle = (postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  };

  const handleLocationClick = (e: React.MouseEvent, lat: number, lng: number) => {
    const post = visiblePosts.find(p => p.lat === lat && p.lng === lng);
    onClose();
    navigate('/', { state: { center: { lat, lng }, post } });
  };

  const handleLocalDelete = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    if (onDeletePost) onDeletePost(id);
  };

  // Portal을 통해 렌더링할 내용
  const overlayContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] isolate">
          {/* 1. 뒷 배경: 리스트와 완전히 분리된 독립된 레이어 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001]"
          />

          {/* 2. 콘텐츠: 배경보다 높은 z-index 부여 */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[10002] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* 상단 헤더 */}
            <div className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-[10003]">
              <div>
                <h2 className="text-lg font-black text-gray-900">주변 포스트</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total {filteredPosts.length} Posts</p>
              </div>
              <button onClick={onClose} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all">
                <ChevronLeft className="w-6 h-6 text-gray-600 -rotate-90" />
              </button>
            </div>

            {/* 리스트 영역 */}
            <div className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-32">
              {filteredPosts.length > 0 ? (
                <>
                  {filteredPosts.map((post) => (
                    <ObservedPostItem
                      key={post.id}
                      post={post}
                      onVisible={markAsViewed}
                      isViewed={viewedIds.has(post.id)}
                      onLikeToggle={() => handleLikeToggle(post.id)}
                      onLocationClick={handleLocationClick}
                      onDelete={handleLocalDelete}
                    />
                  ))}
                  <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center gap-3">
                    {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-gray-400 font-medium">표시할 포스트가 없습니다.</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(overlayContent, document.body);
};

export default PostListOverlay;