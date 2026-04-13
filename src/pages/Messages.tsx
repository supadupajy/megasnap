"use client";

import React, { useState } from 'react';
import { ChevronLeft, Search, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

const MESSAGES = [
  {
    id: 1,
    user: { name: 'travel_maker', avatar: 'https://i.pravatar.cc/150?u=1' },
    lastMessage: '성수동 카페 정보 좀 알려주실 수 있나요?',
    time: '12분',
    unread: true
  },
  {
    id: 2,
    user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=2' },
    lastMessage: '사진 너무 잘 찍으시네요! 👍',
    time: '2시간',
    unread: false
  },
  {
    id: 3,
    user: { name: 'explorer_kim', avatar: 'https://i.pravatar.cc/150?u=3' },
    lastMessage: '다음에 같이 출사 가요!',
    time: '1일',
    unread: false
  }
];

const Messages = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Direct Message</h1>
        </div>
        <button className="p-1 hover:bg-gray-50 rounded-full transition-colors">
          <Edit className="w-6 h-6 text-gray-800" />
        </button>
      </header>

      <div className="pt-[88px] px-4 py-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="검색" 
            className="pl-10 h-10 bg-gray-100 border-none rounded-xl focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">메시지</h2>
            <button className="text-sm font-bold text-blue-500">요청</button>
          </div>

          <div className="space-y-5">
            {MESSAGES.map((msg) => (
              <div 
                key={msg.id} 
                onClick={() => navigate(`/chat/${msg.id}`)}
                className="flex items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
              >
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarImage src={msg.user.avatar} />
                  <AvatarFallback>{msg.user.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${msg.unread ? 'font-bold text-gray-900' : 'text-gray-900'}`}>
                    {msg.user.name}
                  </p>
                  <div className="flex items-center gap-1">
                    <p className={`text-sm truncate ${msg.unread ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                      {msg.lastMessage}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">· {msg.time}</span>
                  </div>
                </div>
                {msg.unread && (
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Messages;