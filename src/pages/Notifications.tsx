"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trash2, Loader2, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const Notifications = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    
    const fetchNotifications = async () => {
      try {
        const { data: notifs, error: notifError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

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

          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', authUser.id)
            .eq('is_read', false);
        } else {
          setNotifications([]);
        }
      } catch (error) {
        console.error('[Notifications] Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    const channelName = `realtime_notifs_page_${authUser.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${authUser.id}` 
      }, async (payload) => {
        const { data: actorProfile } = await supabase
          .from('profiles')
          .select('nickname, avatar_url')
          .eq('id', payload.new.actor_id)
          .single();
        
        const newNotif = { 
          ...payload.new, 
          actor: actorProfile || { nickname: '알 수 없는 사용자', avatar_url: null } 
        } as Notification;
        
        setNotifications(prev => [newNotif, ...prev]);
      })
      .subscribe();

    return () => { 
      channel.unsubscribe();
      supabase.removeChannel(channel); 
    };
  }, [authUser]);

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSwipedId(null);
    }
  };

  const getNotificationText = (notif: Notification) => {
    switch (notif.type) {
      case 'follow': return '님이 회원님을 팔로우하기 시작했습니다.';
      case 'like_post': return '님이 회원님의 포스팅을 좋아합니다.';
      case 'comment': return `님이 댓글을 남겼습니다: "${notif.content}"`;
      case 'message': return `님이 메시지를 보냈습니다: "${notif.content}"`;
      default: return '님이 활동을 남겼습니다.';
    }
  };

  const handleNotifClick = (notif: Notification) => {
    // 스와이프된 상태라면 이동하지 않고 닫기만 함
    if (swipedId) {
      setSwipedId(null);
      return;
    }

    if (notif.type === 'message') navigate(`/chat/${notif.actor_id}`);
    else if (notif.post_id) navigate('/', { state: { postId: notif.post_id } });
    else navigate(`/profile/${notif.actor_id}`);
  };

  return (
    <div 
      className="h-screen overflow-y-auto bg-white pb-24 no-scrollbar"
      onClick={() => setSwipedId(null)}
    >
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-50 flex items-center px-4 border-b border-gray-100">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-gray-50 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-lg text-gray-900 mr-10">알림</h1>
      </header>

      <div className="pt-[88px] flex flex-col">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="py-4">
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {notifications.map((notif) => {
                  const isSwiped = swipedId === notif.id;
                  return (
                    <div key={notif.id} className="relative group overflow-hidden">
                      {/* 삭제 버튼 배경 */}
                      <div className="absolute inset-0 bg-red-500 flex justify-end items-center pr-6">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }} 
                          className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"
                        >
                          <Trash2 className="w-6 h-6" />
                          <span className="text-[10px] font-bold">삭제</span>
                        </button>
                      </div>

                      {/* 알림 콘텐츠 레이어 */}
                      <motion.div 
                        drag="x" 
                        dragConstraints={{ left: -80, right: 0 }} 
                        dragElastic={0.1}
                        animate={{ x: isSwiped ? -80 : 0 }}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -40) {
                            setSwipedId(notif.id);
                          } else {
                            setSwipedId(null);
                          }
                        }}
                        className={cn(
                          "relative bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-50 z-10 cursor-pointer active:bg-gray-50 transition-colors", 
                          !notif.is_read && "bg-indigo-50/30"
                        )} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotifClick(notif);
                        }}
                      >
                        <Avatar className="w-11 h-11 shrink-0 border border-gray-100">
                          <AvatarImage src={notif.actor?.avatar_url || `https://i.pravatar.cc/150?u=${notif.actor_id}`} />
                          <AvatarFallback>{notif.actor?.nickname?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-sm leading-tight">
                          <span className="font-bold">{notif.actor?.nickname || '알 수 없는 사용자'}</span>
                          <span className="text-gray-700"> {getNotificationText(notif)}</span>
                          <span className="text-[10px] text-gray-400 ml-2 block mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
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
  );
};

export default Notifications;