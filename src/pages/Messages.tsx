"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Loader2, MessageSquare, UserPlus, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showError, showSuccess } from '@/utils/toast';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { cn } from '@/lib/utils';
import DeleteChatDialog from '@/components/DeleteChatDialog';
import { searchProfilesByNickname } from '@/utils/profile-search';

interface Conversation {
  other_id: string;
  last_message: string;
  created_at: string;
  unread_count: number;
  profile: {
    nickname: string | null;
    avatar_url: string | null;
    last_seen?: string | null;
  };
}

const SWIPE_THRESHOLD = 40;
const SNAP_OPEN = -80;
const SPRING = { type: 'spring' as const, stiffness: 400, damping: 35 };

interface SwipeConvItemProps {
  conv: Conversation;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onDeleteClick: (e: React.MouseEvent, id: string) => void;
  onNavigate: (id: string) => void;
  onProfileNavigate: (id: string) => void;
}

const SwipeConversationItem: React.FC<SwipeConvItemProps> = ({
  conv,
  isOpen,
  onOpen,
  onClose,
  onDeleteClick,
  onNavigate,
  onProfileNavigate,
}) => {
  const x = useMotionValue(0);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // isOpen 변경 시 스냅 애니메이션
  useEffect(() => {
    if (!isMounted.current) return;
    animate(x, isOpen ? SNAP_OPEN : 0, SPRING);
  }, [isOpen, x]);

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -SWIPE_THRESHOLD || velocity < -300) {
      animate(x, SNAP_OPEN, SPRING);
      onOpen(conv.other_id);
    } else {
      animate(x, 0, SPRING);
      onClose();
    }
  };

  const time = new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isOnline = conv.profile.last_seen &&
    (new Date().getTime() - new Date(conv.profile.last_seen).getTime()) / (1000 * 60) < 10;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex justify-center items-center">
        <button
          onClick={(e) => onDeleteClick(e, conv.other_id)}
          className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-[10px] font-bold">삭제</span>
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: SNAP_OPEN, right: 0 }}
        dragElastic={0.05}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={() => { if (!isOpen) onNavigate(conv.other_id); }}
        className="relative bg-white flex items-center gap-4 py-4 px-1 cursor-pointer z-10"
      >
        <div
          className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-yellow-100 shrink-0 shadow-sm relative"
          onClick={(e) => { e.stopPropagation(); onProfileNavigate(conv.other_id); }}
        >
          <img
            src={conv.profile.avatar_url || '/placeholder.svg'}
            alt="avatar"
            className="w-full h-full rounded-full object-cover border-2 border-white"
          />
          <div className={cn(
            "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white z-10 transition-colors duration-300",
            isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-300"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                {conv.profile.nickname}
              </p>
              {isOnline && (
                <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter leading-none px-1 py-0.5 bg-green-50 rounded-[4px] shrink-0">Online</span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 font-medium shrink-0">{time}</span>
          </div>
          <div className="flex items-center gap-2">
            <p className={`text-xs truncate flex-1 ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
              {conv.last_message}
            </p>
            {conv.unread_count > 0 && (
              <div className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{conv.unread_count}</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface MessagesProps {
  // 오버레이로 사용될 때 닫기를 부모(MessagesOverlay)에 위임.
  onClose?: () => void;
}

const Messages: React.FC<MessagesProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchConversations = async () => {
    if (!authUser) return;
    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at, is_read')
        .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
        .order('created_at', { ascending: false });
      const convMap = new Map<string, any>();
      
      if (messages) {
        const activeChatId = localStorage.getItem('activeChatId');
        for (const msg of messages) {
          const otherId = msg.sender_id === authUser.id ? msg.receiver_id : msg.sender_id;
          const shouldShowBadge = !msg.is_read && msg.receiver_id === authUser.id && otherId !== activeChatId;

          if (!convMap.has(otherId)) {
            convMap.set(otherId, {
              other_id: otherId,
              last_message: msg.content,
              created_at: msg.created_at,
              unread_count: shouldShowBadge ? 1 : 0
            });
          } else if (shouldShowBadge) {
            convMap.get(otherId).unread_count += 1;
          }
        }
      }
      const localRooms = chatStore.getRooms();
      for (const room of localRooms) {
        if (!convMap.has(room.id) && room.messages.length > 0) {
          const lastMsg = room.messages[room.messages.length - 1];
          convMap.set(room.id, {
            other_id: room.id,
            last_message: lastMsg.text,
            created_at: new Date().toISOString(),
            unread_count: room.unread ? 1 : 0,
            profile: { nickname: room.user.name, avatar_url: room.user.avatar }
          });
        }
      }
      const convList = Array.from(convMap.values());

      const profileNeededIds = convList.filter(c => !c.profile).map(c => c.other_id);
      let profileMap = new Map<string, any>();
      if (profileNeededIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, last_seen')
          .in('id', profileNeededIds);
        (profilesData || []).forEach(p => profileMap.set(p.id, p));
      }

      const results = convList.map(conv => {
        if (conv.profile) return conv;
        const profile = profileMap.get(conv.other_id);
        return { ...conv, profile: profile || { nickname: '사용자', avatar_url: null, last_seen: null } };
      });

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setConversations(results);

      window.dispatchEvent(new CustomEvent('refresh-unread-counts'));
    } catch (err) {} finally { setIsLoading(false); }
  };

  useEffect(() => {
    fetchConversations();
    if (!authUser) return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeChatId') fetchConversations();
    };
    window.addEventListener('storage', handleStorageChange);

    const handleRefreshEvent = () => fetchConversations();
    window.addEventListener('refresh-messages-list', handleRefreshEvent);

    const unsubscribeChatStore = chatStore.subscribe(fetchConversations);
    
    const pollOnlineStatus = async () => {
      setConversations(prev => {
        if (prev.length === 0) return prev;
        const ids = prev.map(c => c.other_id);
        supabase
          .from('profiles')
          .select('id, last_seen')
          .in('id', ids)
          .then(({ data }) => {
            if (!data) return;
            const lastSeenMap = new Map(data.map(p => [p.id, p.last_seen]));
            setConversations(curr => curr.map(conv =>
              lastSeenMap.has(conv.other_id)
                ? { ...conv, profile: { ...conv.profile, last_seen: lastSeenMap.get(conv.other_id) } }
                : conv
            ));
          });
        return prev;
      });
    };
    const onlineStatusInterval = setInterval(pollOnlineStatus, 60_000);

    return () => {
      clearInterval(onlineStatusInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('refresh-messages-list', handleRefreshEvent);
      unsubscribeChatStore();
    };
  }, [authUser]);

  useEffect(() => {
    const searchGlobalUsers = async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < 1) { setGlobalSearchResults([]); return; }
      setIsSearchingGlobal(true);
      try {
        const data = await searchProfilesByNickname(trimmedQuery, authUser?.id, 10);
        const existingIds = new Set(conversations.map(c => c.other_id));
        setGlobalSearchResults(data.filter(u => !existingIds.has(u.id)));
      } catch (err) {} finally { setIsSearchingGlobal(false); }
    };
    const timer = setTimeout(searchGlobalUsers, 300);
    return () => clearTimeout(timer);
  }, [query, authUser, conversations]);

  const filteredConversations = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return conversations;
    return conversations.filter(conv =>
      conv.profile.nickname?.toLowerCase().includes(lowerQuery) ||
      conv.last_message.toLowerCase().includes(lowerQuery)
    );
  }, [query, conversations]);

  const handleStartChat = (user: any) => {
    chatStore.getOrCreateRoom(user.id, user.nickname || '사용자', user.avatar_url);
    onClose?.();
    navigate(`/chat/${user.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, otherId: string) => {
    e.stopPropagation();
    setDeleteTargetId(otherId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!authUser || !deleteTargetId) return;
    try {
      await supabase.from('messages').delete().or(
        `and(sender_id.eq.${authUser.id},receiver_id.eq.${deleteTargetId}),and(sender_id.eq.${deleteTargetId},receiver_id.eq.${authUser.id})`
      );
      setConversations(prev => prev.filter(c => c.other_id !== deleteTargetId));
      setSwipedId(null);
      showSuccess('대화가 삭제되었습니다.');
    } catch (err) {
      showError('대화 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleBack = () => {
    // 오버레이로 사용 중이면 그냥 닫기 — 아래 페이지(Flicks 등)가 그대로 이어진다.
    if (onClose) {
      onClose();
      return;
    }

    const routeState = location.state as any;
    const fromPath = routeState?.fromPath;

    if (fromPath && fromPath !== location.pathname) {
      navigate(fromPath, {
        replace: true,
        state: routeState?.fromState ?? null,
      });
      return;
    }

    navigate('/', { replace: true, state: { direction: 'back' } });
  };

  return (
    <div
      className="h-screen min-h-0 w-full max-w-full overflow-hidden bg-white flex flex-col"
      style={{
        // 글로벌 헤더(높이 4rem) + 모바일 상태바(safe-area-inset-top)만큼 자리를 비워둔다.
        // 이 영역이 부족하면 모바일에서 메시지 타이틀이 글로벌 헤더 뒤로 들어가 보인다.
        paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={() => setSwipedId(null)}
    >
      {/* 고정 영역: 헤더 + 검색창 + 섹션 타이틀 */}
      <div className="shrink-0 bg-white">
        <div className="bg-gray-50 grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14 border-b border-gray-100">
          <div />
          <h2 className="text-lg font-black text-gray-900 tracking-tight">메시지</h2>
          <div className="flex justify-end">
            <button
              onClick={handleBack}
              aria-label="닫기"
              className="flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-transform shrink-0 overflow-hidden"
              style={{ padding: '8px' }}
            >
              <X className="w-4 h-4 text-gray-900 shrink-0" />
            </button>
          </div>
        </div>

        <div className="bg-white px-4 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="대화 상대 또는 메시지 검색"
              className="w-full pl-12 pr-12 h-12 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none text-sm font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-inner transition-all focus:border-indigo-300 focus:bg-white"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {isSearchingGlobal && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-2 pb-3">
          <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest px-1">
            {query ? '대화 목록 검색 결과' : '최근 메시지'}
          </h2>
        </div>
      </div>

      {/* 스크롤 영역: 메시지 리스트 */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="space-y-6 px-4 pb-4">
          <div>
            <div className="divide-y divide-gray-50 border-t border-gray-50">
              <AnimatePresence initial={false}>
                {filteredConversations.map((conv) => (
                  <SwipeConversationItem
                    key={conv.other_id}
                    conv={conv}
                    isOpen={swipedId === conv.other_id}
                    onOpen={(id) => setSwipedId(id)}
                    onClose={() => setSwipedId(null)}
                    onDeleteClick={handleDeleteClick}
                    onNavigate={(id) => { onClose?.(); navigate(`/chat/${id}`); }}
                    onProfileNavigate={(id) => { onClose?.(); navigate(`/profile/${id}`); }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {query.trim() && globalSearchResults.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-gray-50">
              <h2 className="font-black text-sm text-indigo-600 uppercase tracking-widest px-1 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> 새로운 대화 상대 찾기
              </h2>
              <div className="space-y-1">
                {globalSearchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartChat(user)}
                    className="flex items-center gap-4 p-3 hover:bg-indigo-50/50 rounded-[24px] cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full p-[2px] bg-indigo-100 shrink-0">
                      <Avatar className="w-full h-full border-2 border-white">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{user.nickname}</p>
                      <p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredConversations.length === 0 && globalSearchResults.length === 0 && !isLoading && !isSearchingGlobal && (
            <div className="py-20 flex flex-col items-center justify-center text-center px-10">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-sm text-gray-400 font-bold leading-relaxed">
                {query ? '검색 결과가 없습니다.' : '아직 대화 내역이 없습니다.\n새로운 메시지를 보내보세요!'}
              </p>
            </div>
          )}
        </div>
      </div>

      <DeleteChatDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Messages;
