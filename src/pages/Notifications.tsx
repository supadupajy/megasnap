"use client";

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: 'follow',
    user: { name: 'travel_maker', avatar: 'https://i.pravatar.cc/150?u=1' },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2시간',
    isFollowing: false
  },
  {
    id: 2,
    type: 'like',
    user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=2' },
    content: '님이 회원님의 사진을 좋아합니다.',
    time: '4시간',
    image: 'https://picsum.photos/seed/notif1/100/100'
  },
  {
    id: 3,
    type: 'comment',
    user: { name: 'explorer_kim', avatar: 'https://i.pravatar.cc/150?u=3' },
    content: '님이 댓글을 남겼습니다: "여기 진짜 예쁘네요! 어디인가요?"',
    time: '1일',
    image: 'https://picsum.photos/seed/notif2/100/100'
  },
  {
    id: 4,
    type: 'follow',
    user: { name: 'nature_lover', avatar: 'https://i.pravatar.cc/150?u=4' },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2일',
    isFollowing: true
  }
];

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const toggleFollow = (id: number) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, isFollowing: !notif.isFollowing } : notif
    ));
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="mr-4 p-1 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="font-bold text-lg text-gray-900">알림</h1>
      </header>

      <div className="pt-[88px] flex flex-col">
        <div className="px-4 py-4">
          <h2 className="text-sm font-bold text-gray-900 mb-4">이번 주</h2>
          <div className="space-y-6">
            {notifications.map((notif) => (
              <div key={notif.id} className="flex items-center gap-3">
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarImage src={notif.user.avatar} />
                  <AvatarFallback>{notif.user.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm leading-tight">
                  <span className="font-bold">{notif.user.name}</span>
                  <span className="text-gray-700"> {notif.content}</span>
                  <span className="text-gray-400 ml-1">{notif.time}</span>
                </div>
                {notif.type === 'follow' ? (
                  <Button 
                    size="sm" 
                    variant={notif.isFollowing ? "secondary" : "default"}
                    onClick={() => toggleFollow(notif.id)}
                    className={notif.isFollowing 
                      ? "bg-gray-100 text-gray-900 font-bold h-8 px-4 rounded-lg hover:bg-gray-200" 
                      : "bg-green-500 hover:bg-green-600 text-white font-bold h-8 px-4 rounded-lg"
                    }
                  >
                    {notif.isFollowing ? '팔로잉' : '팔로우'}
                  </Button>
                ) : (
                  <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden">
                    <img src={notif.image} alt="" className="w-full h-full object-cover" />
                  </div>
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

export default Notifications;