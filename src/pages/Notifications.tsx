"use client";

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { MOCK_NOTIFICATIONS } from '@/lib/mock-data';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const toggleFollow = (id: number) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, isFollowing: !notif.isFollowing } : notif
    ));
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={handleBack} className="mr-4 p-1 hover:bg-gray-50 rounded-full transition-colors">
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