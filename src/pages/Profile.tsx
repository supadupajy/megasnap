"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Settings, Grid, Bookmark, Map as MapIcon, User as UserIcon, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import PostItem from '@/components/PostItem';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const Profile = () => {
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const listRef = useRef<HTMLDivElement>(null);

  // 내 포스트 데이터 생성 (인플루언서 포스트 제외)
  useEffect(() => {
    const myPosts = createMockPosts(37.5665, 126.9780, 20)
      .filter(p => !p.isInfluencer && !p.isAd) // 인플루언서 및 광고 포스트 제외
      .slice(0, 12) // 12개로 제한
      .map(p => ({
        ...p,
        user: {
          id: 'me',
          name: 'Dyad_Explorer',
          avatar: 'https://i.pravatar.cc/150?u=me'
        }
      }));
    setPosts(myPosts);
  }, []);

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

  const handleGridItemClick = (postId: string) => {
    setViewMode('list');
    // 클릭한 포스트 위치로 스크롤하기 위해 약간의 지연 후 실행
    setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = FALLBACK_IMAGE;
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />

      <div className="pt-[88px]">
        {viewMode === 'grid' ? (
          <>
            {/* Title Section */}
            <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                    <UserIcon className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">내 프로필</h2>
                    <p className="text-xs text-gray-400 font-medium">나의 활동과 기록을 확인하세요</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <Settings className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Profile Info */}
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                    <img 
                      src="https://i.pravatar.cc/150?u=me" 
                      alt="profile" 
                      className="w-full h-full rounded-full object-cover border-4 border-white"
                      onError={handleImageError}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-gray-900 mb-1">Dyad_Explorer</h2>
                  <p className="text-sm text-gray-500 mb-4">지도를 여행하는 탐험가 📍</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{posts.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">1.2k</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">850</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">
                프로필 편집
              </Button>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 mb-4">
                <button className="flex-1 py-3 flex justify-center border-b-2 border-indigo-600">
                  <Grid className="w-6 h-6 text-indigo-600" />
                </button>
                <button className="flex-1 py-3 flex justify-center text-gray-300">
                  <MapIcon className="w-6 h-6" />
                </button>
                <button className="flex-1 py-3 flex justify-center text-gray-300">
                  <Bookmark className="w-6 h-6" />
                </button>
              </div>

              {/* Grid Posts */}
              <div className="grid grid-cols-3 gap-1">
                {posts.map((post) => (
                  <div 
                    key={post.id} 
                    className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group"
                    onClick={() => handleGridItemClick(post.id)}
                  >
                    <img 
                      src={post.image} 
                      alt="" 
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                      onError={handleImageError}
                    />
                    {post.isGif && (
                      <div className="absolute top-1 right-1 bg-black/40 rounded-full p-0.5">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col">
            {/* List View Header */}
            <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-[88px] bg-white z-20">
              <button 
                onClick={() => setViewMode('grid')}
                className="p-1 hover:bg-gray-50 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-800" />
              </button>
              <h2 className="font-bold text-gray-900">게시물</h2>
            </div>

            {/* Post List */}
            <div className="flex flex-col pt-4">
              {posts.map((post) => (
                <div 
                  key={post.id} 
                  id={`post-${post.id}`}
                  className="scroll-mt-[150px]"
                >
                  <PostItem
                    user={post.user}
                    content={post.content}
                    location={post.location}
                    likes={post.likes}
                    image={post.image}
                    isLiked={post.isLiked}
                    isGif={post.isGif}
                    isInfluencer={post.isInfluencer}
                    borderType={post.borderType}
                    disablePulse={true}
                    onLikeToggle={() => handleLikeToggle(post.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Profile;