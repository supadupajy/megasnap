"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search as SearchIcon, X, UserPlus, Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { searchProfilesByNickname } from '@/utils/profile-search';
import { showError, showSuccess } from '@/utils/toast';

interface UserProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const UserSkeleton = () => (
  <div className="flex items-center gap-3 p-2">
    <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-40" />
    </div>
    <Skeleton className="w-8 h-8 rounded-xl" />
  </div>
);

const FriendSearchOverlay = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const followingIdsRef = useRef<Set<string>>(new Set());
  const debounceInitRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const dataLoadedRef = useRef(false);

  // 초기 로드: 팔로잉 목록 + 추천 유저
  const loadInitial = useCallback(async () => {
    if (!authUser || dataLoadedRef.current) return;
    setIsLoading(true);

    try {
      const [followsRes, profilesRes] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', authUser.id),
        supabase
          .from('profiles')
          .select('id, nickname, avatar_url, bio')
          .neq('id', authUser.id)
          .not('nickname', 'is', null)
          .order('nickname', { ascending: true })
          .limit(50),
      ]);
      const ids = new Set((followsRes.data || []).map((f: any) => f.following_id));
      followingIdsRef.current = ids;
      setFollowingIds(ids);
      setUsers(profilesRes.data || []);
      dataLoadedRef.current = true;
    } catch (err) {
      console.error('[FriendSearchOverlay] init error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (!authUser) return;
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, bio')
          .neq('id', authUser.id)
          .not('nickname', 'is', null)
          .order('nickname', { ascending: true })
          .limit(50);
        setUsers(data || []);
      } finally {
        setIsSearching(false);
      }
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchProfilesByNickname(trimmed, authUser?.id, 20);
      setUsers(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [authUser?.id]);

  // open/close 이벤트
  useEffect(() => {
    const handleOpen = () => {
      (window as any).__isFriendSearchOpen = true;
      setIsOpen(true);
      loadInitial();
    };
    const handleClose = () => {
      (window as any).__isFriendSearchOpen = false;
      setIsOpen(false);
    };
    window.addEventListener('open-friend-search', handleOpen);
    window.addEventListener('close-friend-search', handleClose);
    window.addEventListener('close-friend-search-by-back', handleClose);
    return () => {
      window.removeEventListener('open-friend-search', handleOpen);
      window.removeEventListener('close-friend-search', handleClose);
      window.removeEventListener('close-friend-search-by-back', handleClose);
    };
  }, [loadInitial]);

  // mount/unmount 애니메이션
  useEffect(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    if (shouldRender) {
      setIsClosing(true);
      closeTimeoutRef.current = window.setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        closeTimeoutRef.current = null;
      }, 220);
    }
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, shouldRender]);

  // 디바운스 검색
  useEffect(() => {
    if (!isOpen) return;
    if (!debounceInitRef.current) {
      debounceInitRef.current = true;
      return;
    }
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, isOpen]);

  useEffect(() => {
    if (!isOpen) debounceInitRef.current = false;
  }, [isOpen]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const close = useCallback((e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    window.dispatchEvent(new CustomEvent('close-friend-search'));
  }, []);

  const stopSheetEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const toggleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    const isCurrentlyFollowing = followingIdsRef.current.has(targetUserId);
    const next = new Set(followingIdsRef.current);
    if (isCurrentlyFollowing) next.delete(targetUserId);
    else next.add(targetUserId);
    followingIdsRef.current = next;
    setFollowingIds(new Set(next));

    try {
      if (isCurrentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', targetUserId);
        showSuccess('팔로우를 취소했습니다.');
      } else {
        await supabase.from('follows').insert({ follower_id: authUser.id, following_id: targetUserId });
        showSuccess('팔로우를 시작했습니다! ✨');
      }
    } catch (err) {
      setFollowingIds(prev => {
        const rollback = new Set(prev);
        if (isCurrentlyFollowing) rollback.add(targetUserId);
        else rollback.delete(targetUserId);
        followingIdsRef.current = rollback;
        return rollback;
      });
      showError('처리에 실패했습니다.');
    }
  };

  const handleUserClick = (userId: string) => {
    close();
    setTimeout(() => navigate(`/user-profile/${userId}`), 250);
  };

  if (!shouldRender) return null;
  if (typeof document === 'undefined') return null;

  const sheetTopPx = 40;

  return createPortal(
    <div
      className="fixed inset-0 z-[30000] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="친구 검색"
    >
      {/* 백드롭 */}
      <button
        type="button"
        className={`absolute inset-0 z-0 cursor-default bg-slate-950/60 pointer-events-auto ${
          isClosing ? 'comment-backdrop-exit' : 'comment-backdrop-enter'
        }`}
        onPointerDown={close}
        onClick={close}
        aria-label="검색 닫기 배경"
      />

      {/* 시트 본체 */}
      <section
        className={`fixed left-1/2 z-[1] flex w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-white/80 bg-white shadow-[0_-18px_60px_rgba(79,70,229,0.20)] pointer-events-auto sm:rounded-[32px] ${
          isClosing ? 'comment-sheet-exit' : 'comment-sheet-enter'
        }`}
        style={{
          top: `${sheetTopPx}px`,
          bottom: '0px',
        }}
        onClick={stopSheetEvent}
      >
        {/* 상단 핸들 */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-950">친구 검색</p>
              <p className="text-sm font-bold text-slate-400">
                {searchQuery.trim()
                  ? `${users.length.toLocaleString()}명의 결과`
                  : '닉네임으로 찾아보세요'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={close}
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition active:scale-95"
            aria-label="검색 닫기"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 검색 입력 영역 */}
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 z-10" />
            <input
              placeholder="닉네임으로 친구 찾기"
              className="w-full pl-12 pr-12 h-12 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none text-sm font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-inner transition-all focus:border-indigo-300 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus={!searchQuery}
            />
            {isSearching ? (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition active:scale-90"
                aria-label="검색어 지우기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* 결과 영역 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
          <div className="px-4 py-2" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="space-y-1">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <UserSkeleton key={i} />)
              ) : users.length > 0 ? (
                users.map((user) => {
                  const isFollowing = followingIds.has(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserClick(user.id)}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
                        <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-900 truncate">{user.nickname || '사용자'}</span>
                          <span className="text-[10px] text-gray-400">@{user.id.substring(0, 8)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p>
                      </div>
                      <Button
                        variant={isFollowing ? "secondary" : "default"}
                        size="sm"
                        onClick={(e) => toggleFollow(e, user.id)}
                        className={isFollowing
                          ? "rounded-xl h-8 px-3 bg-gray-100 text-gray-900 hover:bg-gray-200 font-bold"
                          : "rounded-xl h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"}
                      >
                        {isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400 font-bold leading-relaxed">
                    {searchQuery ? '해당 닉네임을 가진 사용자가 없습니다.' : '추천할 사용자가 없습니다.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default FriendSearchOverlay;
