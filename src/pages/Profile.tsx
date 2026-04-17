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

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();
  
  // 상태 관리
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false); // 데이터 로드 완료 여부

  // 1. 컴포넌트 생명주기 동안 유지되는 Ref
  const hasFetched = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 2. 값 고정 (의존성 최소화)
  const userId = authUser?.id;
  const displayName = profile?.nickname || authUser?.email?.split('@')[0] || '탐험가';
  const avatarUrl = profile?.avatar_url || `https://i.pravatar.cc/150?u=${userId}`;

  // 3. 데이터 로드 함수
  const loadProfileData = useCallback(async (uid: string) => {
    // 이미 가져오는 중이면 중단
    if (hasFetched.current) return;
    hasFetched.current = true;

    // 이전 요청이 있다면 취소
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(p => ({
        id: p.id,
        user: { id: p.user_id, name: p.user_name || displayName, avatar: p.user_avatar || avatarUrl },
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

      setMyPosts(formatted);
      setSavedPosts(createMockPosts(37.5665, 126.9780, 8, `saved_${uid}`).map(p => ({ ...p, isLiked: true })));
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Fetch error:', err);
    } finally {
      setIsLoaded(true);
    }
  }, [displayName, avatarUrl]);

  // 4. 실행 트리거 (가장 안전한 방식)
  useEffect(() => {
    // 1단계: 인증 정보 로딩 중이면 아무것도 하지 않음
    if (authLoading) return;

    // 2단계: 인증 정보 로딩이 끝났는데 유저가 없으면 로그인 페이지로
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    // 3단계: 유저가 있고 아직 데이터를 가져오지 않았다면 실행
    if (!isLoaded && !hasFetched.current) {
      loadProfileData(userId);
    }

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [authLoading, userId, isLoaded, loadProfileData, navigate]);

  // --- UI 로직 (이전과 동일) ---
  if (authLoading || (!isLoaded && userId)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        {/* 프로필 상단부 */}
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
              <UserIcon className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">내 프로필</h2>
              <p className="text-xs text-gray-400 font-medium">활동 기록</p>
            </div>
          </div>
          <button onClick={() => navigate('/settings')} className="p-2"><Settings className="w-6 h-6 text-gray-400" /></button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img src={avatarUrl} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{displayName}</h2>
              <p className="text-sm text-gray-500 mb-4">{profile?.bio || "탐험가 📍"}</p>
              <div className="flex gap-4 text-center">
                <div><p className="font-bold">{myPosts.length}</p><p className="text-[10px] text-gray-400">Posts</p></div>
                <div><p className="font-bold">1.2k</p><p className="text-[10px] text-gray-400">Followers</p></div>
                <div><p className="font-bold">850</p><p className="text-[10px] text-gray-400">Following</p></div>
              </div>
            </div>
          </div>

          <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 text-gray-900 mb-8">프로필 편집</Button>

          {/* 탭 & 포스트 영역 생략 (동일) */}
          <div className="grid grid-cols-3 gap-1">
            {myPosts.map(post => (
              <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden rounded-sm" onClick={() => setViewMode('list')}>
                <img src={post.image} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
          {myPosts.length === 0 && <div className="text-center py-20 text-gray-400">포스팅이 없습니다.</div>}
        </div>
      </div>
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;