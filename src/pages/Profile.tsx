"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  // 1. useAuth에서 필요한 것만 가져오되, 객체 통째로 의존성에 넣지 않음
  const { profile, user, loading: authLoading, refreshProfile } = useAuth();
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // 2. 데이터 로드 완료 여부 (성공/실패 상관없이 '시도'했는지)
  const [dataLoaded, setDataLoaded] = useState(false);
  const fetchLock = useRef(false);

  // 3. 의존성 전염을 막기 위해 원시값으로 고정
  const userId = user?.id;
  const profileName = profile?.nickname || user?.email?.split('@')[0] || '탐험가';
  const profileAvatar = profile?.avatar_url || `https://i.pravatar.cc/150?u=${userId}`;

  // 4. 데이터 로드 로직
  const loadContent = useCallback(async (uid: string) => {
    if (fetchLock.current) return;
    fetchLock.current = true;

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const posts = (data || []).map(p => ({
        id: p.id,
        user: { id: p.user_id, name: p.user_name || profileName, avatar: p.user_avatar || profileAvatar },
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

      setMyPosts(posts);
      setSavedPosts(createMockPosts(37.5665, 126.9780, 8, `saved_${uid}`).map(p => ({ ...p, isLiked: true })));
    } catch (err) {
      console.error('Data loading failed:', err);
    } finally {
      setDataLoaded(true);
      fetchLock.current = false;
    }
  }, [profileName, profileAvatar]);

  // 5. [중요] 실행 트리거 분리
  useEffect(() => {
    // 세션 로딩 중일 때는 아무것도 하지 않음 (루프 방지 핵심)
    if (authLoading) return;

    // 로딩 끝났는데 유저 없으면 로그인 이동
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    // 유저 있고 아직 데이터 로드 전이면 실행
    if (!dataLoaded) {
      loadContent(userId);
    }
  }, [authLoading, userId, dataLoaded, loadContent, navigate]);

  // --- 렌더링 가드 ---
  // 리프레시 시 authLoading이 true인 동안은 '아무런 로직'도 실행하지 않고 스피너만 보여줌
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 유저가 없는 상태에서 렌더링되는 것을 방지
  if (!userId) return null;

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px]">
        {/* 프로필 헤더 */}
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <UserIcon className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">{profileName}</h2>
              <p className="text-xs text-gray-400 font-medium">나의 여행 기록</p>
            </div>
          </div>
          <button onClick={() => navigate('/settings')} className="p-2"><Settings className="w-6 h-6 text-gray-400" /></button>
        </div>

        <div className="p-6">
          {/* 프로필 정보 */}
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img src={profileAvatar} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{profileName}</h2>
              <p className="text-sm text-gray-500 mb-4">{profile?.bio || "세상을 탐험하는 중 📍"}</p>
              <div className="flex gap-4">
                <div className="text-center"><p className="font-bold">{myPosts.length}</p><p className="text-[10px] text-gray-400 uppercase font-black">Posts</p></div>
                <div className="text-center"><p className="font-bold">1.2k</p><p className="text-[10px] text-gray-400 uppercase font-black">Followers</p></div>
                <div className="text-center"><p className="font-bold">850</p><p className="text-[10px] text-gray-400 uppercase font-black">Following</p></div>
              </div>
            </div>
          </div>

          <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">프로필 편집</Button>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-100 mb-4">
            <button onClick={() => setViewMode('grid')} className={cn("flex-1 py-3 flex justify-center", (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Grid className="w-6 h-6" /></button>
            <button onClick={() => setViewMode('saved')} className={cn("flex-1 py-3 flex justify-center", viewMode === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Bookmark className="w-6 h-6" /></button>
          </div>

          {/* 게시물 그리드 */}
          <div className="grid grid-cols-3 gap-1">
            {myPosts.map(post => (
              <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden" onClick={() => setViewMode('list')}>
                <img src={post.image} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
          {dataLoaded && myPosts.length === 0 && (
            <div className="text-center py-20 text-gray-400 font-medium">등록된 포스팅이 없습니다.</div>
          )}
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;