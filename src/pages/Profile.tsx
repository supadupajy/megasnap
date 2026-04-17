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

// 컴포넌트 외부 변수로 선언하여 리렌더링 시에도 초기화되지 않도록 방어
let globalFetchLock = false;

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading, refreshProfile } = useAuth();
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // 데이터 로드 완료 여부 (성공/실패 상관없이 시도했음을 기록)
  const [isInitDone, setIsInitDone] = useState(false);

  // 의존성 전염을 방지하기 위한 문자열 ID 추출
  const uid = user?.id;

  // 데이터 로드 로직
  const loadProfileContent = useCallback(async (targetUid: string) => {
    if (globalFetchLock) return;
    globalFetchLock = true;

    try {
      console.log("📡 [Profile] Supabase 호출 시작...");
      
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped = data.map(p => ({
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
        setMyPosts(mapped);
      }
      
      setSavedPosts(createMockPosts(37.5665, 126.9780, 5, `saved_${targetUid}`).map(p => ({ ...p, isLiked: true })));
      
    } catch (err) {
      console.error("❌ [Profile] 데이터 로드 실패:", err);
    } finally {
      setIsInitDone(true); // 데이터 로드 시도 완료 (성공/실패 무관하게 루프 종료)
      globalFetchLock = false;
    }
  }, [profile?.nickname, profile?.avatar_url, user?.email]); 

  // 핵심 트리거: uid가 확정되는 순간 딱 한 번만 실행
  useEffect(() => {
    // 1. 인증 정보 로딩 중이면 가만히 대기
    if (authLoading) return;

    // 2. 인증 로딩 끝났는데 유저 없으면 로그인 페이지로 (대체)
    if (!uid) {
      console.log("🚫 [Profile] 유저 정보 없음. 로그인 이동.");
      navigate('/login', { replace: true });
      return;
    }

    // 3. 유저가 있고, 아직 로드를 안 했다면 로드 시작
    if (!isInitDone) {
      loadProfileContent(uid);
    }

    // 클린업 시 락 해제 (안전을 위해)
    return () => { globalFetchLock = false; };
  }, [authLoading, uid, isInitDone, loadProfileContent, navigate]);

  // --- 렌더링 가드 ---
  // 리fresh 시 authLoading이 true이면 무조건 스피너만 보여줌
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 데이터 로딩 시도조차 안 했으면(isInitDone: false) 화면을 그리지 않음
  if (!uid || !isInitDone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px] p-6">
        {/* 유저 정보 */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600 shadow-lg">
            <img 
              src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${uid}`} 
              className="w-full h-full rounded-full object-cover border-4 border-white" 
              alt="profile"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-gray-900">{profile?.nickname || user?.email?.split('@')[0]}</h2>
            <p className="text-sm text-gray-500 mb-2">{profile?.bio || "탐험을 시작해보세요 📍"}</p>
            <div className="flex gap-4">
               <div className="text-center"><p className="font-bold">{myPosts.length}</p><p className="text-[10px] text-gray-400">Posts</p></div>
               <div className="text-center"><p className="font-bold">1.2k</p><p className="text-[10px] text-gray-400">Followers</p></div>
               <div className="text-center"><p className="font-bold">850</p><p className="text-[10px] text-gray-400">Following</p></div>
            </div>
          </div>
        </div>

        <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">프로필 편집</Button>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-100 mb-4">
          <button onClick={() => setViewMode('grid')} className={cn("flex-1 py-3 flex justify-center", viewMode !== 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Grid className="w-6 h-6" /></button>
          <button onClick={() => setViewMode('saved')} className={cn("flex-1 py-3 flex justify-center", viewMode === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Bookmark className="w-6 h-6" /></button>
        </div>

        {/* 그리드 뷰 */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-3 gap-1">
            {myPosts.map(post => (
              <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden" onClick={() => setViewMode('list')}>
                <img src={post.image} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
        )}
        
        {/* 리스트 뷰 */}
        {viewMode === 'list' && myPosts.map(post => (
          <PostItem key={post.id} {...post} />
        ))}

        {/* 저장된 게시물 */}
        {viewMode === 'saved' && savedPosts.map(post => (
          <PostItem key={post.id} {...post} />
        ))}

        {isInitDone && myPosts.length === 0 && viewMode === 'grid' && (
          <div className="text-center py-20 text-gray-400 font-medium">아직 등록된 게시글이 없습니다.</div>
        )}
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;