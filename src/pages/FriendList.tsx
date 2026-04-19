"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Search, UserPlus, Loader2, MessageSquare } from 'lucide-react';
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

  // 사용자 검색 함수
  const performSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      let supabaseQuery = supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio')
        .neq('id', authUser?.id); // 나 자신 제외

      if (query.trim()) {
        // 검색어가 있을 때: 닉네임 또는 ID로 검색
        supabaseQuery = supabaseQuery.or(`nickname.ilike.%${query}%,id.ilike.%${query}%`);
      } else {
        // 검색어가 없을 때: 최근 가입자 순으로 추천
        supabaseQuery = supabaseQuery.order('updated_at', { ascending: false }).limit(10);
      }

      const { data, error } = await supabaseQuery.limit(20);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('[FriendList] Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  // 입력값 변경 시 검색 실행 (디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleStartChat = (user: any) => {
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
            {searchQuery ? '검색 결과' : '추천 사용자'}
          </p>
          
          <div className="space-y-1">
            {users.map((user) => (
              <div 
                key={user.id} 
                onClick={() => handleStartChat(user)} 
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all group"
              >
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-indigo-400 to-indigo-600 shrink-0">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">
                      {user.nickname?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {user.nickname || '사용자'}
                    </span>
                    <span className="text-[10px] text-gray-400">@{user.id.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{user.bio || '안녕하세요! Chora 탐험가입니다.'}</p>
                </div>
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
            ))}
            
            {!isLoading && users.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-200" />
                </div>
                <p className="text-sm text-gray-400 font-medium">
                  {searchQuery ? `'${searchQuery}'에 대한 검색 결과가 없습니다.` : '사용자를 찾을 수 없습니다.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendList;