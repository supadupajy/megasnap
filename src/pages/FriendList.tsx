"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, Search, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MOCK_USERS } from '@/lib/mock-data';
import { chatStore } from '@/utils/chat-store';

const FriendList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFriends = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return MOCK_USERS;
    return MOCK_USERS.filter(u => 
      u.nickname?.toLowerCase().includes(query) || 
      u.name.toLowerCase().includes(query) || 
      u.id.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleStartChat = (user: any) => {
    // 채팅방 생성 또는 기존 방 가져오기
    chatStore.getOrCreateRoom(user.id, user.nickname || user.name, user.avatar);
    // 채팅창으로 이동
    navigate(`/chat/${user.id}`);
  };

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-gray-50 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-lg text-gray-900 mr-10">새로운 메시지</h1>
      </header>

      <div className="pt-[88px] px-4">
        {/* Search */}
        <div className="relative py-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="이름 또는 아이디 검색" 
              className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-indigo-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Friend List */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">추천 친구</p>
          <div className="space-y-1">
            {filteredFriends.map((user) => (
              <div 
                key={user.id} 
                onClick={() => handleStartChat(user)}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 truncate">{user.nickname}</span>
                    <span className="text-[10px] text-gray-400">@{user.id}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{user.bio}</p>
                </div>
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                </div>
              </div>
            ))}
            
            {filteredFriends.length === 0 && (
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