"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, Loader2, Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useNotifications } from '@/components/NotificationProvider';
import { chatStore } from '@/utils/chat-store';
import HeaderAdBanner from '@/components/HeaderAdBanner';

const IN_CHAT_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';
const OUT_CHAT_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

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

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: authUser } = useAuth();
  // ✅ 전역 Context에서 뱃지 카운트 가져옴 — 자체 채널/상태 없음
  const { unreadMessages, unreadNotifs } = useNotifications();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const isPageVisibleRef = useRef(isPageVisible);
  useEffect(() => { isPageVisibleRef.current = isPageVisible; }, [isPageVisible]);

  // activeChatId 등록 (Header의 messages 채널이 현재 채팅방 메시지를 필터링하는 데 사용)
  useEffect(() => {
    if (chatId) {
      localStorage.setItem('activeChatId', chatId);
      window.dispatchEvent(new Event('storage'));
      return () => {
        localStorage.removeItem('activeChatId');
        window.dispatchEvent(new Event('storage'));
      };
    }
  }, [chatId]);

  const handleBack = useCallback(() => {
    localStorage.removeItem('activeChatId');
    // 메시지는 오버레이로 동작하므로, Chat에서 뒤로가면 홈으로 가면서
    // 메시지 오버레이를 열어 자연스러운 흐름을 만든다.
    navigate('/', { replace: true, state: { direction: 'back' } });
    window.dispatchEvent(new CustomEvent('open-messages-overlay'));
  }, [navigate]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
    }
  }, []);

  // 오디오 잠금 해제 (모바일 브라우저 정책)
  useEffect(() => {
    const enableAudio = () => {
      const unlockAudio = new Audio(IN_CHAT_SOUND);
      unlockAudio.volume = 0;
      unlockAudio.play().then(() => {
        window.removeEventListener('click', enableAudio);
        window.removeEventListener('touchstart', enableAudio);
      }).catch(() => {});
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('touchstart', enableAudio);
    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const playNotificationSound = useCallback((inChat: boolean) => {
    try {
      const audio = new Audio(inChat ? IN_CHAT_SOUND : OUT_CHAT_SOUND);
      audio.volume = inChat ? 0.5 : 1.0;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  const markAsRead = useCallback(async () => {
    if (!authUser || !chatId || !isValidUUID(chatId)) {
      if (chatId) chatStore.markAsRead(chatId);
      return;
    }
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('receiver_id', authUser.id)
        .eq('sender_id', chatId)
        .eq('is_read', false);
      chatStore.markAsRead(chatId);
      // 로컬 메시지 상태도 즉시 is_read: true로 업데이트 (화면 반영)
      setMessages(prev =>
        prev.map(msg =>
          msg.receiver_id === authUser.id && msg.sender_id === chatId && !msg.is_read
            ? { ...msg, is_read: true }
            : msg
        )
      );
      // NotificationProvider가 이 이벤트를 받아 카운트를 갱신함
      window.dispatchEvent(new CustomEvent('refresh-unread-counts'));
    } catch (err) {}
  }, [authUser, chatId]);

  // 키보드 대응 — 안드로이드 WebView는 키보드 띄울 때 viewport 자체를 resize함.
  // visualViewport.height와 window.innerHeight 차이가 0이 나오므로 baseline 비교 방식 병용.
  useEffect(() => {
    const vp = window.visualViewport;

    // 페이지 진입 시점의 innerHeight (키보드 없는 상태)를 baseline으로 저장
    let baselineHeight = window.innerHeight;

    const handleViewport = () => {
      const winH = window.innerHeight;
      const vpHeight = vp?.height ?? winH;
      const offsetTop = vp?.offsetTop ?? 0;

      // baseline 갱신 (회전, 주소창 변화 등)
      if (winH > baselineHeight) baselineHeight = winH;

      // 두 가지 방식 중 큰 값 사용
      const standardKbH = Math.max(0, winH - vpHeight - offsetTop);  // iOS Safari
      const fallbackKbH = Math.max(0, baselineHeight - winH);        // Android WebView
      const keyboardHeight = Math.max(standardKbH, fallbackKbH);
      const isKeyboardOpen = keyboardHeight > 100;

      // 채팅 상세 헤더: visualViewport offsetTop 따라가기 (iOS용)
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(${offsetTop}px)`;
      }

      if (inputRef.current) {
        if (isKeyboardOpen) {
          if (standardKbH > 100) {
            // iOS 패턴: visual viewport 하단에 맞춤
            const inputHeight = inputRef.current.offsetHeight || 64;
            const inputTop = offsetTop + vpHeight - inputHeight;
            inputRef.current.style.bottom = 'auto';
            inputRef.current.style.top = `${inputTop}px`;
          } else {
            // 안드로이드 WebView 패턴: bottom: 0
            inputRef.current.style.top = 'auto';
            inputRef.current.style.bottom = '0px';
          }
          inputRef.current.style.transform = 'translateY(0px)';
          inputRef.current.style.paddingBottom = '8px';
        } else {
          inputRef.current.style.top = 'auto';
          inputRef.current.style.bottom = '80px';
          inputRef.current.style.transform = 'translateY(0px)';
          inputRef.current.style.paddingBottom = '12px';
        }
      }

      if (scrollRef.current) {
        scrollRef.current.style.paddingBottom = isKeyboardOpen ? '80px' : '160px';
      }

      setTimeout(scrollToBottom, 50);
    };

    handleViewport();

    const onWinResize = () => handleViewport();
    window.addEventListener('resize', onWinResize);

    if (vp) {
      vp.addEventListener('resize', handleViewport);
      vp.addEventListener('scroll', handleViewport);
      return () => {
        vp.removeEventListener('resize', handleViewport);
        vp.removeEventListener('scroll', handleViewport);
        window.removeEventListener('resize', onWinResize);
      };
    }
    return () => window.removeEventListener('resize', onWinResize);
  }, [scrollToBottom]);

  // 상대방 프로필 조회
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!chatId) return;
      if (!isValidUUID(chatId)) {
        const room = chatStore.getRoom(chatId);
        setOtherUser(room
          ? { nickname: room.user.name, avatar_url: room.user.avatar, last_seen: null }
          : { nickname: `Explorer_${chatId}`, avatar_url: '/placeholder.svg', last_seen: null });

        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, last_seen')
        .eq('id', chatId)
        .single();
      if (data) setOtherUser({ nickname: data.nickname || '사용자', avatar_url: data.avatar_url, last_seen: data.last_seen });
      setIsLoading(false);
    };
    fetchOtherUser();
  }, [chatId]);

  // 온라인 상태 체크
  useEffect(() => {
    if (!otherUser?.last_seen) { setIsOnline(false); return; }
    const checkOnline = () => {
      const diffMinutes = (new Date().getTime() - new Date(otherUser.last_seen!).getTime()) / (1000 * 60);
      setIsOnline(diffMinutes < 10);
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, [otherUser?.last_seen]);

  // 메시지 목록 + 실시간 수신
  useEffect(() => {
    if (!authUser || !chatId || !isValidUUID(chatId)) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, content, sender_id, receiver_id, created_at, is_read')
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      setIsLoading(false);
      markAsRead();
      setTimeout(scrollToBottom, 100);
    };
    fetchMessages();

    /**
     * ✅ 업계 표준 패턴:
     *    NotificationProvider(전역 채널)가 messages INSERT를 감지 →
     *    'refresh-messages-list' 커스텀 이벤트 발생 →
     *    Chat.tsx가 이벤트를 받아 메시지 목록 갱신
     *
     *    별도 Realtime 채널 없이 동일한 실시간 효과 달성.
     *    WAL 폴링 채널 수: 3개 → 1개
     */
    const handleNewMessage = async (e: Event) => {
      const { data } = await supabase
        .from('messages')
        .select('id, content, sender_id, receiver_id, created_at, is_read')
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`)
        .order('created_at', { ascending: true });
      if (!data) return;
      // 읽음 처리 후 로컬 상태에 반영 (markAsRead가 setMessages를 업데이트하므로 순서 중요)
      setMessages(data.map(msg =>
        msg.receiver_id === authUser.id && msg.sender_id === chatId
          ? { ...msg, is_read: true }
          : msg
      ));
      // 상대방이 보낸 새 메시지일 때만 in-chat 소리 재생
      // (내가 보낸 메시지 INSERT 이벤트에는 소리 재생 안 함)
      const customEvent = e as CustomEvent;
      const senderId = customEvent.detail?.sender_id;
      if (senderId && senderId !== authUser.id) {
        playNotificationSound(true);
      }
      markAsRead();
      setTimeout(scrollToBottom, 10);
    };

    // 상대방이 내 메시지를 읽었을 때 → is_read 상태 실시간 반영
    const handleReadStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      const receiverId = customEvent.detail?.receiver_id;
      // 현재 채팅 상대방이 읽은 경우만 처리
      if (receiverId !== chatId) return;
      setMessages(prev =>
        prev.map(msg =>
          msg.sender_id === authUser.id && msg.receiver_id === chatId && !msg.is_read
            ? { ...msg, is_read: true }
            : msg
        )
      );
    };

    window.addEventListener('refresh-messages-list', handleNewMessage);
    window.addEventListener('refresh-read-status', handleReadStatus);
    return () => {
      window.removeEventListener('refresh-messages-list', handleNewMessage);
      window.removeEventListener('refresh-read-status', handleReadStatus);
    };
  }, [authUser?.id, chatId, markAsRead, playNotificationSound, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || !authUser || !chatId) return;
    const content = inputValue.trim();
    setInputValue('');
    if (isValidUUID(chatId)) {
      const { data } = await supabase
        .from('messages')
        .insert([{ sender_id: authUser.id, receiver_id: chatId, content }])
        .select('*')
        .single();
      if (data) {
        setMessages((prev) =>
          prev.some(m => m.id === data.id)
            ? prev
            : [...prev, data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        );
        setTimeout(scrollToBottom, 50);
      }
    } else {
      chatStore.getOrCreateRoom(chatId, otherUser?.nickname || `Explorer_${chatId}`, otherUser?.avatar_url || '');
      chatStore.addMessage(chatId, content, 'me');
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center bg-white h-screen">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="bg-white overflow-hidden flex flex-col h-screen relative">
      {/* 글로벌 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-[110] bg-white border-b border-gray-100 pt-[env(safe-area-inset-top,0px)]">
        <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/')} >
            <h1 className="text-2xl font-black tracking-tighter italic shrink-0">
              <span className="text-gray-900">Toca</span><span className="text-yellow-500">Toca</span>
            </h1>
          </div>
          <HeaderAdBanner />
          <div className="flex items-center gap-4 shrink-0">
            <button
              className="relative p-1 hover:bg-gray-50 rounded-full"
              onClick={() => {
                navigate('/', { replace: true });
                window.dispatchEvent(new CustomEvent('open-notifications-overlay'));
              }}
            >
              <Bell className="w-6 h-6 text-gray-600" />
              {unreadNotifs > 0 && (
                <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadNotifs > 99 ? '99+' : unreadNotifs}
                </span>
              )}
            </button>
            <button
              className="relative p-1 hover:bg-gray-50 rounded-full"
              onClick={() => {
                navigate('/', { replace: true });
                window.dispatchEvent(new CustomEvent('open-messages-overlay'));
              }}
            >
              <MessageSquare className="w-6 h-6 text-gray-600" />
              {unreadMessages > 0 && (
                <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 채팅 상세 헤더 */}
      <header ref={headerRef} className="fixed top-[calc(64px+env(safe-area-inset-top,0px))] left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-b border-gray-50">
        <div className="h-16 px-4 flex items-center w-full relative">
          <button onClick={handleBack} className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 z-10 shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[60%]">
            <div
              className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer"
              onClick={() => navigate(`/profile/${chatId}`)}
            >
              <img
                src={otherUser?.avatar_url || '/placeholder.svg'}
                alt="user"
                className="w-full h-full rounded-full object-cover border-2 border-white"
              />

            </div>
            <div className="flex flex-col min-w-0">
                              <h2 className="text-sm font-black text-gray-900 truncate leading-normal">{otherUser?.nickname || '사용자'}</h2>
                              <div className="flex items-center gap-1 mt-0.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
                <span className={cn("text-[9px] font-black uppercase tracking-tight", isOnline ? "text-green-500" : "text-gray-400")}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 space-y-4 no-scrollbar"
        style={{ paddingTop: 'calc(128px + env(safe-area-inset-top, 0px))', paddingBottom: '160px' }}
      >
        <div className="flex flex-col gap-4 py-4">
          {messages.map((msg) => {
            const isMe = msg.sender_id === authUser?.id;
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={msg.id} className={cn('flex flex-col max-w-[85%]', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
                <div className={cn('px-4 py-2.5 rounded-[20px] text-sm font-bold shadow-sm', isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none')}>
                  {msg.content}
                </div>
                <div className={cn('mt-1 px-1 flex items-center gap-1.5', isMe ? 'justify-end' : 'justify-start')}>
                  {isMe && <span className="text-[9px] text-gray-400 font-bold">{msg.is_read ? '읽음' : '읽지 않음'}</span>}
                  <span className="text-[9px] text-gray-400 font-bold">{time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={inputRef}
        className="fixed left-0 right-0 z-[120] px-4 pt-2 bg-white/95 backdrop-blur-md border-t border-gray-100"
        style={{ bottom: '80px', paddingBottom: '12px' }}
      >
        <div className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-1.5 border border-gray-100 shadow-inner">
          <Input
            placeholder="메시지 보내기..."
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-8 font-bold"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn('w-8 h-8 rounded-full transition-all shadow-lg', inputValue.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 text-gray-400')}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;