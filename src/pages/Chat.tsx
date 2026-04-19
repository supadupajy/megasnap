"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  receiver_id: string;
  created_at: string;
  is_read: boolean;
}

const isValidUUID = (uuid: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: authUser } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100%');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // 키보드 대응: VisualViewport의 실제 높이를 컨테이너 높이로 설정
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        // 키보드가 올라오면 visualViewport.height가 줄어듭니다.
        // 이 높이를 직접 style.height에 할당하여 브라우저의 강제 스크롤을 방지합니다.
        setViewportHeight(`${window.visualViewport.height}px`);
        
        // 키보드가 올라올 때 항상 최하단으로 스크롤
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
      // 초기 높이 설정
      handleVisualViewportResize();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
    };
  }, []);

  // 메시지 로드 및 구독 로직
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!chatId) return;
      if (!isValidUUID(chatId)) {
        const room = chatStore.getRoom(chatId);
        setOtherUser(room?.user || { nickname: `Explorer_${chatId}`, avatar_url: `https://i.pravatar.cc/150?u=${chatId}` });
        setIsLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', chatId).single();
      setOtherUser(data || { nickname: '사용자', avatar_url: null });
      setIsLoading(false);
    };
    fetchOtherUser();
  }, [chatId]);

  useEffect(() => {
    if (!authUser || !chatId) return;
    
    const fetchMessages = async () => {
      if (!isValidUUID(chatId)) {
        const room = chatStore.getRoom(chatId);
        if (room) {
          setMessages(room.messages.map(m => ({
            id: m.id.toString(),
            content: m.text,
            sender_id: m.sender === 'me' ? authUser.id : chatId,
            receiver_id: m.sender === 'me' ? chatId : authUser.id,
            created_at: new Date().toISOString(),
            is_read: true
          })));
        }
        return;
      }

      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`)
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data as Message[]);
    };

    fetchMessages();
    
    if (isValidUUID(chatId)) {
      const channel = supabase
        .channel(`chat_${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const newMsg = payload.new as Message;
          if ((newMsg.sender_id === authUser.id && newMsg.receiver_id === chatId) ||
              (newMsg.sender_id === chatId && newMsg.receiver_id === authUser.id)) {
            setMessages(prev => [...prev, newMsg]);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [authUser?.id, chatId]);

  useLayoutEffect(() => {
    scrollToBottom('auto');
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = inputValue.trim();
    if (!content || !authUser || !chatId || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsSending(true);
    setInputValue('');

    if (isValidUUID(chatId)) {
      try {
        const { error } = await supabase.from('messages').insert([{
          sender_id: authUser.id,
          receiver_id: chatId,
          content: content,
          is_read: false
        }]);
        if (error) throw error;
      } catch (err) {
        showError('메시지 전송에 실패했습니다.');
        setInputValue(content);
      } finally {
        isProcessingRef.current = false;
        setIsSending(false);
        inputRef.current?.focus();
      }
    } else {
      chatStore.addMessage(chatId, content, 'me');
      isProcessingRef.current = false;
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  if (isLoading) return <div className="h-full flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;

  return (
    /* 
      fixed inset-0으로 고정하고, style={{ height: viewportHeight }}를 통해 
      키보드가 올라온 만큼만 높이를 차지하게 합니다. 
      이렇게 하면 브라우저가 페이지 전체를 위로 밀어 올리지 않습니다.
    */
    <div 
      className="fixed inset-0 bg-white flex flex-col overflow-hidden z-[1000]"
      style={{ height: viewportHeight }}
    >
      {/* 1. 상단 헤더 (고정 높이) */}
      <header className="h-[88px] pt-8 bg-white/95 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-100 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
              <img 
                src={otherUser?.avatar_url || `https://i.pravatar.cc/150?u=${chatId}`} 
                alt="user" 
                className="w-full h-full rounded-full object-cover border-2 border-white" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-900">{otherUser?.nickname || otherUser?.name || '사용자'}</span>
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

      {/* 2. 중앙 메시지 영역 (남은 공간 차지) */}
      <div 
        ref={scrollRef} 
        className="flex-1 px-4 overflow-y-auto space-y-4 no-scrollbar py-4 bg-white min-h-0"
      >
        {messages.map((msg) => {
          const isMe = msg.sender_id === authUser?.id;
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={msg.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
              <div className={cn("px-4 py-2.5 rounded-[20px] text-sm font-bold shadow-sm", isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none")}>{msg.content}</div>
              <div className="flex items-center gap-1 mt-1 px-1">
                {isMe && <span className="text-[8px] font-black text-indigo-600">{msg.is_read ? '' : '1'}</span>}
                <span className="text-[9px] text-gray-400 font-bold">{time}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. 하단 입력창 (키보드 바로 위 고정) */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0 z-10">
        <form 
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-2 border border-gray-100 shadow-inner"
        >
          <Input 
            ref={inputRef}
            placeholder="메시지 보내기..." 
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-10 font-bold" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            autoFocus={true}
          />
          <Button 
            type="submit"
            size="icon" 
            disabled={!inputValue.trim() || isSending} 
            className={cn("w-10 h-10 rounded-full transition-all shadow-lg", (inputValue.trim() && !isSending) ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-200 text-gray-400")}
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;