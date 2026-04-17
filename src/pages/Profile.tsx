"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Settings, Grid, Bookmark, User as UserIcon, ChevronLeft, Play, Map, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import PostItem from '@/components/PostItem';
import ProfileEditDrawer from '@/components/ProfileEditDrawer';
import { createMockPosts, GIF_POOL } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isDataLoading, setIsDataLoading] = useState(true);

  const displayName = profile?.nickname || authUser?.email?.split('@')[0] || '탐험가';
  const bio = profile?.bio || "지도를 여행하는 탐험가 📍";

  const loadData = useCallback(async () => {
    if (!authUser) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);
    try {
      // 1. 실제 DB 포스팅 가져오기
      const { data: realData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      const realPosts = (realData || []).map(p => ({
        id: p.id,
        isAd: false,
        isGif: false,
        isInfluencer: false,
        user: {
          id: p.user_id,
          name: p.user_name || displayName,
          avatar: p.user_avatar || profile?.avatar_url || `https://i.pravatar.cc/150?u=${p.user_id}`
        },
        content: p.content || '',
        location: p.location_name || '알 수 없는 장소',
        lat: p.latitude,
        lng: p.longitude,
        likes: Number(p.likes || 0),
        commentsCount: 0,
        comments: [],
        image: p.image_url || FALLBACK_IMAGE,
        isLiked: false,
        createdAt: new Date(p.created_at),
        borderType: 'none'
      })) as Post[];
      
      // 2. 추천 데이터 생성 (Mock)
      const rawMock = createMockPosts(37.5665, 126.9780, 12);
      const mockMine = rawMock.map((p, idx) => {
        const isGif = idx < 4;
        const image = isGif ? GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)] : p.image;
        return {
          ...p,
          isGif,
          image,
          user: {
            id: authUser.id,
            name: displayName,
            avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`
          }
        };
      });

      // 3. 데이터 통합 및 정렬
      const combined = [...realPosts, ...mockMine].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      setMyPosts(combined);

      // 4. 저장된 포스팅 (Mock)
      const saved = createMockPosts(37.5665, 126.9780, 12)
        .filter(p => p.user.id !== authUser.id)
        .map(p => ({ ...p, isLiked: true }));
      setSavedPosts(saved);
    } catch (err) {
      console.error('[Profile] Data load error:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [authUser, displayName, profile]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, loadData]);

  const handleLikeToggle = useCallback((postId: string, isSaved: boolean) => {
    const setter = isSaved ? setSavedPosts : setMyPosts;
    setter(prev => prev.map(post => {
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
    if (viewMode === 'gifs') {
      setViewMode('gif-list');
    } else {
      setViewMode('list');
    }
    
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

  const handlePostDelete = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  // 인증 로딩 중이거나, 데이터 로딩 중이면서 아직 게시물이 하나도 없을 때만 로더 표시
  if (authLoading || (isDataLoading && myPosts.length === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />

      <div className="pt-[88px]">
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
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Settings className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                <img 
                  src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser?.id}`} 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white"
                  onError={handleImageError}
                />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{displayName}</h2>
              <p className="text-sm text-gray-500 mb-4">{bio}</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{myPosts.length}</p>
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

          <Button 
            onClick={() => setIsEditOpen(true)}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8"
          >
            프로필 편집
          </Button>

          <div className="flex border-b border-gray-100 mb-4">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "flex-1 py-3 flex justify-center transition-all",
                (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600" : "text-gray-300"
              )}
            >
              <Grid className={cn("w-6 h-6", (viewMode === 'grid' || viewMode === 'list') ? "text-indigo-600" : "")} />
            </button>
            <button 
              onClick={() => setViewMode('gifs')}
              className={cn(
                "flex-1 py-3 flex justify-center transition-all",
                (viewMode === 'gifs' || viewMode === 'gif-list') ? "border-b-2 border-indigo-600" : "text-gray-300"
              )}
            >
              <Play className={cn("w-6 h-6", (viewMode === 'gifs' || viewMode === 'gif-list') ? "text-indigo-600" : "")} />
            </button>
            <button 
              onClick={() => setViewMode('saved')}
              className={cn(
                "flex-1 py-3 flex justify-center transition-all",
                viewMode === 'saved' ? "border-b-2 border-indigo-600" : "text-gray-300"
              )}
            >
              <Bookmark className={cn("w-6 h-6", viewMode === 'saved' ? "text-indigo-600" : "")} />
            </button>
          </div>

          <div className="flex flex-col -mx-6">
            {viewMode === 'saved' ? (
              <>
                <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4">
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                    <Bookmark className="w-4 h-4 fill-indigo-600" />
                    저장된 포스팅
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5">다른 탐험가들의 멋진 기록들</p>
                </div>
                {savedPosts.map((post) => (
                  <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                    <PostItem
                      id={post.id}
                      user={post.user}
                      content={post.content}
                      location={post.location}
                      likes={post.likes}
                      commentsCount={post.commentsCount}
                      comments={post.comments}
                      image={post.image}
                      images={post.images}
                      isLiked={post.isLiked}
                      isAd={post.isAd}
                      isGif={post.isGif}
                      isInfluencer={post.isInfluencer}
                      borderType={post.borderType}
                      disablePulse={true}
                      onLikeToggle={() => handleLikeToggle(post.id, true)}
                    />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div 
                  onClick={() => navigate('/', { state: { filterUserId: 'me' } })}
                  className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors"
                >
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                    <Map className="w-4 h-4 fill-indigo-600" />
                    지도에서 보기
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5">나의 추억들을 지도에서 확인하세요</p>
                </div>

                {(viewMode === 'list' || viewMode === 'gif-list') ? (
                  <div className="flex flex-col">
                    {(viewMode === 'gif-list' ? myPosts.filter(p => p.isGif) : myPosts).map((post) => (
                      <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                        <PostItem
                          id={post.id}
                          user={post.user}
                          content={post.content}
                          location={post.location}
                          likes={post.likes}
                          commentsCount={post.commentsCount}
                          comments={post.comments}
                          image={post.image}
                          images={post.images}
                          isLiked={post.isLiked}
                          isAd={post.isAd}
                          isGif={post.isGif}
                          isInfluencer={post.isInfluencer}
                          borderType={post.borderType}
                          disablePulse={true}
                          onLikeToggle={() => handleLikeToggle(post.id, false)}
                          onDelete={handlePostDelete}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 px-6">
                    {(viewMode === 'gifs' ? myPosts.filter(p => p.isGif) : myPosts).map((post) => (
                      <div 
                        key={post.id} 
                        className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group"
                        onClick={() => handleGridItemClick(post.id)}
                      >
                        <img src={post.image} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer" onError={handleImageError} />
                        {post.isGif && (
                          <div className="absolute top-1 right-1 bg-black/40 rounded-full p-0.5">
                            <Play className="w-2.5 h-2.5 text-white fill-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <ProfileEditDrawer 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        onUpdate={refreshProfile}
      />
    </div>
  );
};

export default Profile;