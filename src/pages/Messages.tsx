"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Search, Edit, Loader2, MessageSquare, UserPlus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showError, showSuccess } from '@/utils/toast';
import { motion, AnimatePresence } from 'framer-motion';
import DeleteChatDialog from '@/components/DeleteChatDialog';

interface Conversation {
  other_id: string;
  last_message: string;
  created_at: string;
  unread_count: number;
  profile: {
    nickname: string | null;
    avatar_url: string | null;
  };
}

const Messages = () => {
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
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const convMap = new Map<string, any>();
      if (messages) {
        for (const msg of messages) {
          const otherId = msg.sender_id === authUser.id ? msg.receiver_id : msg.sender_id;
          if (!convMap.has(otherId)) {
            convMap.set(otherId, {
              other_id: otherId,
              last_message: msg.content,
              created_at: msg.created_at,
              unread_count: (!msg.is_read && msg.receiver_id === authUser.id) ? 1 : 0
            });
          } else if (!msg.is_read && msg.receiver_id === authUser.id) {
            convMap.get(otherId).unread_count += 1;
          }
        }
      }

      // 로컬 스토어 데이터 합산
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
      const results = await Promise.all(
        convList.map(async (conv) => {
          if (conv.profile) return conv;
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', conv.other_id)
            .single();
          return {
            ...conv,
            profile: profile || { nickname: '사용자', avatar_url: null }
          };
        })
      );

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setConversations(results);
    } catch (err: any) {
      console.error('Fetch conversations error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    
    if (!authUser) return;

    // 실시간 리스너: 메시지 테이블의 모든 변화 감지
    const channel = supabase
      .channel('messages_list_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages'
      }, fetchConversations)
      .subscribe();

    const unsubscribeChatStore = chatStore.subscribe(fetchConversations);
    
    return () => {
      supabase.removeChannel(channel);
      unsubscribeChatStore();
    };
  }, [authUser]);

  useEffect(() => {
    const searchGlobalUsers = async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < 1) {
        setGlobalSearchResults([]);
        return;
      }

      setIsSearchingGlobal(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .ilike('nickname', `%${trimmedQuery}%`)
          .neq('id', authUser?.id)
          .limit(10);

        if (error) throw error;

        if (data) {
          const existingIds = new Set(conversations.map(c => c.other_id));
          setGlobalSearchResults(data.filter(u => !existingIds.has(u.id)));
        }
      } catch (err: any) {
        console.error('Supabase search error:', err);
      } finally {
        setIsSearchingGlobal(false);
      }
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
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${deleteTargetId}),and(sender_id.eq.${deleteTargetId},receiver_id.eq.${authUser.id})`);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.other_id !== deleteTargetId));
      setSwipedId(null);
      showSuccess('대화가 삭제되었습니다.');
    } catch (err) {
      console.error('Delete chat error:', err);
      showError('대화 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleItemTap = (otherId: string) => {
    if (isDragging.current) return;
    if (swipedId) {
      setSwipedId(null);
      return;
    }
    navigate(`/chat/${otherId}`);
  };

  return (
    <div className="h-screen overflow-y-auto bg-white pb-24 no-scrollbar" onClick={() => setSwipedId(null)}>
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="font-black text-lg text-gray-900">Direct Message</h1>
        </div>
        <button onClick={() => navigate('/friends')} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
          <Edit className="w-6 h-6 text-indigo-600" />
        </button>
      </header>

      <div className="pt-[88px] px-4">
        <div className="relative py-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="대화 상대 또는 메시지 검색" 
              className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-indigo-600 font-bold" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
            />
            {isSearchingGlobal && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest px-1">
              {query ? '대화 목록 검색 결과' : '최근 메시지'}
            </h2>
            <div className="space-y-1">
              <AnimatePresence initial={false}>
                {filteredConversations.map((conv) => {
                  const time = new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isSwiped = swipedId === conv.other_id;

                  return (
                    <div key={conv.other_id} className="relative group overflow-hidden rounded-[24px]">
                      <div className="absolute inset-0 bg-red-500 flex justify-end items-center pr-6">
                        <button 
                          onClick={(e) => handleDeleteClick(e, conv.other_id)}
                          className="text-white flex flex-col items-center gap-1 active:scale-90 transition-transform"
                        >
                          <Trash2 className="w-6 h-6" />
                          <span className="text-[10px] font-bold">삭제</span>
                        </button>
                      </div>

                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -80, right: 0 }}
                        dragElastic={0.1}
                        animate={{ x: isSwiped ? -80 : 0 }}
                        onDragStart={() => { isDragging.current = false; }}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -40) setSwipedId(conv.other_id);
                          else setSwipedId(null);
                        }}
                        onTap={() => handleItemTap(conv.other_id)}
                        className="relative bg-white flex items-center gap-4 p-3 cursor-pointer z-10"
                      >
                        <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 shadow-sm" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${conv.other_id}`); }}>
                          <img src={conv.profile.avatar_url || `https://i.pravatar.cc/150?u=${conv.other_id}`} alt="avatar" className="w-full h-full rounded-full object-cover border-2 border-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={`text-sm ${conv.unread_count > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>{conv.profile.nickname}</p>
                            <span className="text-[10px] text-gray-400 font-medium">{time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className={`text-xs truncate flex-1 ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{conv.last_message}</p>
                            {conv.unread_count > 0 && <div className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{conv.unread_count}</div>}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
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
                  <div key={user.id} onClick={() => handleStartChat(user)} className="flex items-center gap-4 p-3 hover:bg-indigo-50/50 rounded-[24px] cursor-pointer active:scale-[0.98] transition-all">
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
      
      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Messages;