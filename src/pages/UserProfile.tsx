"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Grid, Bookmark, Map as MapIcon, ChevronLeft, UserPlus, Check, MessageCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import PostItem from '@/components/PostItem';
import { getUserById, createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [posts, setPosts] = useState<Post[]>([]);

  // 통합된 사용자 데이터 가져오기
  const user = useMemo(() => {
    return getUserById(userId || 'traveler');
  }, [userId]);

  // 해당 사용자의 포스트 데이터 생성
  useEffect(() => {
    const userPosts = createMockPosts(37.5665, 126.9780, 15)
      .filter(p => !p.isAd)
      .slice(0, 12)
      .map(p => ({
        ...p,
        user: {
          id: user.id,
          name: user.nickname || user.name,
          avatar: user.avatar
        }
      }));
    setPosts(userPosts);
  }, [user]);

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
                  <button 
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                  </button>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">유저 프로필</h2>
                    <p className="text-xs text-gray-400 font-medium">@{user.id} 님의 활동</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreVertical className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Profile Info */}
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                    <img 
                      src={user.avatar} 
                      alt="profile" 
                      className="w-full h-full rounded-full object-cover border-4 border-white"
                      onError={handleImageError}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-gray-900 mb-1">{user.nickname}</h2>
                  <p className="text-sm text-gray-500 mb-4">{user.bio}</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{posts.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{user.followers?.toLocaleString() || '856'}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{user.following?.toLocaleString() || '320'}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mb-8">
                <Button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`flex-1 font-bold rounded-xl gap-2 h-12 transition-all ${
                    isFollowing 
                      ? "bg-gray-100 text-gray-900 hover:bg-gray-200" 
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-4 h-4" /> 팔로잉
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> 팔로우
                    </>
                  )}
                </Button>
                <Button variant="outline" className="flex-1 border-gray-200 text-gray-900 font-bold rounded-xl gap-2 h-12">
                  <MessageCircle className="w-4 h-4" /> 메시지
                </Button>
              </div>

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
              <h2 className="font-bold text-gray-900">{user.nickname}님의 게시물</h2>
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
                    images={post.images}
                    isLiked={post.isLiked}
                    isAd={post.isAd}
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

export default UserProfile;