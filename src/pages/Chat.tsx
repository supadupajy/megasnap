"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Send, MoreVertical, Phone, Video, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showError } from '@/utils/toast';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams(); // 상대방의 userId
  const { user: authUser } = useAuth();
  const { keyboardHeight } = useKeyboard();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 상대방 프로필 정보 가져오기
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!chatId) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url')
        .eq('id', chatId)
        .single();
      
      if (!error && data) {
        setOtherUser(data);
      }
    };
    fetchOtherUser();
  }, [chatId]);

  // 메시지 내역 가져오기 및 실시간 구독
  useEffect(() => {
    if (!authUser || !chatId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
      setIsLoading(false);
    };

    fetchMessages();

    // 실시간 구독 설정
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${chatId},receiver_id=eq.${authUser.id}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, keyboardHeight]);

  const handleSend = async () => {
    if (!inputValue.trim() || !authUser || !chatId) return;

    const newMessage = {
      sender_id: authUser.id,
      receiver_id: chatId,
      content: inputValue.trim(),
    };

    // 낙관적 업데이트 (UI에 즉시 반영)
    const tempId = Math.random().toString();
    const optimisticMsg: Message = {
      id: tempId,
      content: newMessage.content,
      sender_id: authUser.id,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');

    const { error } = await supabase.from('messages').insert([newMessage]);

    if (error) {
      showError('메시지 전송에 실패했습니다.');
      setMessages((prev) => prev.filter(m => m.id !== tempId));
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
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
              <span className="text-sm font-black text-gray-900">{otherUser?.nickname || '사용자'}</span>
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
        className="flex-1 pt-[100px] px-4 overflow-y-auto space-y-4 no-scrollbar transition-all duration-300"
        style={{ paddingBottom: keyboardHeight > 0 ? '20px' : '120px' }}
      >
        {messages.map((msg) => {
          const isMe = msg.sender_id === authUser?.id;
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          return (
            <div 
              key={msg.id} 
              className={cn(
                "flex flex-col max-w-[85%]",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div 
                className={cn(
                  "px-4 py-2.5 rounded-[20px] text-sm font-bold shadow-sm",
                  isMe 
                    ? "bg-indigo-600 text-white rounded-tr-none" 
                    : "bg-gray-100 text-gray-800 rounded-tl-none"
                )}
              >
                {msg.content}
              </div>
              <span className="text-[9px] text-gray-400 mt-1 px-1 font-bold">{time}</span>
            </div>
          );
        })}
        
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-indigo-600 opacity-20" />
            </div>
            <p className="text-sm text-gray-400 font-bold">대화를 시작해보세요!</p>
          </div>
        )}
      </div>

      <div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 transition-all duration-300 z-50"
        style={{ transform: `translateY(-${keyboardHeight}px)`, paddingBottom: keyboardHeight > 0 ? '16px' : '40px' }}
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
              "w-10 h-10 rounded-full transition-all shadow-lg",
              inputValue.trim() ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-200 text-gray-400"
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