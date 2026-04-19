"use client";

import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

const Header = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!authUser) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('is_read', false);
        
        if (!error) setUnreadCount(count || 0);
      } catch (err) {
        console.error('[Header] Failed to fetch unread count:', err);
      }
    };

    fetchUnreadCount();

    // 채널 이름에 랜덤 문자열을 추가하여 매 렌더링/구독마다 고유함을 보장
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `header_notifs_${authUser.id}_${uniqueId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${authUser.id}` 
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      // 컴포넌트 언마운트 시 채널 제거
      supabase.removeChannel(channel);
    };
  }, [authUser]);

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
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button 
          className="p-1 hover:bg-gray-50 rounded-full transition-colors"
          onClick={() => navigate('/messages')}
        >
          <MessageSquare className="w-6 h-6 text-gray-600" />
        </button>
      </div>
    </header>
  );
};

export default Header;