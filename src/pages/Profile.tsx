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
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  
  // 1. 데이터 로딩의 '단계'를 명확히 정의
  const [dataState, setDataState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // 중복 호출 방지를 위한 Ref
  const isFetching = useRef(false);

  const userId = authUser?.id;
  const userEmail = authUser?.email;
  const profileNickname = profile?.nickname;
  const profileAvatar = profile?.avatar_url;

  const displayName = useMemo(() => profileNickname || userEmail?.split('@')[0] || '탐험가', [profileNickname, userEmail]);
  const bio = profile?.bio || "지도를 여행하는 탐험가 📍";

  // 2. 데이터 로드 함수
  const loadData = useCallback(async (targetId: string) => {
    if (isFetching.current) return;
    
    isFetching.current = true;
    setDataState('loading');
    
    try {
      const { data: realData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const realPosts = (realData || []).map(p => ({
        id: p.id,
        user: {
          id: p.user_id,
          name: p.user_name || displayName,
          avatar: p.user_avatar || profileAvatar || `https://i.pravatar.cc/150?u=${p.user_id}`
        },
        content: p.content || '',
        location: p.location_name || '알 수 없는 장소',
        image: p.image_url,
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

      setMyPosts(realPosts);
      
      const saved = createMockPosts(37.5665, 126.9780, 8, `saved_${targetId}`)
        .map(p => ({ ...p, isLiked: true }));
      setSavedPosts(saved);
      
      setDataState('success');
    } catch (err) {
      console.error('[Profile] Fetch Error:', err);
      setDataState('error');
    } finally {
      isFetching.current = false;
    }
  }, [displayName, profileAvatar]);

  // 3. 인증 및 데이터 로드 통합 트리거
  useEffect(() => {
    // 세션 로딩 중이면 대기
    if (authLoading) return;

    // 세션 로딩 끝났는데 유저 없으면 로그인행
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    // 유저 있고, 아직 데이터 로드를 시작하지 않았거나 에러 상태일 때만 로드
    if (dataState === 'idle') {
      loadData(userId);
    }
  }, [authLoading, userId, dataState, loadData, navigate]);

  // 핸들러 함수들
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

  const handleImageError = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
    setSavedPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleGridItemClick = (postId: string) => {
    setViewMode(viewMode === 'gifs' ? 'gif-list' : 'list');
    setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // --- 핵심: 로딩 UI 조건 단순화 ---
  // authLoading이거나, 데이터 로딩 중인데 아직 데이터가 없을 때만 스피너 표시
  if (authLoading || (dataState === 'loading' && myPosts.length === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 데이터 로딩 시도 후 유저가 없는 경우는 null (로그인 페이지로 이동 중)
  if (!userId) return null;

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        {/* 프로필 정보 영역 */}
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
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                <img 
                  src={profileAvatar || `https://i.pravatar.cc/150?u=${userId}`} 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white" 
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} 
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
                <div className="text-center"><p className="font-bold text-gray-900">1.2k</p><p className="text-[10px] text-gray-400 uppercase font-black">Followers</p></div>
                <div className="text-center"><p className="font-bold text-gray-900">850</p><p className="text-[10px] text-gray-400 uppercase font-black">Following</p></div>
              </div>
            </div>
          </div>

          <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">프로필 편집</Button>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-100 mb-4">
            <button onClick={() => setViewMode('grid')} className={cn("flex-1 py-3 flex justify-center transition-all", (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600" : "text-gray-300")}><Grid className={cn("w-6 h-6", (viewMode === 'grid' || viewMode === 'list') ? "text-indigo-600" : "")} /></button>
            <button onClick={() => setViewMode('gifs')} className={cn("flex-1 py-3 flex justify-center transition-all", (viewMode === 'gifs' || viewMode === 'gif-list') ? "border-b-2 border-indigo-600" : "text-gray-300")}><Play className={cn("w-6 h-6", (viewMode === 'gifs' || viewMode === 'gif-list') ? "text-indigo-600" : "")} /></button>
            <button onClick={() => setViewMode('saved')} className={cn("flex-1 py-3 flex justify-center transition-all", viewMode === 'saved' ? "border-b-2 border-indigo-600" : "text-gray-300")}><Bookmark className={cn("w-6 h-6", viewMode === 'saved' ? "text-indigo-600" : "")} /></button>
          </div>

          {/* 컨텐츠 리스트 */}
          <div className="flex flex-col -mx-6">
            {viewMode === 'saved' ? (
              <>
                <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4">
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2"><Bookmark className="w-4 h-4 fill-indigo-600" />저장된 포스팅</h3>
                </div>
                {savedPosts.map((post) => (
                  <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                    <PostItem {...post} disablePulse={true} onLikeToggle={() => handleLikeToggle(post.id, true)} onImageError={() => handleImageError(post.id)} />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div onClick={() => navigate('/', { state: { filterUserId: 'me' } })} className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors">
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2"><Map className="w-4 h-4 fill-indigo-600" />지도에서 보기</h3>
                </div>
                {(viewMode === 'list' || viewMode === 'gif-list') ? (
                  <div className="flex flex-col">
                    {(viewMode === 'gif-list' ? myPosts.filter(p => p.isGif) : myPosts).map((post) => (
                      <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                        <PostItem {...post} disablePulse={true} onLikeToggle={() => handleLikeToggle(post.id, false)} onDelete={handlePostDelete} onImageError={() => handleImageError(post.id)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 px-6">
                    {myPosts.map((post) => (
                      <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group" onClick={() => handleGridItemClick(post.id)}>
                        <img src={post.image} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer" onError={() => handleImageError(post.id)} />
                      </div>
                    ))}
                    {dataState === 'success' && myPosts.length === 0 && (
                      <div className="col-span-3 py-20 text-center text-gray-400 font-medium">아직 등록된 포스팅이 없습니다.</div>
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
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;