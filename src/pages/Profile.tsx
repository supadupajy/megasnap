"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // 1. 데이터 로딩 상태를 '시도 횟수'로 관리 (0이면 미시도, 1이상이면 완료)
  const [loadCount, setLoadCount] = useState(0);
  const isFetching = useRef(false);

  // 2. 의존성 전염 방지를 위한 원시값 추출
  const uid = user?.id;

  // 3. 데이터 로드 함수 (의존성을 최소화하여 재생성 방지)
  const fetchUserData = useCallback(async (targetUid: string) => {
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      console.log("📡 Supabase 데이터 요청 중...");
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map(p => ({
          id: p.id,
          user: { 
            id: p.user_id, 
            name: profile?.nickname || user?.email?.split('@')[0] || '탐험가',
            avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${p.user_id}`
          },
          content: p.content || '',
          location: p.location_name || '알 수 없는 장소',
          image: p.image_url || p.image || '', 
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
      }
      
      setSavedPosts(createMockPosts(37.5665, 126.9780, 5, `saved_${targetUid}`).map(p => ({ ...p, isLiked: true })));
      
    } catch (err) {
      console.error("❌ 데이터 로드 실패:", err);
    } finally {
      setLoadCount(prev => prev + 1); // 로드 시도 완료 표시
      isFetching.current = false;
    }
  }, [uid]); // uid가 바뀔 때만 함수 재생성

  // 4. 실행 트리거 - 가장 보수적인 조건 사용
  useEffect(() => {
    // 인증 로딩 중이면 대기
    if (authLoading) return;

    // 인증 완료 후 유저 없으면 강제 이동
    if (!uid) {
      navigate('/login', { replace: true });
      return;
    }

    // 아직 데이터를 한 번도 불러오지 않았을 때만 실행
    if (loadCount === 0 && !isFetching.current) {
      fetchUserData(uid);
    }
  }, [authLoading, uid, loadCount, fetchUserData, navigate]);

  // --- 렌더링 조건 ---
  // 1. 인증 정보 확인 중이거나 2. 유저가 있는데 데이터 로드 시도조차 안 했을 때만 로딩바
  if (authLoading || (uid && loadCount === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!uid) return null;

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px] p-6">
        {/* 프로필 요약 */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
            <img 
              src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${uid}`} 
              className="w-full h-full rounded-full object-cover border-4 border-white" 
              alt="profile"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-gray-900">{profile?.nickname || user?.email?.split('@')[0]}</h2>
            <p className="text-sm text-gray-500">{profile?.bio || "나의 여행 기록 📍"}</p>
          </div>
          <button onClick={() => navigate('/settings')}><Settings className="w-6 h-6 text-gray-400" /></button>
        </div>

        <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 text-gray-900 mb-8">프로필 편집</Button>

        {/* 탭 메뉴 */}
        <div className="flex border-b border-gray-100 mb-4">
          <button onClick={() => setViewMode('grid')} className={cn("flex-1 py-3 flex justify-center", viewMode !== 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Grid className="w-6 h-6" /></button>
          <button onClick={() => setViewMode('saved')} className={cn("flex-1 py-3 flex justify-center", viewMode === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Bookmark className="w-6 h-6" /></button>
        </div>

        {/* 게시물 목록 */}
        <div className="grid grid-cols-3 gap-1">
          {viewMode === 'grid' && myPosts.map(post => (
            <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden" onClick={() => setViewMode('list')}>
              <img src={post.image} className="w-full h-full object-cover" alt="" />
            </div>
          ))}
        </div>
        
        {viewMode === 'list' && myPosts.map(post => (
          <PostItem key={post.id} {...post} />
        ))}

        {viewMode === 'saved' && savedPosts.map(post => (
          <PostItem key={post.id} {...post} />
        ))}

        {loadCount > 0 && myPosts.length === 0 && viewMode === 'grid' && (
          <div className="text-center py-20 text-gray-400">게시물이 없습니다.</div>
        )}
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;