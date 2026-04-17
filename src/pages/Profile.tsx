"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Settings, Grid, Bookmark, User as UserIcon, Loader2 } from 'lucide-react';
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

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading, refreshProfile } = useAuth();
  
  // 1. 상태 관리
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 2. [핵심] 무한 루프 방지용 물리적 락 (Ref)
  const fetchLock = useRef(false);
  const initialized = useRef(false);

  // 3. 사용자 정보 메모이제이션
  const userId = user?.id;
  const displayName = useMemo(() => profile?.nickname || user?.email?.split('@')[0] || '탐험가', [profile, user]);
  const avatarUrl = useMemo(() => profile?.avatar_url || `https://i.pravatar.cc/150?u=${userId}`, [profile, userId]);

  // 4. 데이터 로드 함수
  const loadProfileData = useCallback(async (uid: string) => {
    if (fetchLock.current || initialized.current) return;
    fetchLock.current = true;

    console.log("📡 [Profile] 데이터 로딩 시작...");

    try {
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
          location: p.location_name || '알 수 없는 장소',
          image: p.image_url || p.image || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
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

      // 저장된 게시물 (Mock)
      setSavedPosts(createMockPosts(37.5665, 126.9780, 6, `saved_${uid}`).map(p => ({ ...p, isLiked: true })));
      
      initialized.current = true; // 로드 성공 기록
    } catch (err) {
      console.error("❌ [Profile] 로드 에러:", err);
    } finally {
      setDataLoaded(true);
      fetchLock.current = false;
    }
  }, [displayName, avatarUrl]);

  // 5. 인증 상태에 따른 트리거
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

  // 6. UI 핸들러
  const handleGridItemClick = () => setViewMode('list');

  // --- 로딩 UI ---
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
        {/* 상단 프로필 영역 */}
        <div className="px-6 py-8">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img 
                src={avatarUrl} 
                alt="profile" 
                className="w-full h-full rounded-full object-cover border-4 border-white" 
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-black text-gray-900">{displayName}</h2>
                <button onClick={() => navigate('/settings')}><Settings className="w-6 h-6 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{profile?.bio || "세상을 탐험하는 중 📍"}</p>
              <div className="flex gap-6">
                <div className="text-center"><p className="font-bold">{myPosts.length}</p><p className="text-[10px] text-gray-400 font-black">POSTS</p></div>
                <div className="text-center"><p className="font-bold">1.2k</p><p className="text-[10px] text-gray-400 font-black">FOLLOWERS</p></div>
                <div className="text-center"><p className="font-bold">850</p><p className="text-[10px] text-gray-400 font-black">FOLLOWING</p></div>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setIsEditOpen(true)} 
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8"
          >
            프로필 편집
          </Button>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-100 mb-4">
            <button 
              onClick={() => setViewMode('grid')} 
              className={cn("flex-1 py-3 flex justify-center", viewMode !== 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}
            >
              <Grid className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setViewMode('saved')} 
              className={cn("flex-1 py-3 flex justify-center", viewMode === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}
            >
              <Bookmark className="w-6 h-6" />
            </button>
          </div>

          {/* 콘텐츠 렌더링 */}
          <div className="flex flex-col">
            {viewMode === 'saved' ? (
              savedPosts.map(post => <PostItem key={post.id} {...post} />)
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-3 gap-1">
                    {myPosts.map(post => (
                      <div 
                        key={post.id} 
                        className="aspect-square bg-gray-100 overflow-hidden cursor-pointer" 
                        onClick={handleGridItemClick}
                      >
                        <img src={post.image} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                  </div>
                ) : (
                  myPosts.map(post => <PostItem key={post.id} {...post} />)
                )}
                {dataLoaded && myPosts.length === 0 && (
                  <div className="text-center py-20 text-gray-400 font-medium">작성된 게시글이 없습니다.</div>
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