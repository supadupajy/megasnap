"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, Send, MoreVertical, Phone, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';

const CHAT_DATA: Record<string, any[]> = {
  'travel_maker': [
    { id: 1, text: "안녕하세요! 성수동 카페 정보 좀 알려주실 수 있나요?", sender: 'other', time: '오후 2:12' },
    { id: 2, text: "네, 당연하죠! 어떤 스타일의 카페를 찾으시나요?", sender: 'me', time: '오후 2:15' },
    { id: 3, text: "조용하고 작업하기 좋은 곳이면 좋겠어요.", sender: 'other', time: '오후 2:16' },
    { id: 4, text: "그렇다면 '카페 어니언'이나 '대림창고' 보다는 '로우키'를 추천드려요. 커피 맛도 훌륭하고 분위기도 차분하거든요.", sender: 'me', time: '오후 2:18' },
    { id: 5, text: "오! 감사합니다. 바로 가봐야겠네요!", sender: 'other', time: '오후 2:20' },
  ],
  'seoul_snap': [
    { id: 1, text: "작가님 어제 올리신 남산 타워 사진 정말 멋져요!", sender: 'me', time: '오전 10:05' },
    { id: 2, text: "감사합니다! 날씨가 좋아서 운이 좋았네요.", sender: 'other', time: '오전 10:30' },
    { id: 3, text: "혹시 보정은 어떤 프로그램 사용하시나요?", sender: 'me', time: '오전 10:32' },
    { id: 4, text: "저는 주로 라이트룸으로 색감 보정을 하고 있어요.", sender: 'other', time: '오전 11:00' },
    { id: 5, text: "사진 너무 잘 찍으시네요! 👍", sender: 'other', time: '오전 11:05' },
  ],
  'explorer_kim': [
    { id: 1, text: "이번 주말에 경복궁 야간 개장 가시나요?", sender: 'other', time: '어제' },
    { id: 2, text: "아직 고민 중이에요. 사람 많을 것 같아서요.", sender: 'me', time: '어제' },
    { id: 3, text: "그래도 야경이 정말 예쁘다고 하더라고요.", sender: 'other', time: '어제' },
    { id: 4, text: "그럼 일요일 저녁쯤 어떠세요?", sender: 'me', time: '오전 9:15' },
    { id: 5, text: "좋아요! 다음에 같이 출사 가요!", sender: 'other', time: '오전 9:20' },
  ]
};

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { keyboardHeight } = useKeyboard();
  const initialMessages = useMemo(() => (chatId && CHAT_DATA[chatId]) || CHAT_DATA['travel_maker'], [chatId]);
  
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, keyboardHeight]);

  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/messages');
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([...messages, newMessage]);
    setInputValue('');
  };

  const handleAvatarClick = () => {
    navigate(`/profile/${chatId}`);
  };

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
                src={`https://i.pravatar.cc/150?u=${chatId}`} 
                alt="user" 
                className="w-full h-full rounded-full object-cover border-2 border-white" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900">{chatId}</span>
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
        style={{ paddingBottom: keyboardHeight > 0 ? '20px' : '100px' }}
      >
        <div className="flex justify-center my-6">
          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest">
            2024년 5월 20일
          </span>
        </div>

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex flex-col max-w-[80%]",
              msg.sender === 'me' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div 
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm",
                msg.sender === 'me' 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-gray-100 text-gray-800 rounded-tl-none"
              )}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.time}</span>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 transition-all duration-300 z-50"
        style={{ transform: `translateY(-${keyboardHeight}px)`, paddingBottom: keyboardHeight > 0 ? '16px' : '32px' }}
      >
        <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2 border border-gray-100">
          <Input 
            placeholder="메시지 보내기..." 
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-10"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              "w-10 h-10 rounded-xl transition-all",
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