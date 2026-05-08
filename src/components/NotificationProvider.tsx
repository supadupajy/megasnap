/**
 * NotificationProvider
 *
 * 업계 표준 방식 (Instagram / Slack / Discord 동일 패턴):
 *  - 앱 전체에서 Realtime 채널을 딱 1개만 유지
 *  - 뱃지 카운트(unreadMessages, unreadNotifs)를 전역 Context로 관리
 *  - Header, Chat, 어느 컴포넌트든 채널을 직접 열지 않고 Context만 구독
 *  - DB 변경 → Context 상태 업데이트 → 모든 컴포넌트 자동 반영
 *
 * WAL 폴링 감소 효과:
 *  - 기존: Header 2채널 + Chat 1채널 = 3개
 *  - 변경: 전역 1채널 (messages + notifications 리스너 통합)
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

const OUT_CHAT_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

interface NotificationContextType {
  unreadMessages: number;
  unreadNotifs: number;
  refreshCounts: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadMessages: 0,
  unreadNotifs: 0,
  refreshCounts: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // 오디오 잠금 해제 여부 (모바일 브라우저 정책)
  const audioUnlockedRef = useRef(false);

  // 모바일 브라우저 오디오 잠금 해제: 첫 사용자 인터랙션 시 1회만 실행
  // once: true로 등록해 자동 해제 → 중복 등록 및 리스너 누수 방지
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      const audio = new Audio(OUT_CHAT_SOUND);
      audio.volume = 0;
      audio.play().then(() => {
        audioUnlockedRef.current = true;
      }).catch(() => {});
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const playOutChatSound = useCallback(() => {
    try {
      const audio = new Audio(OUT_CHAT_SOUND);
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  const fetchCounts = useCallback(async (userId: string) => {
    const [{ data: mData }, { data: nData }] = await Promise.all([
      supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', userId)
        .eq('is_read', false)
        .limit(100),
      supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_read', false)
        .limit(100),
    ]);
    setUnreadMessages(mData?.length ?? 0);
    setUnreadNotifs(nData?.length ?? 0);
  }, []);

  const refreshCounts = useCallback(async () => {
    if (user?.id) await fetchCounts(user.id);
  }, [user?.id, fetchCounts]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      setUnreadNotifs(0);
      return;
    }

    const userId = user.id;

    // 초기 카운트 조회
    fetchCounts(userId);

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    /**
     * 단일 채널에 messages + notifications 리스너를 모두 등록
     * → WAL 폴링 연결이 1개만 유지됨
     */
    const channel = supabase
      .channel(`global-badge-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const row = (payload.new as any) ?? (payload.old as any);
          // 나와 관련된 메시지(수신자 또는 발신자)만 처리
          if (row?.receiver_id !== userId && row?.sender_id !== userId) return;

          fetchCounts(userId);

          if (payload.eventType === 'INSERT') {
            // 내가 받는 메시지일 때만 알림 처리
            if (row?.receiver_id !== userId) return;

            const senderId = row?.sender_id;
            // sender_id를 detail에 포함시켜 Chat.tsx가 자신이 보낸 메시지인지 판별 가능하게 함
            window.dispatchEvent(new CustomEvent('refresh-messages-list', { detail: { sender_id: senderId } }));

            // 현재 해당 발신자와의 채팅방 안에 있지 않을 때만 소리 재생
            const activeChatId = localStorage.getItem('activeChatId');
            if (!activeChatId || activeChatId !== senderId) {
              playOutChatSound();
            }
          }

          if (payload.eventType === 'UPDATE') {
            // 내가 보낸 메시지가 상대방에게 읽혔을 때 → A의 Chat.tsx에 읽음 표시 실시간 반영
            // sender_id === userId: 내가 보낸 메시지, is_read가 true로 바뀐 경우
            if (row?.sender_id === userId && row?.is_read === true) {
              window.dispatchEvent(new CustomEvent('refresh-read-status', {
                detail: { receiver_id: row?.receiver_id }
              }));
            }
          }
        }
      )
      // 알림 (변경 시 카운트 갱신 + Notifications 페이지에 이벤트 전달)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const row = (payload.new as any) ?? (payload.old as any);
          if (row?.user_id !== userId) return;
          fetchCounts(userId);
          window.dispatchEvent(new CustomEvent('refresh-unread-counts'));
        }
      )
      .subscribe();

    channelRef.current = channel;

    // 다른 컴포넌트(Chat 등)에서 카운트 갱신 요청 시
    const handleRefresh = () => fetchCounts(userId);
    window.addEventListener('refresh-unread-counts', handleRefresh);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.removeEventListener('refresh-unread-counts', handleRefresh);
    };
  }, [user?.id, fetchCounts, playOutChatSound]);

  return (
    <NotificationContext.Provider value={{ unreadMessages, unreadNotifs, refreshCounts }}>
      {children}
    </NotificationContext.Provider>
  );
};