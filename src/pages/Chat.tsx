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
const INPUT_AREA_HEIGHT = 72;

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ✅ 핵심: visualViewport 기준으로 헤더와 입력창을 JS로 직접 위치 고정
  // resizes-content 모드에서 뷰포트가 스크롤되면 offsetTop이 변하는데,
  // 이 값을 이용해 헤더/입력창을 항상 시각적 뷰포트 안에 고정시킴
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;

    const handleViewport = () => {
      const offsetTop = vp.offsetTop ?? 0;
      const keyboardHeight = window.innerHeight - vp.height - offsetTop;

      // 헤더: 시각적 뷰포트 상단에 고정
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(${offsetTop}px)`;
      }

      // 입력창: 시각적 뷰포트 하단(키보드 바로 위)에 고정
      if (inputRef.current) {
        const bottomOffset = Math.max(0, keyboardHeight);
        inputRef.current.style.transform = `translateY(-${bottomOffset}px)`;
      }

      // 메시지 영역 하단 패딩: 입력창 + 키보드 높이만큼 확보
      if (scrollRef.current) {
        const bottomPad = INPUT_AREA_HEIGHT + Math.max(0, keyboardHeight) + 16;
        scrollRef.current.style.paddingBottom = `${bottomPad}px`;
      }

      setTimeout(scrollToBottom, 50);
    };

    // 초기값 설정
    handleViewport();

    vp.addEventListener('resize', handleViewport);
    vp.addEventListener('scroll', handleViewport);
    return () => {
      vp.removeEventListener('resize', handleViewport);
      vp.removeEventListener('scroll', handleViewport);
      // 클린업: transform 초기화
      if (headerRef.current) headerRef.current.style.transform = '';
      if (inputRef.current) inputRef.current.style.transform = '';
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
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authUser, chatId]);

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

      {/* ✅ 헤더: fixed + JS translateY로 시각적 뷰포트 상단에 항상 고정 */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-100 will-change-transform"
        style={{
          height: `${HEADER_HEIGHT}px`,
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

      {/* ✅ 메시지 영역: 헤더/입력창 높이만큼 padding 확보, 나머지는 스크롤 */}
      <div
        ref={scrollRef}
        className="overflow-y-auto px-4 space-y-4 no-scrollbar"
        style={{
          height: '100dvh',
          paddingTop: `${HEADER_HEIGHT + 16}px`,
          paddingBottom: `${INPUT_AREA_HEIGHT + 16}px`,
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

      {/* ✅ 입력창: fixed bottom-0 + JS translateY로 키보드 바로 위에 고정 */}
      <div
        ref={inputRef}
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 bg-white/95 backdrop-blur-md border-t border-gray-100 will-change-transform"
        style={{
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-2 border border-gray-100 shadow-inner">
          <Input
            placeholder="메시지 보내기..."
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-10 font-bold"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              'w-10 h-10 rounded-full transition-all shadow-lg',
              inputValue.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-200 text-gray-400'
            )}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;