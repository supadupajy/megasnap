"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Settings, Grid, Bookmark, User as UserIcon, Loader2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import PostItem from '@/components/PostItem';
import ProfileEditDrawer from '@/components/ProfileEditDrawer';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading, refreshProfile } = useAuth();
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 무한 루프 및 중복 호출 방지 락
  const fetchLock = useRef(false);
  const initialized = useRef(false);

  const userId = user?.id;
  const displayName = useMemo(() => profile?.nickname || user?.email?.split('@')[0] || '탐험가', [profile, user]);
  const avatarUrl = useMemo(() => profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`, [profile, userId]);

  // 1. 이미지 URL 정규화 함수
  const getImageUrl = (path: string) => {
    if (!path) return FALLBACK_IMAGE;
    if (path.startsWith('http')) return path; // 이미 풀 경로인 경우
    
    // Storage 버킷에서 Public URL 추출 (버킷명 'post-images' 확인 필요)
    const { data } = supabase.storage.from('post-images').getPublicUrl(path);
    return data?.publicUrl || FALLBACK_IMAGE;
  };

  // 2. 데이터 로드 로직
  const loadProfileData = useCallback(async (uid: string) => {
    if (fetchLock.current || initialized.current) return;
    fetchLock.current = true;

    try {
      console.log("📡 [Profile] 데이터 및 이미지 경로 로딩...");

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedPosts = data.map(p => ({
          id: p.id,
          user: { id: p.user_id, name: displayName, avatar: avatarUrl },
          content: p.content || '',
          location: p.location_name || '장소 정보 없음',
          image: getImageUrl(p.image_url || p.image), // 이미지 URL 조립
          likes: Number(p.likes || 0),
          isLiked: false,
          createdAt: new Date(p.created_at),
          commentsCount: 0,
          comments: [],
          isAd: false,
          isGif: false,
          isInfluencer: false,
          borderType: 'none'
        })) as Post[];
        setMyPosts(formattedPosts);
      }

      setSavedPosts(createMockPosts(37.5665, 126.9780, 6, `saved_${uid}`).map(p => ({ ...p, isLiked: true })));
      initialized.current = true;
    } catch (err) {
      console.error("❌ [Profile] 로드 에러:", err);
    } finally {
      setDataLoaded(true);
      fetchLock.current = false;
    }
  }, [displayName, avatarUrl]);

  // 3. 실행 트리거
  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    if (!initialized.current) {
      loadProfileData(userId);
    }
  }, [authLoading, userId, loadProfileData, navigate]);

  if (authLoading || (!dataLoaded && !initialized.current)) {
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
        <div className="px-6 py-8">
          {/* 프로필 정보 */}
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img 
                src={avatarUrl} 
                className="w-full h-full rounded-full object-cover border-4 border-white" 
                alt="profile"
                onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/150")}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-black text-gray-900">{displayName}</h2>
                <button onClick={() => navigate('/settings')} className="p-1">
                  <Settings className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{profile?.bio || "나의 소중한 기록들 📍"}</p>
              <div className="flex gap-6">
                <div className="text-center"><p className="font-bold text-gray-900">{myPosts.length}</p><p className="text-[10px] text-gray-400 font-black">POSTS</p></div>
                <div className="text-center"><p className="font-bold">0</p><p className="text-[10px] text-gray-400 font-black">FOLLOWERS</p></div>
                <div className="text-center"><p className="font-bold">0</p><p className="text-[10px] text-gray-400 font-black">FOLLOWING</p></div>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setIsEditOpen(true)} 
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8"
          >
            프로필 편집
          </Button>

          {/* 뷰 모드 탭 */}
          <div className="flex border-b border-gray-100 mb-6">
            <button 
              onClick={() => setViewMode('grid')} 
              className={cn("flex-1 py-3 flex justify-center transition-all", viewMode !== 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}
            >
              <Grid className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setViewMode('saved')} 
              className={cn("flex-1 py-3 flex justify-center transition-all", viewMode === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}
            >
              <Bookmark className="w-6 h-6" />
            </button>
          </div>

          {/* 콘텐츠 리스트 */}
          <div className="flex flex-col">
            {viewMode === 'saved' ? (
              <div className="space-y-4">
                {savedPosts.map(post => <PostItem key={post.id} {...post} />)}
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-3 gap-1">
                    {myPosts.map(post => (
                      <div 
                        key={post.id} 
                        className="aspect-square bg-gray-100 overflow-hidden cursor-pointer relative group" 
                        onClick={() => setViewMode('list')}
                      >
                        <img 
                          src={post.image} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          alt=""
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMAGE;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myPosts.map(post => <PostItem key={post.id} {...post} />)}
                  </div>
                )}
                {dataLoaded && myPosts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <ImageOff className="w-12 h-12 mb-2 opacity-20" />
                    <p className="font-medium">작성된 게시글이 없습니다.</p>
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