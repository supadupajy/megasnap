"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import { Post } from '@/types';
import { useViewedPosts } from '@/hooks/use-viewed-posts';

// 개별 포스트의 가시성을 감시하는 컴포넌트
const ObservedPostItem = ({ post, onVisible, ...props }: { post: Post, onVisible: (id: string) => void, [key: string]: any }) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(post.id);
          // 한 번 감지되면 감시 종료 (성능 최적화)
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.5 } // 포스트가 50% 이상 보일 때 감지
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, [post.id, onVisible]);

  return (
    <div ref={itemRef} id={`post-${post.id}`} className="scroll-mt-[150px]">
      <PostItem {...props} />
    </div>
  );
};

const PostList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const { markAsViewed } = useViewedPosts();

  useEffect(() => {
    if (location.state?.posts) {
      setPosts(location.state.posts);
    } else {
      navigate('/map');
    }
  }, [location.state, navigate]);

  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likes: isLiked ? post.likes + 1 : post.likes - 1
        };
      }
      return post;
    }));
  }, []);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    const post = posts.find(p => p.lat === lat && p.lng === lng);
    navigate('/map', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      
      <div className="pt-[88px]">
        {/* z-index를 30으로 높여 HOT 배지(z-20)보다 위에 오도록 수정 */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-[88px] bg-white/90 backdrop-blur-md z-30">
          <button 
            onClick={() => navigate('/map')}
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
            posts.map((post) => (
              <ObservedPostItem
                key={post.id}
                post={post}
                onVisible={markAsViewed} // 화면에 보이면 읽음 처리
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
                isGif={post.isGif}
                isInfluencer={post.isInfluencer}
                category={post.category}
                borderType={post.borderType}
                disablePulse={true}
                onLikeToggle={() => handleLikeToggle(post.id)}
                onLocationClick={handleLocationClick}
                onClick={() => setSelectedPostId(post.id)}
              />
            ))
          ) : (
            <div className="py-20 text-center text-gray-400 font-medium">
              표시할 포스트가 없습니다.
            </div>
          )}
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      
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
            navigate('/map', { state: { center: { lat, lng }, post } });
          }}
        />
      )}
      
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default PostList;