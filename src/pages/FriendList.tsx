"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Search, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div 
      className="h-screen overflow-y-auto bg-white pb-24 no-scrollbar"
      style={{
        paddingTop: '88px', 
      }}
    >
      <div className="sticky top-0 z-40 bg-white flex items-center px-4 h-14 border-b border-gray-100">
        <button 
          onClick={handleBack} 
          className="p-2 hover:bg-gray-50 rounded-full transition-colors active:scale-95"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-lg text-gray-900 mr-10">새 메시지</h1>
      </div>

      <div className="flex flex-col">
        {/* THE NORTH FACE 광고 배너 */}
        <div className="px-4 py-2 mt-2">
          <div className="relative h-24 rounded-2xl overflow-hidden group cursor-pointer shadow-md border border-gray-100 bg-zinc-900">
            <img 
              src="/assets/northface-ad-banner.png" 
              alt="The North Face Ad" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
            <div className="absolute inset-0 p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-white/90 backdrop-blur-sm text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-gray-800 shadow-sm">AD</span>
                <span className="text-[10px] font-black text-white tracking-widest uppercase drop-shadow-md flex items-center gap-1">
                  THE NORTH FACE
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white italic tracking-tighter drop-shadow-lg uppercase">Never Stop Exploring.</h3>
                <p className="text-[9px] font-bold text-white/80 drop-shadow-md">Summit Series: Outperform the Cold</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 mt-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="닉네임으로 친구 찾기"
              className="w-full pl-12 h-12 bg-white border-2 border-indigo-600 rounded-xl outline-none font-bold placeholder:text-gray-400 shadow-sm transition-all"
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

        <div className="space-y-6 px-4">
          <div className="space-y-4">
            <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest px-1">
              {searchQuery ? '검색 결과' : '대화할 상대를 검색해보세요'}
            </h2>
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
    </div>
  );
};

export default FriendList;