"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

// 사운드 파일 경로 (더 명확하고 호환성 높은 MP3 파일로 교체)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setUnreadCount(count || 0);
    }
  }, [user]);

  const fetchUnreadNotifCount = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setUnreadNotifCount(count || 0);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    fetchUnreadNotifCount();

    const messagesChannel = supabase
      .channel('header-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user?.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchUnreadNotifCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, fetchUnreadCount, fetchUnreadNotifCount]);
  
  // ✅ [FIX] 메인 지도 화면('/')에서 '위치 선택' 중일 때만 헤더를 숨깁니다.
  const isHiddenPage = location.pathname === '/' && location.state?.startSelection;
  if (isHiddenPage) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-[50] bg-white border-b border-gray-100">
      {/* 안드로이드 상단 상태바 여백 - Index와의 간격을 위해 높이를 최소화하거나 Index에서 조절 */}
      <div className="h-[env(safe-area-inset-top,0px)] w-full bg-transparent" />
      
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
            {unreadNotifCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/messages')}
          >
            <MessageSquare className="w-6 h-6 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;