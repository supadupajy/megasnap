"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, Grid, Bookmark, User as UserIcon, Play, Map, Loader2 } from 'lucide-react';
// ... (기타 import 동일)

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();
  
  // [추가] 데이터 로드 중복 실행 방지를 위한 Ref
  const isFetching = useRef(false);
  const lastFetchedId = useRef<string | null>(null);

  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isDataLoading, setIsDataLoading] = useState(false);

  // 값 추출
  const userId = authUser?.id;
  const userEmail = authUser?.email;
  const profileNickname = profile?.nickname;
  const profileAvatar = profile?.avatar_url;

  const displayName = useMemo(() => profileNickname || userEmail?.split('@')[0] || '탐험가', [profileNickname, userEmail]);

  // 1. 인증 체크 (강제 이동)
  useEffect(() => {
    if (!authLoading && !userId) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, userId, navigate]);

  // 2. 데이터 로드 함수 (최대한 단순화)
  const loadData = useCallback(async (targetId: string) => {
    // 이미 로딩 중이거나 같은 ID를 이미 불러왔다면 중복 실행 방지
    if (isFetching.current) return;
    
    isFetching.current = true;
    setIsDataLoading(true);
    
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
        createdAt: new Date(p.created_at),
        // ... (기타 필요한 필드)
      })) as Post[];

      setMyPosts(realPosts);
      lastFetchedId.current = targetId; // 성공적으로 가져온 ID 저장

      const saved = createMockPosts(37.5665, 126.9780, 8, `saved_${targetId}`)
        .map(p => ({ ...p, isLiked: true }));
      setSavedPosts(saved);
    } catch (err) {
      console.error('[Profile] Fetch Error:', err);
    } finally {
      setIsDataLoading(false);
      isFetching.current = false;
    }
  }, [displayName, profileAvatar]); // profileAvatar와 displayName만 관찰

  // 3. 실행 트리거 - 오직 userId와 authLoading의 확정 상태만 관찰
  useEffect(() => {
    if (!authLoading && userId) {
      // 이미 해당 유저의 데이터를 성공적으로 가져왔다면 다시 부르지 않음
      if (lastFetchedId.current !== userId) {
        loadData(userId);
      }
    }
  }, [authLoading, userId, loadData]);

  // ... (이하 렌더링 로직 동일)