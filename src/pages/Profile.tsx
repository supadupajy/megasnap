"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Settings, Grid, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
// ... 필요한 다른 import들

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, profile } = useAuth();
  
  const [myPosts, setMyPosts] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // 1. [핵심] 리렌더링과 상관없이 실행 여부를 기억하는 물리적 잠금장치
  const hasInitialized = useRef(false);

  const loadData = useCallback(async (userId: string) => {
    // 이미 실행 중이거나 완료되었다면 즉시 차단
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    console.log("🚀 [Profile] 데이터 로드 시도:", userId);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("📦 [Profile] 수신 데이터:", data?.length || 0, "건");
      setMyPosts(data || []);
    } catch (err) {
      console.error("❌ [Profile] 로드 실패:", err);
    } finally {
      setDataLoaded(true);
    }
  }, []);

  // 2. 실행 트리거 - 오직 user.id가 존재하고 authLoading이 끝났을 때만
  useEffect(() => {
    if (!authLoading) {
      if (user?.id) {
        loadData(user.id);
      } else {
        // 인증이 안 된 경우에만 로그인으로 보냄
        navigate('/login', { replace: true });
      }
    }
  }, [authLoading, user?.id, loadData, navigate]);

  // 3. UI 렌더링 가드
  if (authLoading || (!dataLoaded && !hasInitialized.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-gray-400">데이터를 불러오고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* 실제 프로필 UI 내용 */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">{profile?.nickname || "나의 프로필"}</h1>
        {/* 게시물 목록 렌더링 */}
        <div className="grid grid-cols-3 gap-1 mt-6">
          {myPosts.map((post: any) => (
            <div key={post.id} className="aspect-square bg-gray-100">
               <img src={post.image_url} className="w-full h-full object-cover" alt="" />
            </div>
          ))}
        </div>
        {dataLoaded && myPosts.length === 0 && (
          <p className="text-center py-20 text-gray-400">게시물이 없습니다.</p>
        )}
      </div>
    </div>
  );
};

export default Profile;