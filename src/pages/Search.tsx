"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, UserPlus, Check, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import SearchAdBanner from '@/components/SearchAdBanner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { searchProfilesByNickname } from '@/utils/profile-search';

const Search = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  // 초기 추천 사용자 (최근 가입순 또는 랜덤) 가져오기
  const fetchRecommendedUsers = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio')
        .neq('id', authUser.id) // 자기 자신 제외
        .not('nickname', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching recommended users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  // 검색 기능
  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      fetchRecommendedUsers();
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchProfilesByNickname(trimmed, authUser?.id, 20);
      setUsers(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, fetchRecommendedUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const toggleFollow = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    // 실제 팔로우 로직은 DB 연동이 필요하나, 현재는 UI 피드백만 유지
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, isFollowing: !user.isFollowing } : user
    ));
  };

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <Header />
      <div className="pt-[88px] px-4">
        <div className="relative py-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="닉네임으로 친구 찾기" 
              className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-indigo-600 font-bold"
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

        <SearchAdBanner />

        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            {searchQuery ? '검색 결과' : '추천 사용자'}
          </p>
          
          <div className="space-y-1">
            {users.map((user) => (
              <div 
                key={user.id} 
                onClick={() => navigate(`/profile/${user.id}`)} 
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
                  <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">
                      {user.nickname?.[0] || '?'}
                    </AvatarFallback>
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
                  variant={user.isFollowing ? "secondary" : "default"} 
                  size="sm" 
                  onClick={(e) => toggleFollow(e, user.id)}
                  className={user.isFollowing 
                    ? "rounded-xl h-8 px-3 bg-gray-100 text-gray-900 hover:bg-gray-200 font-bold" 
                    : "rounded-xl h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  }
                >
                  {user.isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </Button>
              </div>
            ))}

            {!isLoading && users.length === 0 && (
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
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Search;