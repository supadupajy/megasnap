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
const SELECT_SHIFT = 32; // 선택 모드에서 콘텐츠가 오른쪽으로 이동하는 거리
const LONG_PRESS_MS = 450;
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
  selectionMode: boolean;
  isSelected: boolean;
  onLongPress: (id: string) => void;
  onToggleSelect: (id: string) => void;
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
  selectionMode,
  isSelected,
  onLongPress,
  onToggleSelect,
}) => {

  const x = useMotionValue(0);
  const isMounted = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 선택 모드 또는 스와이프 상태에 따라 x 위치 결정
  useEffect(() => {
    if (!isMounted.current) return;
    if (selectionMode) {
      animate(x, SELECT_SHIFT, SPRING);
    } else {
      animate(x, isOpen ? SNAP_OPEN : 0, SPRING);
    }
  }, [isOpen, x, selectionMode]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePressStart = () => {
    if (selectionMode) return;
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      // 햅틱 피드백 (지원 시)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(30); } catch {}
      }
      onLongPress(notif.id);
    }, LONG_PRESS_MS);
  };

  const handlePressEnd = () => {
    clearLongPress();
  };

  const handleDragEnd = (_: any, info: any) => {
    if (selectionMode) return;
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
      {/* 스와이프 삭제 배경 (선택 모드일 때는 숨김) */}
      {!selectionMode && (
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
      )}

      {/* 선택 닷 (왼쪽에 노출) */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.18 }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected
                  ? "bg-indigo-600 border-indigo-600"
                  : "bg-white border-gray-300"
              )}
            >
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        drag={selectionMode ? false : "x"}
        dragConstraints={{ left: SNAP_OPEN, right: 0 }}
        dragElastic={0.05}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
        className="relative px-4 py-4 flex items-center gap-3 border-b border-gray-50 z-10 cursor-pointer bg-white active:bg-gray-50 transition-colors select-none"
        onClick={(e) => {
          e.stopPropagation();

          // 롱프레스로 진입한 경우 클릭 무시
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }

          // 선택 모드에서는 클릭 시 선택 토글
          if (selectionMode) {
            onToggleSelect(notif.id);
            return;
          }

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const hasLoaded = useRef(false);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

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

  const deleteSelectedNotifications = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      exitSelectionMode();
      showSuccess(`${ids.length}개의 알림이 삭제되었습니다.`);
    } catch (error: any) {
      console.error('[Notifications] Bulk delete error:', error);
      showError('알림 삭제에 실패했습니다.');
    }
  };

  const handleLongPress = (id: string) => {
    setSwipedId(null);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      // 모두 해제되면 선택 모드 자동 종료 (버튼은 닫기로 다시 flip)
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  };

  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      // 모두 해제 → 선택 모드 자동 종료
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
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

  const handleRightButtonClick = () => {
    if (selectionMode) {
      if (selectedIds.size === 0) {
        exitSelectionMode();
        return;
      }
      deleteSelectedNotifications();
    } else {
      handleBack();
    }
  };

  return (

    <div

      className="h-screen min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-contain"
      style={{
        paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={() => {
        setSwipedId(null);
      }}
    >
      <div className="pt-16">
        <div className="sticky top-16 z-40 bg-gray-50 grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14 border-b border-gray-100">
          {/* 왼쪽: 전체 선택 (선택 모드일 때) */}
          <div className="flex items-center">
            <AnimatePresence>
              {selectionMode && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelectAll();
                  }}
                  className="flex items-center gap-2 active:scale-95 transition-transform"
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      allSelected
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white border-gray-300"
                    )}
                  >
                    {allSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    전체 선택
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <h2 className="text-lg font-black text-gray-900 tracking-tight">알림</h2>

          {/* 오른쪽: 닫기 ↔ 삭제 (3D flip) */}
          <div className="flex justify-end" style={{ perspective: 600 }}>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                handleRightButtonClick();
              }}
              animate={{ rotateX: selectionMode ? 360 : 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
              className={cn(
                "flex items-center rounded-full shadow-sm border active:scale-95 transition-colors shrink-0 overflow-hidden",
                selectionMode
                  ? "bg-red-500 border-red-500 text-white"
                  : "bg-white border-gray-100 text-gray-900"
              )}
            >
              <div
                className="flex items-center"
                style={{ gap: '6px', padding: '8px 16px' }}
              >
                {selectionMode ? (
                  <>
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-bold whitespace-nowrap">
                      삭제{selectedIds.size > 0 ? ` ${selectedIds.size}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-normal whitespace-nowrap">닫기</span>
                  </>
                )}
              </div>
            </motion.button>
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
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(notif.id)}
                      onLongPress={handleLongPress}
                      onToggleSelect={handleToggleSelect}
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
