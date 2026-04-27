"use client";

import React from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { useNotifications } from '@/components/NotificationProvider';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadMessages, unreadNotifs } = useNotifications();

  const isHiddenPage = location.pathname === '/' && location.state?.startSelection;
  if (isHiddenPage) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-[50] bg-white border-b border-gray-100">
      <div className="h-[env(safe-area-inset-top,0px)] w-full bg-transparent" />
      
      <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-lg mx-auto">
        <div 
          className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          onClick={() => navigate('/')}
        >
          <h1 className="text-2xl font-black tracking-tighter italic shrink-0">
            <span className="text-gray-900">Vivid</span>
            <span className="text-indigo-600">Snap</span>
          </h1>
        </div>

        <HeaderAdBanner />

        <div className="flex items-center gap-4 shrink-0">
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="w-6 h-6 text-gray-600" />
            {unreadNotifs > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/messages')}
          >
            <MessageSquare className="w-6 h-6 text-gray-600" />
            {unreadMessages > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
