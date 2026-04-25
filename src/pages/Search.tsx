"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, UserPlus, Check, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchAdBanner from '@/components/SearchAdBanner';
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

  // 스크롤 시 상단 헤더 밀림 방지를 위한 핵심 로직
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio')
        .neq('id', authUser.id)
        .not('nickname', 'is', null)
        .order('nickname', { ascending: true })
        .limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [authUser?.id, fetchFollowingList]);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) { fetchRecommendedUsers(); return; }
    setIsLoading(true);
    try {
      await fetchFollowingList();
      const results = await searchProfilesByNickname(trimmed, authUser?.id, 20);
      setUsers(results);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [authUser?.id, fetchRecommendedUsers, fetchFollowingList]);

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
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        {/* 안드로이드 상단 상태바 여백 */}
        <div className="h-[env(safe-area-inset-top,0px)] w-full" />
        
        <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none">친구 검색</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Find your friends</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        <div className="space-y-1">
          {users.map((user) => {
            const isFollowing = followingIds.has(user.id);
            return (
              <div key={user.id} onClick={() => navigate(`/user-profile/${user.id}`)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all">
                <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/user-profile/${user.id}`); }}>
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
                  className={isFollowing ? "rounded-xl h-8 px-3 bg-gray-100 text-gray-900 hover:bg-gray-200 font-bold" : "rounded-xl h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"}
                >
                  {isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </Button>
              </div>
            );
          })}
          {!isLoading && users.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center px-10">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-sm text-gray-400 font-bold leading-relaxed">{searchQuery ? '해당 닉네임을 가진 사용자가 없습니다.' : '추천할 사용자가 없습니다.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;