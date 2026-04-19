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
import { useKeyboard } from '@/hooks/use-keyboard';

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
  const { keyboardHeight, isKeyboardOpen, setIsKeyboardOpenManual } = useKeyboard();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
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
  }, [messages.length, isKeyboardOpen]);

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

  return (
    <div 
      className="relative flex flex-col w-full h-full bg-white overflow-hidden"
      style={{ paddingBottom: isKeyboardOpen ? `${keyboardHeight}px` : 0 }}
    >
      <header className="h-[88px] pt-8 bg-white/95 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
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

      <div 
        ref={scrollRef} 
        className="flex-1 px-4 overflow-y-auto space-y-4 no-scrollbar py-4 bg-white"
        onClick={() => setIsKeyboardOpenManual(false)}
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

      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
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
            onFocus={() => setIsKeyboardOpenManual(true)}
            onClick={(e) => {
              e.stopPropagation();
              setIsKeyboardOpenManual(true);
            }}
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