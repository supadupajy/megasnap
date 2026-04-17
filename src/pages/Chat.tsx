"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Send, MoreVertical, Phone, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';
import { chatStore } from '@/utils/chat-store';

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { keyboardHeight } = useKeyboard();
  
  const [room, setRoom] = useState(chatStore.getRoom(chatId || ''));
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatId) {
      chatStore.markAsRead(chatId);
      setRoom(chatStore.getRoom(chatId));
    }
    
    const unsubscribe = chatStore.subscribe(() => {
      if (chatId) setRoom(chatStore.getRoom(chatId));
    });
    return () => { unsubscribe(); };
  }, [chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [room?.messages, keyboardHeight]);

  const handleBack = () => {
    navigate('/messages');
  };

  const handleSend = () => {
    if (!inputValue.trim() || !chatId) return;
    chatStore.addMessage(chatId, inputValue.trim(), 'me');
    setInputValue('');
    
    // 1초 후 자동 응답 (데모용)
    setTimeout(() => {
      if (chatId === 'travel_maker' || chatId === 'seoul_snap') {
        chatStore.addMessage(chatId, "메시지 확인했습니다! 곧 답변 드릴게요. 😊", 'other');
      }
    }, 1500);
  };

  const handleAvatarClick = () => {
    navigate(`/profile/${chatId}`);
  };

  if (!room) return null;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div className="flex items-center gap-2">
            <div 
              className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer active:scale-95 transition-transform"
              onClick={handleAvatarClick}
            >
              <img 
                src={room.user.avatar} 
                alt="user" 
                className="w-full h-full rounded-full object-cover border-2 border-white" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-900">{room.user.name}</span>
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

      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 pt-[100px] px-4 overflow-y-auto space-y-4 no-scrollbar transition-all duration-300"
        style={{ paddingBottom: keyboardHeight > 0 ? '20px' : '120px' }}
      >
        <div className="flex justify-center my-6">
          <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
            오늘
          </span>
        </div>

        {room.messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex flex-col max-w-[85%]",
              msg.sender === 'me' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div 
              className={cn(
                "px-4 py-2.5 rounded-[20px] text-sm font-bold shadow-sm",
                msg.sender === 'me' 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-gray-100 text-gray-800 rounded-tl-none"
              )}
            >
              {msg.text}
            </div>
            <span className="text-[9px] text-gray-400 mt-1 px-1 font-bold">{msg.time}</span>
          </div>
        ))}
        
        {room.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-indigo-600 opacity-20" />
            </div>
            <p className="text-sm text-gray-400 font-bold">{room.user.name} 님에게<br/>첫 메시지를 보내보세요!</p>
          </div>
        )}
      </div>

      {/* Input Area */}
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