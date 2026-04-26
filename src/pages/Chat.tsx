"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, MoreVertical, Phone, Video, Loader2, Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showError } from '@/utils/toast';
import { chatStore } from '@/utils/chat-store';
import HeaderAdBanner from '@/components/HeaderAdBanner';

// 사운드 파일 경로
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [canPlaySound, setCanPlaySound] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCounts = useCallback(async () => {
    if (!authUser) return;
    const { count: mCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', authUser.id).eq('is_read', false);
    const { count: nCount } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', authUser.id).eq('is_read', false);
    setUnreadCount(mCount || 0);
    setUnreadNotifCount(nCount || 0);
  }, [authUser]);

  useEffect(() => {
    fetchUnreadCounts();
    const handleRefresh = () => fetchUnreadCounts();
    window.addEventListener('refresh-unread-counts', handleRefresh);
    return () => window.removeEventListener('refresh-unread-counts', handleRefresh);
  }, [fetchUnreadCounts]);

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
    navigate('/messages', { replace: true, state: { direction: 'back' } });
  }, [navigate]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    const enableAudio = () => {
      const unlockAudio = new Audio(IN_CHAT_SOUND);
      unlockAudio.volume = 0;
      unlockAudio.play().then(() => {
        setCanPlaySound(true);
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
      await supabase.from('messages').update({ is_read: true }).eq('receiver_id', authUser.id).eq('sender_id', chatId).eq('is_read', false);
      chatStore.markAsRead(chatId);
      window.dispatchEvent(new CustomEvent('refresh-unread-counts'));
    } catch (err) {}
  }, [authUser, chatId]);

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const handleViewport = () => {
      const offsetTop = vp.offsetTop ?? 0;
      const keyboardHeight = window.innerHeight - vp.height - offsetTop;
      const isKeyboardOpen = keyboardHeight > 100;
      if (headerRef.current) headerRef.current.style.transform = `translateY(${offsetTop}px)`;
      if (inputRef.current) {
        if (isKeyboardOpen) {
          inputRef.current.style.bottom = `${keyboardHeight}px`;
          inputRef.current.style.transform = `translateY(${offsetTop}px)`;
        } else {
          inputRef.current.style.bottom = '112px';
          inputRef.current.style.transform = 'translateY(0px)';
        }
      }
      if (scrollRef.current) {
        const baseBottomPad = isKeyboardOpen ? 100 : 220;
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
        setOtherUser(room ? { nickname: room.user.name, avatar_url: room.user.avatar, last_seen: null } : { nickname: `Explorer_${chatId}`, avatar_url: `https://i.pravatar.cc/150?u=${chatId}`, last_seen: null });
        setIsLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('nickname, avatar_url, last_seen').eq('id', chatId).single();
      if (data) setOtherUser({ nickname: data.nickname || '사용자', avatar_url: data.avatar_url, last_seen: data.last_seen });
      setIsLoading(false);
    };
    fetchOtherUser();
  }, [chatId]);

  useEffect(() => {
    if (!otherUser?.last_seen) { setIsOnline(false); return; }
    const checkOnline = () => {
      const lastSeen = new Date(otherUser.last_seen!);
      const diffMinutes = (new Date().getTime() - lastSeen.getTime()) / (1000 * 60);
      setIsOnline(diffMinutes < 5);
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, [otherUser?.last_seen]);

  useEffect(() => {
    if (!authUser || !chatId || !isValidUUID(chatId)) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('id, content, sender_id, receiver_id, created_at, is_read').or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${authUser.id})`).order('created_at', { ascending: true });
      setMessages(data || []);
      setIsLoading(false);
      markAsRead();
      setTimeout(scrollToBottom, 100);
    };
    fetchMessages();
    const channel = supabase.channel(`chat-room-${chatId}-${authUser.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const newMsg = payload.new as Message;
      if (!((newMsg.sender_id === chatId && newMsg.receiver_id === authUser.id) || (newMsg.sender_id === authUser.id && newMsg.receiver_id === chatId))) return;
      if (newMsg.sender_id === chatId) { playNotificationSound(isPageVisible); markAsRead(); }
      setMessages((prev) => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      setTimeout(scrollToBottom, 10);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser.id, chatId, isPageVisible, markAsRead, playNotificationSound, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || !authUser || !chatId) return;
    const content = inputValue.trim();
    setInputValue('');
    if (isValidUUID(chatId)) {
      const { data } = await supabase.from('messages').insert([{ sender_id: authUser.id, receiver_id: chatId, content }]).select('*').single();
      if (data) {
        setMessages((prev) => prev.some(m => m.id === data.id) ? prev : [...prev, data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        window.dispatchEvent(new CustomEvent('refresh-messages-list'));
        setTimeout(scrollToBottom, 50);
      }
    } else {
      chatStore.getOrCreateRoom(chatId, otherUser?.nickname || `Explorer_${chatId}`, otherUser?.avatar_url || '');
      chatStore.addMessage(chatId, content, 'me');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center bg-white h-screen"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;

  return (
    <div className="bg-white overflow-hidden flex flex-col h-screen relative">
      {/* 글로벌 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-[110] bg-white border-b border-gray-100 pt-[env(safe-area-inset-top,0px)]">
        <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/')}>
            <h1 className="text-2xl font-black tracking-tighter italic shrink-0"><span className="text-gray-900">Chora</span><span className="text-indigo-600">Snap</span></h1>
          </div>
          <HeaderAdBanner />
          <div className="flex items-center gap-4 shrink-0">
            <button className="relative p-1 hover:bg-gray-50 rounded-full" onClick={() => navigate('/notifications')}><Bell className="w-6 h-6 text-gray-600" />{unreadNotifCount > 0 && <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>}</button>
            <button className="relative p-1 hover:bg-gray-50 rounded-full" onClick={() => navigate('/messages')}><MessageSquare className="w-6 h-6 text-gray-600" />{unreadCount > 0 && <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
          </div>
        </div>
      </div>

      {/* 채팅 상세 헤더 */}
      <header ref={headerRef} className="fixed top-[calc(64px+env(safe-area-inset-top,0px))] left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-b border-gray-50">
        <div className="h-16 px-4 flex items-center w-full relative">
          <button onClick={handleBack} className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 z-10 shrink-0"><ChevronLeft className="w-6 h-6" /></button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[60%]">
            <div className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${chatId}`)}><img src={otherUser?.avatar_url || `https://i.pravatar.cc/150?u=${chatId}`} alt="user" className="w-full h-full rounded-full object-cover border-2 border-white" /></div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-black text-gray-900 truncate leading-none">{otherUser?.nickname || '사용자'}</h2>
              <div className="flex items-center gap-1 mt-1"><div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-gray-300")} /><span className={cn("text-[9px] font-black uppercase tracking-tight", isOnline ? "text-green-500" : "text-gray-400")}>{isOnline ? 'Online' : 'Offline'}</span></div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-0.5 z-10 shrink-0">
            <button className="p-2 text-gray-400 hover:text-gray-600"><Phone className="w-5 h-5" /></button>
            <button className="p-2 text-gray-400 hover:text-gray-600"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-4 no-scrollbar" style={{ paddingTop: 'calc(128px + env(safe-area-inset-top, 0px))', paddingBottom: '220px' }}>
        <div className="flex flex-col gap-4 py-4">
          {messages.map((msg) => {
            const isMe = msg.sender_id === authUser?.id;
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={msg.id} className={cn('flex flex-col max-w-[85%]', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
                <div className={cn('px-4 py-2.5 rounded-[20px] text-sm font-bold shadow-sm', isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none')}>{msg.content}</div>
                <div className={cn('mt-1 px-1 flex items-center gap-1.5', isMe ? 'justify-end' : 'justify-start')}>{isMe && <span className="text-[9px] text-gray-400 font-bold">{msg.is_read ? '읽음' : '읽지 않음'}</span>}<span className="text-[9px] text-gray-400 font-bold">{time}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div ref={inputRef} className="fixed left-0 right-0 z-[120] px-4 pt-2 bg-white/95 backdrop-blur-md border-t border-gray-100" style={{ bottom: '112px', paddingBottom: '12px' }}>
        <div className="flex items-center gap-2 bg-gray-50 rounded-[24px] px-4 py-1.5 border border-gray-100 shadow-inner">
          <Input placeholder="메시지 보내기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-8 font-bold" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }} />
          <Button size="icon" onClick={handleSend} disabled={!inputValue.trim()} className={cn('w-8 h-8 rounded-full transition-all shadow-lg', inputValue.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 text-gray-400')}><Send className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;