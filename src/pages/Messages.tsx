"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, Edit, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatStore } from '@/utils/chat-store';

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
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = async () => {
    if (!authUser) return;
    
    try {
      // 1. Supabase 메시지 내역 가져오기
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
        .order('created_at', { ascending: false });

      const convMap = new Map<string, any>();
      
      if (!error && messages) {
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

      // 2. 로컬 chatStore 내역 합치기
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
      
      // 3. 프로필 정보 채우기
      const results = await Promise.all(
        convList.map(async (conv) => {
          if (conv.profile) return conv;
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', conv.other_id)
            .maybeSingle();
          return {
            ...conv,
            profile: profile || { nickname: '사용자', avatar_url: null }
          };
        })
      );

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setConversations(results);
    } catch (err) {
      console.error('[Messages] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const unsubscribe = chatStore.subscribe(fetchConversations);
    return () => { unsubscribe(); };
  }, [authUser]);

  // 검색어에 따른 필터링 (닉네임 또는 마지막 메시지 내용)
  const filteredConversations = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return conversations;
    
    return conversations.filter(conv => 
      conv.profile.nickname?.toLowerCase().includes(lowerQuery) ||
      conv.last_message.toLowerCase().includes(lowerQuery)
    );
  }, [query, conversations]);

  return (
    <div className="min-h-screen bg-white pb-24">
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

      <div className="pt-[88px] px-4 py-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="대화 상대 또는 메시지 검색" 
            className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-indigo-600 font-bold" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
        </div>

        <div className="space-y-4">
          <h2 className="font-black text-sm text-gray-400 uppercase tracking-widest px-1">최근 메시지</h2>
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conv) => {
                const time = new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={conv.other_id} onClick={() => navigate(`/chat/${conv.other_id}`)} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-[24px] cursor-pointer active:scale-[0.98] transition-all">
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
                  </div>
                );
              })}
              {filteredConversations.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-sm text-gray-400 font-medium">
                    {query ? '검색 결과가 없습니다.' : '대화 내역이 없습니다.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Messages;