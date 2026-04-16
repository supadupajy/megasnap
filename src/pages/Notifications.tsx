"use client";

import React, { useState } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { MOCK_NOTIFICATIONS } from '@/lib/mock-data';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: number;
  type: string;
  user: { name: string; avatar: string };
  content: string;
  time: string;
  isFollowing?: boolean;
  image?: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS as Notification[]);

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

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-white pb-24 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={handleBack} className="mr-4 p-1 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="font-bold text-lg text-gray-900">알림</h1>
      </header>

      <div className="pt-[88px] flex flex-col">
        <div className="py-4">
          <h2 className="text-sm font-bold text-gray-900 mb-4 px-4">이번 주</h2>
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {notifications.map((notif) => (
                <div key={notif.id} className="relative group overflow-hidden">
                  {/* Delete Action Background */}
                  <div className="absolute inset-0 bg-red-500 flex justify-end items-center pr-6">
                    <button 
                      onClick={() => deleteNotification(notif.id)}
                      className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"
                    >
                      <Trash2 className="w-6 h-6" />
                      <span className="text-[10px] font-bold">삭제</span>
                    </button>
                  </div>

                  {/* Notification Content Layer */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -80, right: 0 }}
                    dragElastic={0.1}
                    className="relative bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-50 z-10"
                  >
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
                          : "bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-4 rounded-lg"
                        }
                      >
                        {notif.isFollowing ? '팔로잉' : '팔로우'}
                      </Button>
                    ) : (
                      <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden">
                        <img src={notif.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </motion.div>
                </div>
              ))}
            </AnimatePresence>
            {notifications.length === 0 && (
              <div className="py-20 text-center text-gray-400 font-medium">
                새로운 알림이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Notifications;