"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
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
  const [canPlaySound, setCanPlaySound] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // 사용자 상호작용 감지 및 사운드 허용 처리
  useEffect(() => {
    const enableAudio = () => {
      // 오디오 컨텍스트를 활성화하여 브라우저의 차단을 완전히 해제
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      setCanPlaySound(true);
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
      console.log('[Header] Audio playback fully enabled');
    };

    window.addEventListener('click', enableAudio);
    window.addEventListener('touchstart', enableAudio);
    
    // 만약 이미 이전에 상호작용이 있었다면 (예: 네비게이션 이동 등) 자동으로 true로 설정될 수 있는 환경인지 체크
    // 하지만 대부분의 브라우저는 새 세션마다 클릭이 필요하므로 위 리스너가 가장 정확합니다.
    
    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  // 사운드 재생 함수
  const playSound = useCallback(() => {
    // 1. 권한 체크 (상호작용 여부)
    if (!canPlaySound) {
      console.log('[Header] Sound skipped: Waiting for first user interaction');
      return;
    }

    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.volume = 0.5;
      
      // 2. 브라우저 호환성을 위한 play() 약속 처리
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
            console.warn('[Header] Playback blocked or not supported yet:', error.name);
            setCanPlaySound(false); // 상호작용이 다시 필요할 수 있음
          } else {
            console.error('[Header] Audio playback error:', error);
          }
        });
      }
    } catch (e) {
      console.error('[Header] Audio initialization failed:', e);
    }
  }, [canPlaySound]);

  useEffect(() => {
    if (!user) return;

    // 초기 알림 체크
    const checkNotifications = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (!error && count !== null) {
        setHasNewNotifications(count > 0);
      }
    };

    // 초기 미확인 메시지 체크
    const checkMessages = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (!error && count !== null) {
        setUnreadMsgCount(count);
      }
    };

    checkNotifications();
    checkMessages();

    // 실시간 구독 통합 관리
    const channel = supabase
      .channel(`user-updates-${user.id}`)
      // 1. 알림 실시간 감지
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('[Header] New notification detected', payload);
          setHasNewNotifications(true);
        }
      )
      // 2. 메시지 실시간 감지
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('[Header] New message detected', payload);
          setUnreadMsgCount(prev => prev + 1);
          
          // 현재 채팅방(/chat/...) 안에 있지 않을 때만 헤더에서 소리를 재생
          if (!window.location.pathname.startsWith('/chat/')) {
            playSound();
          }
        }
      )
      // 3. 알림/메시지 읽음 처리 감지
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          checkNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          checkMessages();
        }
      )
      .subscribe((status) => {
        console.log(`[Header] Realtime status for user ${user.id}:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-50 flex items-center justify-between px-4 border-b border-gray-100">
  <h1 
    className="text-2xl font-black tracking-tighter cursor-pointer italic shrink-0"
    onClick={() => navigate('/')}
  >
    <span className="text-gray-900">Chora</span>
    <span className="text-indigo-600">Snap</span>
  </h1>

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