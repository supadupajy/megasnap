"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { createMockPosts } from '@/lib/mock-data';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';

const ObservedPostItem = ({ post, onVisible, isViewed, onLikeToggle, onLocationClick }: { post: Post, onVisible: (id: string) => void, isViewed: boolean, onLikeToggle: (id: string) => void, onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void }) => {
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
        {...post}
        isViewed={isViewed} 
        onLikeToggle={() => onLikeToggle(post.id)}
        onLocationClick={onLocationClick}
      />
    </div>
  );
};

interface PostListOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosts: Post[];
  mapCenter: { lat: number; lng: number };
}

const PostListOverlay = ({ isOpen, onClose, initialPosts, mapCenter }: PostListOverlayProps) => {
  const navigate = useNavigate();
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  useEffect(() => {
    if (isOpen) {
      setPosts(initialPosts);
    }
  }, [isOpen, initialPosts]);

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
        if (entry.isIntersecting && posts.length > 0) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length, isOpen]);

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
    const post = posts.find(p => p.lat === lat && p.lng === lng);
    onClose();
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ 
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="fixed top-[88px] bottom-0 left-0 right-0 z-40 bg-white overflow-y-auto shadow-2xl no-scrollbar"
        >
          <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-30">
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
      )}
    </AnimatePresence>
  );
};

export default PostListOverlay;