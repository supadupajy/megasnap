"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
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
  actor: {
    nickname: string;
    avatar_url: string;
  };
}

const Notifications = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authUser) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(nickname, avatar_url)
        `)
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data as any);
        // 페이지 진입 시 모든 알림 읽음 처리
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', authUser.id)
          .eq('is_read', false);
      }
      setIsLoading(false);
    };

    fetchNotifications();

    // 실시간 구독
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` },
        async (payload) => {
          const { data: actorProfile } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', payload.new.actor_id)
            .single();
          
          const newNotif = { ...payload.new, actor: actorProfile } as Notification;
          setNotifications(prev => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const getNotificationText = (notif: Notification) => {
    switch (notif.type) {
      case 'follow': return '님이 회원님을 팔로우하기 시작했습니다.';
      case 'like_post': return '님이 회원님의 포스팅을 좋아합니다.';
      case 'comment': return `님이 댓글을 남겼습니다: ${notif.content}`;
      default: return '님이 활동을 남겼습니다.';
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="mr-4 p-1 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="font-bold text-lg text-gray-900">알림</h1>
      </header>

      <div className="pt-[88px] flex flex-col">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="py-4">
            <h2 className="text-sm font-bold text-gray-900 mb-4 px-4">최근 알림</h2>
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {notifications.map((notif) => (
                  <div key={notif.id} className="relative group overflow-hidden">
                    <div className="absolute inset-0 bg-red-500 flex justify-end items-center pr-6">
                      <button 
                        onClick={() => deleteNotification(notif.id)}
                        className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"
                      >
                        <Trash2 className="w-6 h-6" />
                        <span className="text-[10px] font-bold">삭제</span>
                      </button>
                    </div>

                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -80, right: 0 }}
                      dragElastic={0.1}
                      className={cn(
                        "relative bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-50 z-10 cursor-pointer",
                        !notif.is_read && "bg-indigo-50/30"
                      )}
                      onClick={() => notif.post_id && navigate('/', { state: { postId: notif.post_id } })}
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
                ))}
              </AnimatePresence>
              {notifications.length === 0 && (
                <div className="py-20 text-center text-gray-400 font-medium">
                  새로운 알림이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Notifications;