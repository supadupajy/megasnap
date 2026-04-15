"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { createMockPosts } from '@/lib/mock-data';
import { mapCache } from '@/utils/map-cache';
import { motion } from 'framer-motion';

const ObservedPostItem = ({ post, onVisible, isViewed, ...props }: { post: Post, onVisible: (id: string) => void, isViewed: boolean, [key: string]: any }) => {
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
      <PostItem {...props} isViewed={isViewed} />
    </div>
  );
};

const PostList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { viewedIds, markAsViewed } = useViewedPosts();
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const mapCenter = location.state?.center || { lat: 37.5665, lng: 126.9780 };

  useEffect(() => {
    if (location.state?.posts) {
      setPosts(location.state.posts);
    } else {
      navigate('/');
    }
  }, [location.state, navigate]);

  const loadMorePosts = useCallback(() => {
    if (isLoadingMore) return;
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
  }, [isLoadingMore, mapCenter]);

  useEffect(() => {
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
  }, [loadMorePosts, posts.length]);

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
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        mass: 0.8
      }}
      className="fixed inset-0 z-[60] bg-white pt-[88px] pb-28 overflow-y-auto shadow-2xl"
    >
      <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-30">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h2 className="text-lg font-black text-gray-900">주변 포스트</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total {posts.length} Posts</p>
        </div>
      </div>

      <div className="flex flex-col pt-4">
        {posts.length > 0 ? (
          <>
            {posts.map((post) => (
              <ObservedPostItem
                key={post.id}
                post={post}
                onVisible={markAsViewed}
                isViewed={viewedIds.has(post.id)}
                user={post.user}
                content={post.content}
                location={post.location}
                likes={post.likes}
                image={post.image}
                images={post.images}
                adImageIndex={post.adImageIndex}
                lat={post.lat}
                lng={post.lng}
                isLiked={post.isLiked}
                isAd={post.isAd}
                isGif={post.isGif}
                isInfluencer={post.isInfluencer}
                category={post.category}
                borderType={post.borderType}
                disablePulse={true}
                onLikeToggle={() => handleLikeToggle(post.id)}
                onLocationClick={handleLocationClick}
                onClick={() => {
                  setSelectedPostId(post.id);
                  markAsViewed(post.id);
                }}
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

      {selectedPostId && (
        <PostDetail 
          posts={posts} 
          initialIndex={posts.findIndex(p => p.id === selectedPostId)}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
          onViewPost={markAsViewed}
          onLikeToggle={handleLikeToggle}
          onLocationClick={(lat, lng) => {
            const post = posts.find(p => p.lat === lat && p.lng === lng);
            navigate('/', { state: { center: { lat, lng }, post } });
          }}
        />
      )}
    </motion.div>
  );
};

export default PostList;