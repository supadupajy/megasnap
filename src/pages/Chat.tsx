"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronLeft, Send, MoreVertical, Phone, Video, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';
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
  const { keyboardHeight } = useKeyboard();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const markAsRead = async () => {
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
      
      if (!error) {
        chatStore.markAsRead(chatId);
      }
    } catch (err) {
      console.error('[Chat] markAsRead error:', err);
    }
  };

  const fetchMessages = async () => {
    if (!authUser || !chatId || !isValidUUID(chatId)) return;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
      await markAsRead();
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  };

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

    if (!isValidUUID(chatId)) {
      const room = chatStore.getRoom(chatId);
      if (room) {
        const formatted = room.messages.map(m => ({
          id: m.id.toString(),
          content: m.text,
          sender_id: m.sender === 'me' ? authUser.id : chatId,
          receiver_id: m.sender === 'me' ? chatId : authUser.id,
          created_at: new Date().toISOString(),
          is_read: true
        }));
        setMessages(formatted);
      }
      markAsRead();
      setIsLoading(false);
      return;
    }

    fetchMessages();

    const channelId = `chat_room_${[authUser.id, chatId].sort().join('_')}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as Message;
          
          // 1. 내가 보낸 메시지는 handleSend에서 이미 추가했으므로 무시합니다.
          if (newMsg.sender_id === authUser.id) return;

          // 2. 상대방이 보낸 메시지인 경우에만 추가합니다.
          if (newMsg.sender_id === chatId && newMsg.receiver_id === authUser.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            markAsRead();
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      })
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => { 
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authUser, chatId]);

  useLayoutEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !authUser || !chatId) return;
    const content = inputValue.trim();
    setInputValue('');

    if (isValidUUID(chatId)) {
      const { data, error } = await supabase.from('messages').insert([{
        sender_id: authUser.id,
        receiver_id: chatId,
        content: content,
        is_read: false
      }]).select().single();
      
      if (error) {
        showError('메시지 전송에 실패했습니다.');
        setInputValue(content);
      } else if (data) {
        // 내가 보낸 메시지는 즉시 화면에 추가 (낙관적 업데이트)
        setMessages(prev => [...prev, data as Message]);
      }
    } else {
      chatStore.addMessage(chatId, content, 'me');
    }
  };

  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) navigate(-1);
    else navigate('/messages');
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-1 hover:bg-gray-50 rounded-full transition-colors"><ChevronLeft className="w-6 h-6 text-gray-800" /></button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${chatId}`)}>
              <img src={otherUser?.avatar_url || `https://i.pravatar.cc/150?u=${chatId}`} alt="user" className="w-full h-full rounded-full object-cover border-2 border-white" />
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

      <div ref={scrollRef} className="flex-1 pt-[100px] px-4 overflow-y-auto space-y-4 no-scrollbar transition-all duration-300" style={{ paddingBottom: keyboardHeight > 0 ? '20px' : '120px' }}>
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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 transition-all duration-300 z-50" style={{ transform: `translateY(-${keyboardHeight}px)`, paddingBottom: keyboardHeight > 0 ? '16px' : '40px' }}>
        <div className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-2 border border-gray-100 shadow-inner">
          <Input placeholder="메시지 보내기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-10 font-bold" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
          <Button size="icon" onClick={handleSend} disabled={!inputValue.trim()} className={cn("w-10 h-10 rounded-full transition-all shadow-lg", inputValue.trim() ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-200 text-gray-400")}><Send className="w-5 h-5" /></Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;