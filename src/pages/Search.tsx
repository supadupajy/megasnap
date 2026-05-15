"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, UserPlus, Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { searchProfilesByNickname } from '@/utils/profile-search';
import { showError, showSuccess } from '@/utils/toast';

// 유저 카드 스켈레톤
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

const Search = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // followingIds를 ref로도 관리해 검색 시 재조회 불필요
  const followingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // ✅ 초기 로드: 팔로잉 목록 + 추천 유저를 병렬로 한 번에 가져옴
  useEffect(() => {
    if (!authUser) return;
    setIsLoading(true);

    Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', authUser.id),
      supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio')
        .neq('id', authUser.id)
        .not('nickname', 'is', null)
        .order('nickname', { ascending: true })
        .limit(50),
    ]).then(([followsRes, profilesRes]) => {
      const ids = new Set((followsRes.data || []).map((f: any) => f.following_id));
      followingIdsRef.current = ids;
      setFollowingIds(ids);
      setUsers(profilesRes.data || []);
      setIsLoading(false);
    }).catch(err => {
      console.error('[Search] init error:', err);
      setIsLoading(false);
    });
  }, [authUser?.id]);

  // ✅ 검색: 팔로잉 목록 재조회 없이 캐시된 값 사용
  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      // 검색어 지우면 추천 유저 다시 표시 (이미 로드된 데이터 재사용)
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

  // 디바운스 검색
  useEffect(() => {
    if (isLoading) return; // 초기 로딩 중엔 검색 트리거 안 함
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, isLoading]);

  const toggleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    const isCurrentlyFollowing = followingIdsRef.current.has(targetUserId);
    // 낙관적 업데이트
    const next = new Set(followingIdsRef.current);
    if (isCurrentlyFollowing) {
      next.delete(targetUserId);
    } else {
      next.add(targetUserId);
    }
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
      // 실패 시 롤백
      followingIdsRef.current = followingIdsRef.current;
      setFollowingIds(prev => {
        const rollback = new Set(prev);
        if (isCurrentlyFollowing) rollback.add(targetUserId);
        else rollback.delete(targetUserId);
        return rollback;
      });
      showError('처리에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* 검색 입력창 - 헤더 바로 아래 */}
      <div className="shrink-0 bg-white z-[90] pt-[calc(env(safe-area-inset-top,0px)+64px)]">
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="닉네임으로 친구 찾기"
              className="w-full pl-12 pr-12 h-12 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none text-sm font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-inner transition-all focus:border-indigo-300 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 유저 리스트 */}
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        <div className="px-4" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="space-y-1 pt-2">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <UserSkeleton key={i} />)
            ) : users.length > 0 ? (
              users.map((user) => {
                const isFollowing = followingIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => navigate(`/user-profile/${user.id}`)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <div
                      className="p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0"
                      onClick={(e) => { e.stopPropagation(); navigate(`/user-profile/${user.id}`); }}
                    >
                      <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                        <AvatarImage src={user.avatar_url} />
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
    </div>
  );
};

export default Search;