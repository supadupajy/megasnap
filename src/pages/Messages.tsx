"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';
import { chatStore, ChatRoom } from '@/utils/chat-store';

const Messages = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<ChatRoom[]>(chatStore.getRooms());

  useEffect(() => {
    const unsubscribe = chatStore.subscribe(() => {
      setRooms(chatStore.getRooms());
    });
    return unsubscribe;
  }, []);

  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleAvatarClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  const filteredRooms = rooms.filter(room => 
    room.user.name.toLowerCase().includes(query.toLowerCase()) ||
    room.lastMessage.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="font-black text-lg text-gray-900">Direct Message</h1>
        </div>
        <button className="p-1 hover:bg-gray-50 rounded-full transition-colors">
          <Edit className="w-6 h-6 text-indigo-600" />
        </button>
      </header>

      <div className="pt-[88px] px-4 py-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="대화 상대 또는 메시지 검색" 
            className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-indigo-600"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest">최근 메시지</h2>
            <button className="text-xs font-bold text-indigo-600">요청</button>
          </div>

          <div className="space-y-1">
            {filteredRooms.map((room) => (
              <div 
                key={room.id} 
                onClick={() => navigate(`/chat/${room.id}`)}
                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-[24px] cursor-pointer active:scale-[0.98] transition-all"
              >
                <div 
                  className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-indigo-400 to-indigo-600 shrink-0 cursor-pointer active:scale-95 transition-transform shadow-sm"
                  onClick={(e) => handleAvatarClick(e, room.id)}
                >
                  <img 
                    src={room.user.avatar} 
                    alt={room.user.name} 
                    className="w-full h-full rounded-full object-cover border-2 border-white" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm ${room.unread ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                      {room.user.name}
                    </p>
                    <span className="text-[10px] text-gray-400 font-medium">{room.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs truncate flex-1 ${room.unread ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                      {room.lastMessage || '대화를 시작해보세요!'}
                    </p>
                    {room.unread && (
                      <div className="w-2 h-2 bg-indigo-600 rounded-full shadow-sm shadow-indigo-200" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredRooms.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-400 font-medium">대화 내역이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Messages;