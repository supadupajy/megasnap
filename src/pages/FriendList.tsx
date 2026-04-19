"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, UserPlus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';

const FriendList = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        return;
      }

      setIsLoading(true);
      try {
        // profiles 테이블에서 닉네임 또는 ID로 검색
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, bio')
          .or(`nickname.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`)
          .neq('id', authUser?.id) // 나 자신은 제외
          .limit(20);

        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error('User search error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => searchUsers(), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, authUser]);

  const handleStartChat = (user: any) => {
    // 로컬 스토어에 방 생성 후 이동
    chatStore.getOrCreateRoom(user.id, user.nickname || '사용자', user.avatar_url);
    navigate(`/chat/${user.id}`);
  };

  return (
    <div className="min-h-screen bg-white pb-10">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-lg text-gray-900 mr-10">새로운 메시지</h1>
      </header>

      <div className="pt-[88px] px-4">
        <div className="relative py-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="닉네임 또는 아이디 검색" 
              className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-indigo-600 font-bold" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              autoFocus 
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            {searchQuery ? '검색 결과' : '대화할 상대를 찾아보세요'}
          </p>
          <div className="space-y-1">
            {users.map((user) => (
              <div 
                key={user.id} 
                onClick={() => handleStartChat(user)} 
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">
                      {user.nickname?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 truncate">{user.nickname || '사용자'}</span>
                    <span className="text-[10px] text-gray-400">@{user.id.substring(0, 8)}...</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{user.bio || '안녕하세요! Chora 탐험가입니다.'}</p>
                </div>
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                </div>
              </div>
            ))}
            {!isLoading && searchQuery && users.length === 0 && (
              <div className="py-20 text-center text-gray-400 font-medium">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendList;