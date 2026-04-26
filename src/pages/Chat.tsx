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

// 사운드 파일 경로 (더 호환성 높은 공용 리소스 사용)
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

const HEADER_HEIGHT = 88;

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: authUser } = useAuth();

  // 현재 열린 채팅방 ID를 localStorage에 저장하여 다른 컴포넌트(Messages 등)에서 뱃지 표시 여부를 결정할 수 있게 함
  useEffect(() => {
    if (chatId) {
      localStorage.setItem('activeChatId', chatId);
      // 같은 창의 Messages 컴포넌트 등에 알림
      window.dispatchEvent(new Event('storage')); 
      
      return () => {
        localStorage.removeItem('activeChatId');
        window.dispatchEvent(new Event('storage'));
      };
    }
  }, [chatId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [canPlaySound, setCanPlaySound] = useState(false); // 초기값을 false로 변경하여 상호작용 유도

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // 뒤로가기 핸들러
  const handleBack = useCallback(() => {
    console.log('[Chat] Back button clicked');
    localStorage.removeItem('activeChatId'); // 확실히 제거
    navigate('/messages', { 
      replace: true,
      state: { direction: 'back' }
    });
  }, [navigate]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTo({
        top: scrollHeight,
        behavior: 'auto'
      });
    }
  }, []);

  // 사용자 상호작용 감지 (오디오 권한 획득)
  useEffect(() => {
    const enableAudio = () => {
      setCanPlaySound(true);
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('touchstart', enableAudio);
    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  // 페이지 가시성 감지
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 사운드 재생 함수
  const playNotificationSound = useCallback((inChat: boolean) => {
    if (!canPlaySound) {
      console.log('[Chat] Audio not enabled yet by user interaction');
      return;
    }
    
    try {
      const audio = new Audio(inChat ? IN_CHAT_SOUND : OUT_CHAT_SOUND);
      audio.volume = inChat ? 0.4 : 0.8; // 볼륨 상향 조정
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('[Chat] Audio play blocked:', e.message);
        });
      }
    } catch (e) {
      console.error('[Chat] Audio error:', e);
    }
  }, [canPlaySound]);

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
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;

    const handleViewport = () => {
      const offsetTop = vp.offsetTop ?? 0;
      const keyboardHeight = window.innerHeight - vp.height - offsetTop;
      const isKeyboardOpen = keyboardHeight > 100;

      // [FIX] 뷰포트 변경 시 헤더 위치 조정 (상단에 고정)
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(${offsetTop}px)`;
      }

      // [CLEANUP] 입력창 레이아웃 로직 가독성 개선
      if (inputRef.current) {
        if (isKeyboardOpen) {
          inputRef.current.style.bottom = `${keyboardHeight}px`;
          inputRef.current.style.transform = `translateY(${offsetTop}px)`;
          inputRef.current.style.paddingBottom = '12px';
        } else {
          inputRef.current.style.bottom = '100px'; 
          inputRef.current.style.transform = 'translateY(0px)';
          inputRef.current.style.paddingBottom = '12px';
        }
      }

      // 3. 스크롤 영역 하단 패딩 동적 계산
      if (scrollRef.current) {
        const baseBottomPad = isKeyboardOpen ? 80 : 180;
        scrollRef.current.style.paddingBottom = `${baseBottomPad + keyboardHeight}px`;
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
      // 로컬 스토리지 기반 채팅은 실시간 구독 제외
      return;
    }

    const fetchMessages = async () => {
      // 1. 필요한 필드만 명시하여 전송 데이터 크기 최적화 (content, sender_id 등만)
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_id, receiver_id, created_at, is_read')
        .or(
          `and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Chat] Error fetching messages:', error);
      }

      setMessages(data || []);
      setIsLoading(false);
      markAsRead();
      
      // 데이터 로드 후 즉시 하단 스크롤
      setTimeout(scrollToBottom, 100);
    };

    fetchMessages();

    // 2. 실시간 채널 최적화: 필요한 테이블과 필터만 적용
    const channel = supabase
      .channel(`chat-room-${chatId}-${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // 내 채팅방과 무관한 메시지 트래픽은 여기서 필터링
          const isRelevant =
            (newMsg.sender_id === chatId && newMsg.receiver_id === authUser.id) ||
            (newMsg.sender_id === authUser.id && newMsg.receiver_id === chatId);
          
          if (!isRelevant) return;

          if (newMsg.sender_id === chatId) {
            playNotificationSound(isPageVisible);
            markAsRead();
          }

          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) return prev;

            const updated = [...prev, newMsg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            setTimeout(scrollToBottom, 10);
            return updated;
          });
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

    return () => {
      console.log(`[Chat] Removing realtime channel for ${chatId}`);
      supabase.removeChannel(channel);
    };
  }, [authUser.id, chatId, isPageVisible]); // 의존성 최적화

  const handleSend = async () => {
    if (!inputValue.trim() || !authUser || !chatId) return;

    const content = inputValue.trim();
    setInputValue('');

    if (isValidUUID(chatId)) {
      const messageToInsert = { 
        sender_id: authUser.id, 
        receiver_id: chatId, 
        content 
      };

      try {
        console.log('[Chat] Sending message to DB:', messageToInsert);
        const { data, error } = await supabase
          .from('messages')
          .insert([messageToInsert])
          .select('*')
          .single();

        if (error) {
          console.error('[Chat] DB insert error:', error);
          throw error;
        }

        console.log('[Chat] DB insert success, data:', data);

        if (data) {
          setMessages((prev) => {
            const exists = prev.some(m => m.id === data.id);
            if (exists) return prev;
            return [...prev, data].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
          
          // ✅ [수정] 발신 직후 메시지 목록 동기화를 위한 전역 이벤트 발생
          window.dispatchEvent(new CustomEvent('refresh-messages-list'));
          
          setTimeout(scrollToBottom, 50);
        }
      } catch (error) {
        console.error('[Chat] Send error:', error);
        showError('메시지 전송에 실패했습니다.');
        // 실패 시 입력값 복구 (선택 사항)
        setInputValue(content);
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
    <div className="bg-white overflow-hidden flex flex-col h-screen relative" style={{ paddingTop: '88px' }}>
      <header
        ref={headerRef}
        className="fixed top-[88px] left-0 right-0 h-14 z-[100] bg-white flex items-center justify-between px-4 border-b border-gray-100 will-change-transform"
      >
        <div className="flex items-center gap-3">
          <div 
            onClick={handleBack}
            className="p-1 hover:bg-gray-50 rounded-full transition-colors active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </div>
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
        className="flex-1 overflow-y-auto px-4 space-y-4 no-scrollbar"
        style={{
          paddingTop: '64px',
          paddingBottom: '180px',
        }}
      >
        <div className="flex flex-col gap-4 py-4">
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
      </div>

      <div
        ref={inputRef}
        className="fixed left-0 right-0 z-[120] px-4 pt-2 bg-white/95 backdrop-blur-md border-t border-gray-100 will-change-transform"
        style={{
          bottom: '100px', 
          paddingBottom: '12px',
          // 전송 후 레이아웃이 출렁이며 아래로 내려가는 현상을 막기 위해 transition 제거 또는 최소화
          transition: 'transform 0.1s ease-out' 
        }}
      >
        <div className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-1.5 border border-gray-100 shadow-inner">
          <Input
            placeholder="메시지 보내기..."
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-8 font-bold"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
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