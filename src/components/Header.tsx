"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import Notifications from '@/pages/Notifications';
import Messages from '@/pages/Messages';

// 사운드 파일 경로 (더 명확하고 호환성 높은 MP3 파일로 교체)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const Header = () => {
  const { session, user } = useAuth();
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [canPlaySound, setCanPlaySound] = useState(true); 
  const [activePanel, setActivePanel] = useState<'notifications' | 'messages' | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // 패널 외부 클릭 시 닫기
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setActivePanel(null);
      }
    };
    if (activePanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePanel]);

  // 경로 이동 시 패널 닫기
  useEffect(() => {
    setActivePanel(null);
  }, [location.pathname]);

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

    // 실시간 구독 통합 관리
    const channel = supabase
      .channel(`user-updates-${user.id}`);

    channel
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
  }, [user, checkMessages, checkNotifications, playSound]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-[100] flex items-center justify-between px-4 border-b border-gray-100">
        <h1 
          className="text-2xl font-black tracking-tighter cursor-pointer italic shrink-0"
          onClick={() => {
            setActivePanel(null);
            navigate('/');
          }}
        >
          <span className="text-gray-900">Chora</span>
          <span className="text-indigo-600">Snap</span>
        </h1>

        <HeaderAdBanner />

        <div className="flex items-center gap-4 shrink-0">
          <button 
            className={cn(
              "relative p-1 rounded-full transition-colors",
              activePanel === 'notifications' ? "bg-indigo-50 text-indigo-600" : "hover:bg-gray-50 text-gray-600"
            )}
            onClick={() => setActivePanel(prev => prev === 'notifications' ? null : 'notifications')}
          >
            <Bell className="w-6 h-6" />
            {hasNewNotifications && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
                1
              </span>
            )}
          </button>
          <button 
            className={cn(
              "relative p-1 rounded-full transition-colors",
              activePanel === 'messages' ? "bg-indigo-50 text-indigo-600" : "hover:bg-gray-50 text-gray-600"
            )}
            onClick={() => setActivePanel(prev => prev === 'messages' ? null : 'messages')}
          >
            <MessageSquare className="w-6 h-6" />
            {unreadMsgCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-indigo-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold animate-in zoom-in duration-300">
                {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 알림/메시지 오버레이 패널 */}
      <AnimatePresence>
        {activePanel && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-[88px] left-0 right-0 bottom-0 z-[90] bg-white overflow-hidden shadow-2xl"
          >
            <div className="h-full w-full max-w-lg mx-auto border-x border-gray-100 bg-white overflow-y-auto no-scrollbar">
              {activePanel === 'notifications' ? (
                <div className="pb-20">
                  <Notifications isEmbedded={true} />
                </div>
              ) : (
                <div className="pb-20">
                  <Messages isEmbedded={true} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;