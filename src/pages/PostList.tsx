"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, LayoutGrid } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PostItem from '@/components/PostItem';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import { Post } from '@/types';

const PostList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  useEffect(() => {
    if (location.state?.posts) {
      setPosts(location.state.posts);
    } else {
      // 데이터가 없으면 지도로 리다이렉트
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
        {/* List Header with Back Button */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-[88px] bg-white/90 backdrop-blur-md z-20">
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
              <div key={post.id} onClick={() => setSelectedPostId(post.id)}>
                <PostItem
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
                />
              </div>
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