"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, MoreVertical, Phone, Video, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showError } from '@/utils/toast';
import { chatStore } from '@/utils/chat-store';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id?: string;
  created_at: string;
  is_read?: boolean | null;
}

interface OtherUser {
  nickname: string;
  avatar_url: string | null;
  last_seen: string | null;
}

const isValidUUID = (uuid: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

const HEADER_HEIGHT = 88;

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: authUser } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 메시지 읽음 처리 함수
  const markAsRead = useCallback(async () => {
    if (!authUser || !chatId || !isValidUUID(chatId)) {
      if (chatId) chatStore.markAsRead(chatId);
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('receiver_id', authUser.id)
        .eq('sender_id', chatId)
        .eq('is_read', false);

      if (error) throw error;
      chatStore.markAsRead(chatId);
    } catch (err) {
      console.error('[Chat] Failed to mark as read:', err);
    }
  }, [authUser, chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;

    const handleViewport = () => {
      const offsetTop = vp.offsetTop ?? 0;
      const keyboardHeight = window.innerHeight - vp.height - offsetTop;
      const isKeyboardOpen = keyboardHeight > 100;

      // 1. 헤더 위치 조정
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(${offsetTop}px)`;
      }

      // 2. 입력창 위치 및 여백 조정 (Flutter의 SafeArea + viewInsets 로직)
      if (inputRef.current) {
        const bottomOffset = Math.max(0, keyboardHeight);
        inputRef.current.style.transform = `translateY(-${bottomOffset}px)`;
        
        // 키보드가 열리면 하단 여백을 8px로 줄여 밀착시키고, 
        // 닫히면 env(safe-area-inset-bottom)을 사용하여 네비게이션 바를 피함
        inputRef.current.style.paddingBottom = isKeyboardOpen 
          ? '8px' 
          : 'calc(12px + env(safe-area-inset-bottom))';
      }

      // 3. 스크롤 영역 하단 패딩 동적 계산
      if (scrollRef.current) {
        const inputHeight = inputRef.current?.offsetHeight || 60;
        const bottomPad = inputHeight + Math.max(0, keyboardHeight) + 16;
        scrollRef.current.style.paddingBottom = `${bottomPad}px`;
      }

      setTimeout(scrollToBottom, 50);
    };

    handleViewport();

    vp.addEventListener('resize', handleViewport);
    vp.addEventListener('scroll', handleViewport);
    return () => {
      vp.removeEventListener('resize', handleViewport);
      vp.removeEventListener('scroll', handleViewport);
    };
  }, [scrollToBottom]);

  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!chatId) return;

      if (!isValidUUID(chatId)) {
        const room = chatStore.getRoom(chatId);
        if (room) {
          setOtherUser({ nickname: room.user.name, avatar_url: room.user.avatar, last_seen: null });
        } else {
          setOtherUser({
            nickname: `Explorer_${chatId}`,
            avatar_url: `https://i.pravatar.cc/150?u=${chatId}`,
            last_seen: null
          });
        }
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, last_seen')
        .eq('id', chatId)
        .single();
      
      if (data) {
        setOtherUser({
          nickname: data.nickname || '사용자',
          avatar_url: data.avatar_url,
          last_seen: data.last_seen
        });
        
        // 초기 온라인 상태 즉시 계산
        if (data.last_seen) {
          const lastSeen = new Date(data.last_seen);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
          setIsOnline(diffMinutes < 5);
        }
      }
      setIsLoading(false);
    };

    fetchOtherUser();

    // Subscribe to profile changes for real-time online status
    let channel: any;
    if (chatId && isValidUUID(chatId)) {
      channel = supabase
        .channel(`online-status-${chatId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${chatId}`
          },
          (payload) => {
            console.log('[Chat] Profile update received:', payload.new.last_seen);
            setOtherUser(prev => prev ? ({ ...prev, last_seen: payload.new.last_seen }) : null);
          }
        )
        .subscribe((status) => {
          console.log(`[Chat] Realtime subscription status for ${chatId}:`, status);
        });
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };

  }, [chatId]);

  useEffect(() => {
    if (!otherUser?.last_seen) {
      setIsOnline(false);
      return;
    }

    const checkOnline = () => {
      const lastSeen = new Date(otherUser.last_seen!);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
      setIsOnline(diffMinutes < 5);
    };

    checkOnline();
    const interval = setInterval(checkOnline, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [otherUser?.last_seen]);

  useEffect(() => {
    if (!authUser || !chatId) return;

    if (!isValidUUID(chatId)) {
      const room = chatStore.getRoom(chatId);
      if (room) {
        const formatted = room.messages.map((m) => ({
          id: m.id.toString(),
          content: m.text,
          sender_id: m.sender === 'me' ? authUser.id : chatId,
          receiver_id: m.sender === 'me' ? chatId : authUser.id,
          created_at: new Date().toISOString(),
          is_read: m.sender === 'other',
        }));
        setMessages(formatted);
        markAsRead();
      }
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`
        )
        .order('created_at', { ascending: true });

      setMessages(data || []);
      setIsLoading(false);
      markAsRead();
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          const isCurrentConversation =
            (newMsg.sender_id === chatId && newMsg.receiver_id === authUser.id) ||
            (newMsg.sender_id === authUser.id && newMsg.receiver_id === chatId);

          if (!isCurrentConversation) return;

          setMessages((prev) => {
            const withoutDuplicate = prev.filter((msg) => msg.id !== newMsg.id);
            return [...withoutDuplicate, newMsg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
          });

          if (newMsg.sender_id === chatId) {
            markAsRead();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${authUser.id}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          if (updatedMsg.receiver_id !== chatId) return;

          setMessages((prev) =>
            prev.map((msg) => (msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authUser, chatId, markAsRead]);

  const handleSend = async () => {
    if (!inputValue.trim() || !authUser || !chatId) return;

    const content = inputValue.trim();
    const tempId = Math.random().toString();
    const optimisticMsg: Message = {
      id: tempId,
      content,
      sender_id: authUser.id,
      receiver_id: chatId,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');

    if (isValidUUID(chatId)) {
      // 1. 메시지 저장
      const { data, error } = await supabase
        .from('messages')
        .insert([{ sender_id: authUser.id, receiver_id: chatId, content }])
        .select('*')
        .single();

      if (error) {
        showError('메시지 전송에 실패했습니다.');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      // 2. 상대방에게 알림 생성 (실시간 뱃지용)
      await supabase.from('notifications').insert([{
        user_id: chatId,
        type: 'message',
        title: '새 메시지',
        content: content.length > 20 ? content.substring(0, 20) + '...' : content,
        is_read: false,
        related_id: authUser.id
      }]);

      if (data) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? data : msg))
        );
      }
    } else {
      chatStore.getOrCreateRoom(
        chatId,
        otherUser?.nickname || `Explorer_${chatId}`,
        otherUser?.avatar_url || ''
      );
      chatStore.addMessage(chatId, content, 'me');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center bg-white" style={{ height: '100dvh' }}>
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white overflow-hidden" style={{ height: '100dvh' }}>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 h-[88px] z-50 bg-white flex items-center justify-between px-4 border-b border-gray-100 will-change-transform"
        style={{
          paddingTop: 'max(32px, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-gray-50 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer relative"
              onClick={() => navigate(`/profile/${chatId}`)}
            >
              <img
                src={otherUser?.avatar_url || `https://i.pravatar.cc/150?u=${chatId}`}
                alt="user"
                className="w-full h-full rounded-full object-cover border-2 border-white"
              />
              <div className={cn(
                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white z-10 transition-colors duration-300",
                isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-400"
              )} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-900">
                {otherUser?.nickname || '사용자'}
              </span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-tight transition-colors duration-300",
                  isOnline ? "text-green-500" : "text-gray-400"
                )}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

        </div>
        <div className="flex items-center gap-3">
          <button className="p-1 text-gray-600"><Phone className="w-5 h-5" /></button>
          <button className="p-1 text-gray-600"><Video className="w-5 h-5" /></button>
          <button className="p-1 text-gray-600"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="overflow-y-auto px-4 space-y-4 no-scrollbar"
        style={{
          height: '100dvh',
          paddingTop: `${HEADER_HEIGHT + 16}px`,
        }}
      >
        {messages.map((msg) => {
          const isMe = msg.sender_id === authUser?.id;
          const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[85%]',
                isMe ? 'ml-auto items-end' : 'mr-auto items-start'
              )}
            >
              <div
                className={cn(
                  'px-4 py-2.5 rounded-[20px] text-sm font-bold shadow-sm',
                  isMe
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                )}
              >
                {msg.content}
              </div>
              <div className={cn('mt-1 px-1 flex items-center gap-1.5', isMe ? 'justify-end' : 'justify-start')}>
                {isMe && (
                  <span className="text-[9px] text-gray-400 font-bold">
                    {msg.is_read ? '읽음' : '읽지 않음'}
                  </span>
                )}
                <span className="text-[9px] text-gray-400 font-bold">{time}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={inputRef}
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-2 bg-white/95 backdrop-blur-md border-t border-gray-100 will-change-transform"
        style={{
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-1.5 border border-gray-100 shadow-inner">
          <Input
            placeholder="메시지 보내기..."
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-8 font-bold"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              'w-8 h-8 rounded-full transition-all shadow-lg',
              inputValue.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-200 text-gray-400'
            )}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;