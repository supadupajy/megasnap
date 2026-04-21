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
  const { session, user } = useAuth();
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [canPlaySound, setCanPlaySound] = useState(true); 
  const location = useLocation();
  const navigate = useNavigate();

  // 뒤로가기 핸들러 (애니메이션 포함)
  const handleBack = useCallback(() => {
    navigate('/', { 
      replace: true, 
      state: { direction: 'back' } 
    });
  }, [navigate]);

  // 사용자 상호작용 감지 및 사운드 허용 처리
  useEffect(() => {
    const enableAudio = () => {
      setCanPlaySound(true);
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
    };

    window.addEventListener('click', enableAudio);
    window.addEventListener('touchstart', enableAudio);
    
    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  // 사운드 재생 함수 (사용자가 화면을 한 번이라도 클릭했다면 무조건 실행)
  const playSound = useCallback(() => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.volume = 0.5;
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          // NotAllowedError가 나면 아직 상호작용이 없었다는 뜻
          if (e.name === 'NotAllowedError') {
            console.log('[Header] Playback blocked: Interaction required');
            setCanPlaySound(false);
          }
        });
      }
    } catch (e) {
      console.error('[Header] Sound play error:', e);
    }
  }, []);

  // 초기 알림 체크 (메모이제이션)
  const checkNotifications = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    if (!error && count !== null) {
      setHasNewNotifications(count > 0);
    }
  }, [user]);

  // 초기 미확인 메시지 체크 (메모이제이션)
  const checkMessages = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    
    if (!error && count !== null) {
      setUnreadMsgCount(count);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    checkNotifications();
    checkMessages();

    // 실시간 구독 통합 관리 및 최적화
    // 1. 필요한 이벤트와 테이블만 명시적으로 구독
    // 2. filter를 통해 내 데이터가 아닌 트래픽은 원천 차단
    const channel = supabase
      .channel(`user-updates-${user.id}`, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        }
      });

    channel
      // 1. 알림 실시간 감지 (INSERT만 감시)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('[Header] New notification');
          setHasNewNotifications(true);
        }
      )
      // 2. 메시지 실시간 감지 (INSERT만 감시, 필요한 컬럼만 추출하는 로직은 클라이언트에서 처리)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('[Header] New message');
          setUnreadMsgCount(prev => prev + 1);
          
          if (!window.location.pathname.startsWith('/chat/')) {
            playSound();
          }
        }
      )
      // 3. 읽음 처리 감지 (UPDATE 감시)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => checkNotifications()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => checkMessages()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Header] Optimized realtime subscribed');
        }
      });

    return () => {
      console.log('[Header] Cleaning up realtime channel');
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-[100] flex items-center justify-between px-4 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <h1 
          className="text-2xl font-black tracking-tighter cursor-pointer italic shrink-0"
          onClick={() => navigate('/')}
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
          {hasNewNotifications && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
              {hasNewNotifications ? '1' : ''}
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