"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Search, Edit, Loader2, MessageSquare, UserPlus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showError, showSuccess } from '@/utils/toast';
import { motion, AnimatePresence } from 'framer-motion';
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

interface MessagesProps {
  isEmbedded?: boolean;
}

const Messages: React.FC<MessagesProps> = ({ isEmbedded = false }) => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const isDragging = useRef(false);

  const fetchConversations = async () => {
    if (!authUser) return;
    try {
      const { data: messages } = await supabase.from('messages').select('*').or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`).order('created_at', { ascending: false });
      const convMap = new Map<string, any>();
      if (messages) {
        for (const msg of messages) {
          const otherId = msg.sender_id === authUser.id ? msg.receiver_id : msg.sender_id;
          if (!convMap.has(otherId)) convMap.set(otherId, { other_id: otherId, last_message: msg.content, created_at: msg.created_at, unread_count: (!msg.is_read && msg.receiver_id === authUser.id) ? 1 : 0 });
          else if (!msg.is_read && msg.receiver_id === authUser.id) convMap.get(otherId).unread_count += 1;
        }
      }
      const localRooms = chatStore.getRooms();
      for (const room of localRooms) {
        if (!convMap.has(room.id) && room.messages.length > 0) {
          const lastMsg = room.messages[room.messages.length - 1];
          convMap.set(room.id, { other_id: room.id, last_message: lastMsg.text, created_at: new Date().toISOString(), unread_count: room.unread ? 1 : 0, profile: { nickname: room.user.name, avatar_url: room.user.avatar } });
        }
      }
      const convList = Array.from(convMap.values());
      const results = await Promise.all(convList.map(async (conv) => {
        if (conv.profile) return conv;
        const { data: profile } = await supabase.from('profiles').select('nickname, avatar_url, last_seen').eq('id', conv.other_id).single();
        return { ...conv, profile: profile || { nickname: '사용자', avatar_url: null, last_seen: null } };
      }));

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setConversations(results);
    } catch (err) {} finally { setIsLoading(false); }
  };

  useEffect(() => {
    fetchConversations();
    if (!authUser) return;
    const channel = supabase.channel('messages_list_updates').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations).subscribe();
    const unsubscribeChatStore = chatStore.subscribe(fetchConversations);
    
    // Profiles real-time subscription for online status
    const profileChannel = supabase.channel('messages_profiles_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setConversations(prev => prev.map(conv =>
          conv.other_id === payload.new.id ? { ...conv, profile: { ...conv.profile, last_seen: payload.new.last_seen } } : conv
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
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
    return conversations.filter(conv => conv.profile.nickname?.toLowerCase().includes(lowerQuery) || conv.last_message.toLowerCase().includes(lowerQuery));
  }, [query, conversations]);

  const handleStartChat = (user: any) => { chatStore.getOrCreateRoom(user.id, user.nickname || '사용자', user.avatar_url); navigate(`/chat/${user.id}`); };
  const handleDeleteClick = (e: React.MouseEvent, otherId: string) => { e.stopPropagation(); setDeleteTargetId(otherId); setIsDeleteDialogOpen(true); };
  const confirmDelete = async () => {
    if (!authUser || !deleteTargetId) return;
    try {
      await supabase.from('messages').delete().or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${deleteTargetId}),and(sender_id.eq.${deleteTargetId},receiver_id.eq.${authUser.id})`);
      setConversations(prev => prev.filter(c => c.other_id !== deleteTargetId));
      setSwipedId(null);
      showSuccess('대화가 삭제되었습니다.');
    } catch (err) { showError('대화 삭제 중 오류가 발생했습니다.'); } finally { setIsDeleteDialogOpen(false); setDeleteTargetId(null); }
  };

  const handleBack = () => {
    // Direct Message 창에서 뒤로가기는 항상 지도 화면('/')으로 이동
    // direction state를 넘겨서 App.tsx에서 뒤로가기 애니메이션을 적용하게 함
    navigate('/', {
      replace: true,
      state: { direction: 'back' }
    });
  };

  return (
    <div className={cn(
      "bg-white no-scrollbar",
      isEmbedded ? "h-full" : "h-screen overflow-y-auto pb-24"
    )} onClick={() => setSwipedId(null)}>
      {!isEmbedded && (
        <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-50 flex items-center justify-between px-4 border-b border-gray-100">
          <button 
            onClick={handleBack} 
            className="p-2 hover:bg-gray-50 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="font-black text-lg text-gray-900">Direct Message</h1>
          <button
            onClick={() => navigate('/friends')}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors"
          >
            <Edit className="w-6 h-6 text-indigo-600" />
          </button>
        </header>
      )}

      <div className={cn(isEmbedded ? "" : "pt-[88px]")}>
        <div className={cn(
          "sticky z-40 bg-white px-4 py-6",
          isEmbedded ? "top-0" : "top-[88px]"
        )}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="대화 상대 또는 메시지 검색" 
              className="pl-12 h-12 bg-gray-50/50 border-2 border-indigo-600 rounded-full focus-visible:ring-0 font-bold placeholder:text-gray-400" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
            />
            {isSearchingGlobal && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /></div>}
          </div>
        </div>
        <div className="space-y-6 px-4">
          <div className="space-y-4">
            <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest px-1">{query ? '대화 목록 검색 결과' : '최근 메시지'}</h2>
            <div className="divide-y divide-gray-50 border-t border-gray-50">
              <AnimatePresence initial={false}>{filteredConversations.map((conv) => {
                const time = new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isSwiped = swipedId === conv.other_id;
                const isOnline = conv.profile.last_seen && (new Date().getTime() - new Date(conv.profile.last_seen).getTime()) / (1000 * 60) < 5;
                
                return (
                  <div key={conv.other_id} className="relative group overflow-hidden">
                    <div className="absolute inset-0 bg-red-500 flex justify-end items-center pr-6"><button onClick={(e) => handleDeleteClick(e, conv.other_id)} className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"><Trash2 className="w-6 h-6" /><span className="text-[10px] font-bold">삭제</span></button></div>
                    <motion.div drag="x" dragConstraints={{ left: -80, right: 0 }} dragElastic={0.1} animate={{ x: isSwiped ? -80 : 0 }} onDragEnd={(_, info) => { if (info.offset.x < -40) setSwipedId(conv.other_id); else setSwipedId(null); }} onClick={() => { if (!swipedId) navigate(`/chat/${conv.other_id}`); }} className="relative bg-white flex items-center gap-4 py-4 px-1 cursor-pointer z-10">
                      <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 shadow-sm relative" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${conv.other_id}`); }}>
                        <img src={conv.profile.avatar_url || `https://i.pravatar.cc/150?u=${conv.other_id}`} alt="avatar" className="w-full h-full rounded-full object-cover border-2 border-white" />
                        <div className={cn(
                          "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white z-10 transition-colors duration-300",
                          isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-300"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>{conv.profile.nickname}</p>
                            {isOnline && (
                              <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter leading-none px-1 py-0.5 bg-green-50 rounded-[4px] shrink-0">Online</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">{time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs truncate flex-1 ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{conv.last_message}</p>
                          {conv.unread_count > 0 && <div className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{conv.unread_count}</div>}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}</AnimatePresence>
            </div>
          </div>
          {query.trim() && globalSearchResults.length > 0 && (<div className="space-y-4 pt-2 border-t border-gray-50"><h2 className="font-black text-sm text-indigo-600 uppercase tracking-widest px-1 flex items-center gap-2"><UserPlus className="w-4 h-4" /> 새로운 대화 상대 찾기</h2><div className="space-y-1">{globalSearchResults.map((user) => (<div key={user.id} onClick={() => handleStartChat(user)} className="flex items-center gap-4 p-3 hover:bg-indigo-50/50 rounded-[24px] cursor-pointer active:scale-[0.98] transition-all"><div className="w-12 h-12 rounded-full p-[2px] bg-indigo-100 shrink-0"><Avatar className="w-full h-full border-2 border-white"><AvatarImage src={user.avatar_url} /><AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0]}</AvatarFallback></Avatar></div><div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-900">{user.nickname}</p><p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p></div></div>))}</div></div>)}
          {filteredConversations.length === 0 && globalSearchResults.length === 0 && !isLoading && !isSearchingGlobal && (<div className="py-20 flex flex-col items-center justify-center text-center px-10"><div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><MessageSquare className="w-8 h-8 text-gray-200" /></div><p className="text-sm text-gray-400 font-bold leading-relaxed">{query ? '검색 결과가 없습니다.' : '아직 대화 내역이 없습니다.\n새로운 메시지를 보내보세요!'}</p></div>)}
        </div>
      </div>
      <DeleteChatDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default Messages;