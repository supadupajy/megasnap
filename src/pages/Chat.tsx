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
  created_at: string;
}

interface OtherUser {
  nickname: string;
  avatar_url: string | null;
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
          setOtherUser({ nickname: room.user.name, avatar_url: room.user.avatar });
        } else {
          setOtherUser({
            nickname: `Explorer_${chatId}`,
            avatar_url: `https://i.pravatar.cc/150?u=${chatId}`,
          });
        }
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('nickname, avatar_url')
        .eq('id', chatId)
        .single();
      setOtherUser(data || { nickname: '사용자', avatar_url: null });
      setIsLoading(false);
    };
    fetchOtherUser();
  }, [chatId]);

  useEffect(() => {
    if (!authUser || !chatId) return;

    if (!isValidUUID(chatId)) {
      const room = chatStore.getRoom(chatId);
      if (room) {
        const formatted = room.messages.map((m) => ({
          id: m.id.toString(),
          content: m.text,
          sender_id: m.sender === 'me' ? authUser.id : chatId,
          created_at: new Date().toISOString(),
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
          filter: `receiver_id=eq.${authUser.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === chatId) {
            setMessages((prev) => [...prev, newMsg]);
            markAsRead();
          }
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
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');

    if (isValidUUID(chatId)) {
      const { error } = await supabase.from('messages').insert([
        { sender_id: authUser.id, receiver_id: chatId, content },
      ]);

      if (error) {
        showError('메시지 전송에 실패했습니다.');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
        className="fixed top-0 left-0 right-0 h-[88px] z-50 bg-white/90 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-100 will-change-transform"
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
              className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer"
              onClick={() => navigate(`/profile/${chatId}`)}
            >
              <img
                src={otherUser?.avatar_url || `https://i.pravatar.cc/150?u=${chatId}`}
                alt="user"
                className="w-full h-full rounded-full object-cover border-2 border-white"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-900">
                {otherUser?.nickname || '사용자'}
              </span>
              <span className="text-[10px] text-indigo-600 font-bold">현재 활동 중</span>
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
              <span className="text-[9px] text-gray-400 mt-1 px-1 font-bold">{time}</span>
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