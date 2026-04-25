"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { usePushNotifications } from '@/components/NotificationsProvider';

// 사운드 파일 경로 (더 명확하고 호환성 높은 MP3 파일로 교체)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const Header = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasUnread } = usePushNotifications();

  return (
    <header className="fixed top-0 left-0 right-0 z-[50] bg-white/80 backdrop-blur-xl border-b border-gray-100">
      {/* 안드로이드 상단 상태바 여백 확보 */}
      <div className="h-[env(safe-area-inset-top,24px)] w-full bg-transparent" />
      
      <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-lg mx-auto">
        <div 
          className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          onClick={() => navigate('/')}
        >
          <h1 
            className="text-2xl font-black tracking-tighter italic shrink-0"
          >
            <span className="text-gray-900">Chora</span>
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
            {hasUnread && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
                {hasUnread ? '1' : ''}
              </span>
            )}
          </button>
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/messages')}
          >
            <MessageSquare className="w-6 h-6 text-gray-600" />
            {hasUnread && (
              <span className="absolute top-0 right-0 w-[18px] h-[18px] bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
                {hasUnread > 99 ? '99+' : hasUnread}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;