"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { searchProfilesByNickname } from '@/utils/profile-search';

const FriendList = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const searchUsers = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setIsLoading(false);
      setUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchProfilesByNickname(trimmedQuery, authUser?.id, 30);
      setUsers(data);
    } catch (err) {
      console.error('User search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleStartChat = (user: any) => {
    chatStore.getOrCreateRoom(user.id, user.nickname || '사용자', user.avatar_url);
    navigate(`/chat/${user.id}`);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col pt-[88px] overflow-hidden">
      {/* 고정 영역: 검색창 + 광고 배너 + 타이틀 */}
      <div className="shrink-0 bg-white z-40">
        <div className="px-4 pt-4 pb-0">
          <div className="relative mb-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="닉네임으로 친구 찾기"
              className="w-full pl-12 h-14 bg-white border-2 border-indigo-600 rounded-2xl outline-none font-bold placeholder:text-gray-400 shadow-sm transition-all focus:ring-2 focus:ring-indigo-100"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isLoading && searchQuery.trim() && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 스크롤 리스트 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-2">
          <div className="space-y-1">
            {users.map((user) => (
              <div 
                key={user.id} 
                onClick={() => handleStartChat(user)} 
                className="flex items-center gap-4 p-3 hover:bg-indigo-50/50 rounded-[24px] cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="w-12 h-12 rounded-full p-[2px] bg-indigo-100 shrink-0">
                  <Avatar className="w-full h-full border-2 border-white">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">
                      {user.nickname?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{user.nickname}</p>
                  <p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p>
                </div>
              </div>
            ))}
          </div>
          {!isLoading && searchQuery.trim() && users.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center px-10">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-sm text-gray-400 font-bold leading-relaxed">
                해당 닉네임을 가진 사용자가 없습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendList;