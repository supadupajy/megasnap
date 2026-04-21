"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, UserPlus, Check, Loader2, Users, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WritePost from '@/components/WritePost';
import SearchAdBanner from '@/components/SearchAdBanner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { searchProfilesByNickname } from '@/utils/profile-search';
import { showError, showSuccess } from '@/utils/toast';

const Search = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  // 스크롤 시 상단 헤더 밀림 방지를 위한 핵심 로직
  useEffect(() => {
    // 1. 전체 body 스크롤을 막아 브라우저의 전체 페이지 밀림 현상 차단
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

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const fetchFollowingList = useCallback(async () => {
    if (!authUser) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', authUser.id);
    if (data) setFollowingIds(new Set(data.map(f => f.following_id)));
  }, [authUser]);

  const fetchRecommendedUsers = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      await fetchFollowingList();
      const { data, error } = await supabase.from('profiles').select('id, nickname, avatar_url, bio').neq('id', authUser.id).not('nickname', 'is', null).order('updated_at', { ascending: false }).limit(15);
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [authUser, fetchFollowingList]);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) { fetchRecommendedUsers(); return; }
    setIsLoading(true);
    try {
      await fetchFollowingList();
      const results = await searchProfilesByNickname(trimmed, authUser?.id, 20);
      setUsers(results);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [authUser, fetchRecommendedUsers, fetchFollowingList]);

  useEffect(() => {
    const timer = setTimeout(() => { handleSearch(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const toggleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    const isCurrentlyFollowing = followingIds.has(targetUserId);
    try {
      if (isCurrentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', targetUserId);
        setFollowingIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
        showSuccess('팔로우를 취소했습니다.');
      } else {
        await supabase.from('follows').insert({ follower_id: authUser.id, following_id: targetUserId });
        setFollowingIds(prev => new Set(prev).add(targetUserId));
        showSuccess('팔로우를 시작했습니다! ✨');
      }
    } catch (err) { showError('처리에 실패했습니다.'); }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* 1. 상단 헤더 공간 (88px) */}
      <div className="h-[88px] w-full bg-white shrink-0 z-50 border-b border-gray-100" />
      
      {/* 2. 고정 영역: 뒤로가기 + 검색창 + 광고 배너 */}
      <div className="shrink-0 bg-white z-40 border-b border-gray-50">
        <div className="px-4">
          <div className="relative py-4 flex items-center gap-3 bg-white">
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </button>
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
              <input 
                placeholder="닉네임으로 친구 찾기" 
                className="w-full pl-12 h-12 bg-white border-2 border-indigo-600 rounded-xl outline-none font-bold placeholder:text-gray-400 shadow-sm transition-all" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                </div>
              )}
            </div>
          </div>
          <div className="pb-0">
            <SearchAdBanner />
          </div>
        </div>
      </div>
      
      {/* 3. 실제 스크롤이 일어나는 추천 리스트 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        <div className="px-4 pb-32 pt-0">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 pt-4">
              {searchQuery ? '검색 결과' : '추천 사용자'}
            </p>
            <div className="space-y-1">
              {users.map((user) => {
                const isFollowing = followingIds.has(user.id);
                return (
                  <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all">
                    <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0"><Avatar className="w-14 h-14 border-2 border-white shadow-sm"><AvatarImage src={user.avatar_url} /><AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0] || '?'}</AvatarFallback></Avatar></div>
                    <div className="flex-1 min-w-0"><div className="flex items-center gap-1"><span className="font-bold text-gray-900 truncate">{user.nickname || '사용자'}</span><span className="text-[10px] text-gray-400">@{user.id.substring(0, 8)}</span></div><p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p></div>
                    <Button variant={isFollowing ? "secondary" : "default"} size="sm" onClick={(e) => toggleFollow(e, user.id)} className={isFollowing ? "rounded-xl h-8 px-3 bg-gray-100 text-gray-900 hover:bg-gray-200 font-bold" : "rounded-xl h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"}>{isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}</Button>
                  </div>
                );
              })}
              {!isLoading && users.length === 0 && (<div className="py-20 flex flex-col items-center justify-center text-center px-10"><div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-200" /></div><p className="text-sm text-gray-400 font-bold leading-relaxed">{searchQuery ? '해당 닉네임을 가진 사용자가 없습니다.' : '추천할 사용자가 없습니다.'}</p></div>)}
            </div>
          </div>
        </div>
      </div>
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Search;