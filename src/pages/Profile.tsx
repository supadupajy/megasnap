"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, Grid, Bookmark, User as UserIcon, Play, Map, Loader2 } from 'lucide-react';
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

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();
  
  // 상태 관리
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // 데이터 로딩 상태
  const [dataStatus, setDataStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // 무한 호출 방지 Lock
  const fetchLock = useRef(false);

  // 의존성 최적화를 위한 원시값 추출
  const userId = authUser?.id;
  const userEmail = authUser?.email;
  const profileNickname = profile?.nickname;
  const profileAvatar = profile?.avatar_url;

  const displayName = useMemo(() => profileNickname || userEmail?.split('@')[0] || '탐험가', [profileNickname, userEmail]);
  const bio = profile?.bio || "지도를 여행하는 탐험가 📍";

  // 1. 데이터 로드 함수 (Supabase 연동)
  const loadProfileData = useCallback(async (targetUid: string) => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    setDataStatus('loading');

    console.log("🔍 [Profile] 데이터 로딩 시작:", targetUid);

    try {
      // posts 테이블에서 현재 유저의 게시글 조회
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("❌ [Supabase] 데이터 조회 에러:", error.message);
        throw error;
      }

      console.log("📦 [Supabase] 수신 데이터:", data);

      const formattedPosts = (data || []).map(p => ({
        id: p.id,
        user: {
          id: p.user_id,
          name: p.user_name || displayName,
          avatar: p.user_avatar || profileAvatar || `https://i.pravatar.cc/150?u=${p.user_id}`
        },
        content: p.content || '',
        location: p.location_name || '알 수 없는 장소',
        lat: p.latitude,
        lng: p.longitude,
        likes: Number(p.likes || 0),
        commentsCount: 0,
        comments: [],
        image: p.image_url || FALLBACK_IMAGE, // DB 컬럼명이 image_url인지 확인 필수
        isLiked: false,
        createdAt: new Date(p.created_at),
        isAd: false,
        isGif: p.is_gif || false,
        isInfluencer: false,
        borderType: 'none'
      })) as Post[];

      setMyPosts(formattedPosts);
      
      // 저장된 포스트 (Mock 데이터)
      const saved = createMockPosts(37.5665, 126.9780, 8, `saved_${targetUid}`)
        .map(p => ({ ...p, isLiked: true }));
      setSavedPosts(saved);

      setDataStatus('success');
    } catch (err) {
      console.error('🔥 [Profile] 최종 에러:', err);
      setDataStatus('error');
    } finally {
      fetchLock.current = false;
    }
  }, [displayName, profileAvatar]);

  // 2. 인증 및 실행 트리거 (useEffect)
  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    // 아직 데이터를 가져오지 않은 초기 상태일 때만 실행
    if (dataStatus === 'idle') {
      loadProfileData(userId);
    }
  }, [authLoading, userId, dataStatus, loadProfileData, navigate]);

  // 3. 이벤트 핸들러
  const handleLikeToggle = useCallback((postId: string, isSaved: boolean) => {
    const setter = isSaved ? setSavedPosts : setMyPosts;
    setter(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleGridItemClick = (postId: string) => {
    setViewMode(viewMode === 'gifs' ? 'gif-list' : 'list');
    setTimeout(() => {
      document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 4. 로딩 UI
  if (authLoading || (dataStatus === 'loading' && myPosts.length === 0)) {
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
        {/* 프로필 타이틀 섹션 */}
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                <UserIcon className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">내 프로필</h2>
                <p className="text-xs text-gray-400 font-medium">나의 활동과 기록</p>
              </div>
            </div>
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* 유저 정보 카드 */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                <img 
                  src={profileAvatar || `https://i.pravatar.cc/150?u=${userId}`} 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white" 
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
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8 shadow-sm transition-all active:scale-[0.98]"
          >
            프로필 편집
          </Button>

          {/* 뷰 모드 탭 */}
          <div className="flex border-b border-gray-100 mb-4">
            <button 
              onClick={() => setViewMode('grid')} 
              className={cn("flex-1 py-3 flex justify-center transition-all", (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}
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

          {/* 콘텐츠 영역 */}
          <div className="flex flex-col -mx-6">
            {viewMode === 'saved' ? (
              <div className="px-6">
                {savedPosts.map((post) => (
                  <PostItem key={post.id} {...post} onLikeToggle={() => handleLikeToggle(post.id, true)} />
                ))}
              </div>
            ) : (
              <>
                {(viewMode === 'list') ? (
                  <div className="flex flex-col">
                    {myPosts.map((post) => (
                      <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                        <PostItem 
                          {...post} 
                          onLikeToggle={() => handleLikeToggle(post.id, false)} 
                          onDelete={handlePostDelete} 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 px-6">
                    {myPosts.map((post) => (
                      <div 
                        key={post.id} 
                        className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
                        onClick={() => handleGridItemClick(post.id)}
                      >
                        <img src={post.image} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                      </div>
                    ))}
                    {dataStatus === 'success' && myPosts.length === 0 && (
                      <div className="col-span-3 py-20 text-center text-gray-400 font-medium">
                        아직 등록된 포스팅이 없습니다.
                      </div>
                    )}
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