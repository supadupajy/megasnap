"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, Loader2, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

interface Notification {
  id: string;
  type: string;
  actor_id: string;
  post_id?: string;
  content?: string;
  created_at: string;
  is_read: boolean;
  actor?: {
    nickname: string;
    avatar_url: string;
  };
}

const SWIPE_THRESHOLD = 40;
const SNAP_OPEN = -80;
const SPRING = { type: 'spring' as const, stiffness: 400, damping: 35 };

interface SwipeItemProps {
  notif: Notification;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClick: (notif: Notification) => void;
  onActorClick: (notif: Notification) => void;
  getNotificationText: (notif: Notification) => string;
}

const SwipeNotificationItem: React.FC<SwipeItemProps> = ({
  notif,
  isOpen,
  onOpen,
  onClose,
  onDelete,
  onClick,
  onActorClick,
  getNotificationText,
}) => {

  const x = useMotionValue(0);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // isOpen 변경 시 스냅 애니메이션
  useEffect(() => {
    if (!isMounted.current) return;
    animate(x, isOpen ? SNAP_OPEN : 0, SPRING);
  }, [isOpen, x]);

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -SWIPE_THRESHOLD || velocity < -300) {
      animate(x, SNAP_OPEN, SPRING);
      onOpen(notif.id);
    } else {
      animate(x, 0, SPRING);
      onClose();
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex justify-center items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notif.id);
          }}
          className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-[10px] font-bold">삭제</span>
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: SNAP_OPEN, right: 0 }}
        dragElastic={0.05}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="relative px-4 py-4 flex items-center gap-3 border-b border-gray-50 z-10 cursor-pointer bg-white active:bg-gray-50 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          const target = e.target as HTMLElement;
          if (target.closest('[data-notification-actor="true"]')) {
            onActorClick(notif);
            return;
          }
          onClick(notif);
        }}
      >
        <div
          data-notification-actor="true"
          className="shrink-0 rounded-full active:scale-95 transition-transform"
          role="button"
          aria-label={`${notif.actor?.nickname || '사용자'} 프로필 보기`}
        >
          <Avatar className="w-11 h-11 border border-gray-100 pointer-events-none">
            <AvatarImage src={notif.actor?.avatar_url || '/placeholder.svg'} />
            <AvatarFallback>{notif.actor?.nickname?.[0] || '?'}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 text-sm leading-tight">
          <span
            data-notification-actor="true"
            className="inline-block font-bold active:opacity-70 transition-opacity"
            role="button"
          >
            {notif.actor?.nickname || '알 수 없는 사용자'}
          </span>
          <span className="text-gray-700"> {getNotificationText(notif)}</span>
          <span className="text-[10px] text-gray-400 ml-2 block mt-1">
            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ko })}
          </span>
        </div>
      </motion.div>

    </div>
  );
};

const Notifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const handleBack = useCallback(() => {
    const routeState = location.state as any;
    const fromPath = routeState?.fromPath;

    if (fromPath && fromPath !== location.pathname) {
      navigate(fromPath, {
        replace: true,
        state: routeState?.fromState ?? null,
      });
      return;
    }

    navigate('/', {
      replace: true,
      state: { direction: 'back' },
    });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const handleOpenWrite = () => {};
    window.addEventListener('open-write-post', handleOpenWrite);
    return () => window.removeEventListener('open-write-post', handleOpenWrite);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!authUser) return;
    
    try {
      const { data: notifs, error: notifError } = await supabase
        .from('notifications')
        .select('id, type, actor_id, post_id, content, created_at, is_read')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (notifError) throw notifError;

      if (notifs && notifs.length > 0) {
        const actorIds = Array.from(new Set(notifs.map(n => n.actor_id)));
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', actorIds);

        if (profileError) throw profileError;

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);

        const combinedNotifs = notifs.map(n => ({
          ...n,
          actor: profileMap[n.actor_id] || { nickname: '알 수 없는 사용자', avatar_url: null }
        }));

        setNotifications(combinedNotifs);

        if (!hasLoaded.current) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', authUser.id)
            .eq('is_read', false);
            
          window.dispatchEvent(new CustomEvent('refresh-unread-counts'));
        }
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('[Notifications] Fetch error:', error);
    } finally {
      setIsLoading(false);
      hasLoaded.current = true;
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    fetchNotifications();

    const handleRefresh = () => fetchNotifications();
    window.addEventListener('refresh-unread-counts', handleRefresh);

    return () => {
      window.removeEventListener('refresh-unread-counts', handleRefresh);
    };
  }, [authUser?.id, fetchNotifications]);

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      setSwipedId(null);
      showSuccess('알림이 삭제되었습니다.');
    } catch (error: any) {
      console.error('[Notifications] Delete error:', error);
      showError('알림 삭제에 실패했습니다.');
    }
  };

  const getNotificationText = (notif: Notification) => {
    switch (notif.type) {
      case 'follow': return '님이 회원님을 팔로우하기 시작했습니다.';
      case 'like_post': return '님이 회원님의 컨텐츠를 좋아합니다.';
      case 'comment': return `님이 댓글을 남겼습니다: "${notif.content}"`;
      case 'message': return `님이 메시지를 보냈습니다: "${notif.content}"`;
      default: return '님이 활동을 남겼습니다.';
    }
  };

  const handleNotifClick = (notif: Notification) => {
    if (swipedId) {
      setSwipedId(null);
      return;
    }

    if (notif.post_id) navigate('/', { state: { postId: notif.post_id, openPostDetail: true } });
    else if (notif.type === 'message') navigate(`/chat/${notif.actor_id}`);
    else navigate(`/profile/${notif.actor_id}`);
  };

  const handleActorClick = (notif: Notification) => {
    if (swipedId) {
      setSwipedId(null);
      return;
    }

    navigate(`/profile/${notif.actor_id}`);
  };

  return (

    <div

      className="h-screen min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-contain"
      style={{
        paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={() => setSwipedId(null)}
    >
      <div className="pt-16">
        <div className="sticky top-16 z-40 bg-gray-50 grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14 border-b border-gray-100">
          <div />
          <h2 className="text-lg font-black text-gray-900 tracking-tight">알림</h2>
          <div className="flex justify-end">
            <button
              onClick={handleBack}
              className="flex items-center bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-transform shrink-0 overflow-hidden"
              style={{ gap: '6px', padding: '8px 16px' }}
            >
              <X className="w-4 h-4 text-gray-900 shrink-0" />
              <span className="text-sm font-normal text-gray-900 whitespace-nowrap">닫기</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <div className="py-4">
              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {notifications.map((notif) => (
                    <SwipeNotificationItem
                      key={notif.id}
                      notif={notif}
                      isOpen={swipedId === notif.id}
                      onOpen={(id) => setSwipedId(id)}
                      onClose={() => setSwipedId(null)}
                      onDelete={deleteNotification}
                      onClick={handleNotifClick}
                      onActorClick={handleActorClick}
                      getNotificationText={getNotificationText}
                    />

                  ))}
                </AnimatePresence>
                {notifications.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Bell className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-sm text-gray-400 font-bold leading-relaxed">새로운 알림이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
