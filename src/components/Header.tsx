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
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  useEffect(() => {
    if (!authUser) return;

    const fetchCounts = async () => {
      try {
        // 1. 알림 개수 (좋아요, 팔로우 등)
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('is_read', false);
        
        setUnreadNotifCount(notifCount || 0);

        // 2. 메시지 개수
        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', authUser.id)
          .eq('is_read', false);
        
        setUnreadMsgCount(msgCount || 0);
      } catch (err) {
        console.error('[Header] Failed to fetch counts:', err);
      }
    };

    fetchCounts();

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channel = supabase.channel(`header_updates_${authUser.id}_${uniqueId}`);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${authUser.id}` }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUser.id}` }, fetchCounts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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