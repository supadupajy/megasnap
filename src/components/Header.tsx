"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

const Header = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      // 1. 알림 개수 (읽지 않은 것, 단 메시지 알림 제외)
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false)
        .neq('type', 'message'); // 메시지 알림은 메시지 뱃지에서 처리
      
      setUnreadNotifCount(notifCount || 0);

      // 2. 메시지 개수 (내가 수신자이고 읽지 않은 것)
      const { count: dbMsgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', authUser.id)
        .eq('is_read', false);
      
      setUnreadMsgCount(dbMsgCount || 0);
    } catch (err) {
      console.error('[Header] Failed to fetch counts:', err);
    }
  }, [authUser?.id]);

  const handleRealtimeUpdate = useCallback(() => {
    // Realtime 이벤트 발생 시 100ms 지연 후 카운트 업데이트
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      fetchCounts();
    }, 100);
  }, [fetchCounts]);

  useEffect(() => {
    if (!authUser?.id) return;

    fetchCounts();

    // 실시간 업데이트 구독
    const channelName = `header_updates_${authUser.id}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on('postgres_changes', { 
        event: 'INSERT', // INSERT 이벤트에만 반응하도록 명확히 지정
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${authUser.id}`
      }, handleRealtimeUpdate)
      .on('postgres_changes', { 
        event: 'INSERT', // INSERT 이벤트에만 반응하도록 명확히 지정
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${authUser.id}`
      }, handleRealtimeUpdate)
      .subscribe();

    return () => { 
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, handleRealtimeUpdate]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-50 flex items-center justify-between px-4 border-b border-gray-100">
      <h1 
        className="text-2xl font-black text-indigo-600 tracking-tighter cursor-pointer italic shrink-0"
        onClick={() => navigate('/')}
      >
        Chora
      </h1>

      <HeaderAdBanner />

      <div className="flex items-center gap-4 shrink-0">
        <button 
          className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-6 h-6 text-gray-600" />
          {unreadNotifCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </button>
        <button 
          className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
          onClick={() => navigate('/messages')}
        >
          <MessageSquare className="w-6 h-6 text-gray-600" />
          {unreadMsgCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-indigo-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
              {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;