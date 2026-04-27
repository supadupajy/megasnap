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
      // messages INSERT + UPDATE 를 단일 구독으로 처리
      // ⚠️ .on()을 같은 테이블에 2번 호출하면 realtime.subscription에 2행이 생겨 WAL 폴링 2배 발생
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          fetchCounts(userId);
          // 새 메시지(INSERT)일 때만 메시지 목록 갱신 이벤트 발생
          if (payload.eventType === 'INSERT') {
            window.dispatchEvent(new CustomEvent('refresh-messages-list'));
          }
        }
      )
      // 알림 (변경 시 카운트 갱신 + Notifications 페이지에 이벤트 전달)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
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
  }, [user?.id, fetchCounts]);

  return (
    <NotificationContext.Provider value={{ unreadMessages, unreadNotifs, refreshCounts }}>
      {children}
    </NotificationContext.Provider>
  );
};