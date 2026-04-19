"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';

const Header = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!authUser) return;
    try {
      // 1. 알림 개수 (읽지 않은 것)
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false);
      
      setUnreadNotifCount(notifCount || 0);

      // 2. Supabase 메시지 개수 (내가 수신자이고 읽지 않은 것)
      const { count: dbMsgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', authUser.id)
        .eq('is_read', false);
      
      // 3. 로컬 chatStore 메시지 개수 합산
      const localUnreadCount = chatStore.getRooms().filter(r => r.unread).length;
      
      setUnreadMsgCount((dbMsgCount || 0) + localUnreadCount);
    } catch (err) {
      console.error('[Header] Failed to fetch counts:', err);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    fetchCounts();

    // 실시간 업데이트 구독 (필터를 제거하여 UPDATE 이벤트를 확실히 수신)
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channel = supabase.channel(`header_updates_${authUser.id}_${uniqueId}`);

    channel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications'
      }, (payload: any) => {
        // 내 알림인 경우에만 갱신
        if (payload.new?.user_id === authUser.id || payload.old?.user_id === authUser.id) {
          fetchCounts();
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages'
      }, (payload: any) => {
        // 내가 수신자이거나 발신자인 메시지의 변화(읽음 처리 포함)가 생기면 갱신
        const msg = payload.new || payload.old;
        if (msg?.receiver_id === authUser.id || msg?.sender_id === authUser.id) {
          fetchCounts();
        }
      })
      .subscribe();

    // 로컬 스토어 구독
    const unsubscribeChatStore = chatStore.subscribe(fetchCounts);

    return () => { 
      supabase.removeChannel(channel);
      unsubscribeChatStore();
    };
  }, [authUser, fetchCounts]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
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