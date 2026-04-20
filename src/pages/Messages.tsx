"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import MessagesHeader from '@/components/MessagesHeader';

interface ChatRoom {
  id: string;
  last_message_content: string;
  last_message_created_at: string;
  unread_count: number;
  other_user_id: string;
  other_user_nickname: string;
  other_user_avatar_url: string;
}

const Messages = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChatRooms = useCallback(async () => {
    if (!authUser) return;

    setIsLoading(true);
    try {
      // 1. 현재 사용자가 포함된 모든 메시지 스레드 조회
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id, nickname, avatar_url), receiver:receiver_id(id, nickname, avatar_url)')
        .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. 스레드별로 그룹화 및 최신 메시지, 상대방 정보 추출
      const threads = new Map<string, ChatRoom>();

      messages.forEach(msg => {
        const isSender = msg.sender_id === authUser.id;
        const otherUser = isSender ? msg.receiver : msg.sender;
        const threadId = otherUser.id;

        if (!threads.has(threadId)) {
          // 최신 메시지 정보로 초기화
          threads.set(threadId, {
            id: threadId,
            last_message_content: msg.content,
            last_message_created_at: msg.created_at,
            unread_count: 0,
            other_user_id: otherUser.id,
            other_user_nickname: otherUser.nickname || 'Unknown User',
            other_user_avatar_url: otherUser.avatar_url || '',
          });
        }

        const thread = threads.get(threadId)!;

        // 최신 메시지 업데이트 (created_at 기준)
        if (msg.created_at > thread.last_message_created_at) {
          thread.last_message_content = msg.content;
          thread.last_message_created_at = msg.created_at;
        }

        // 읽지 않은 메시지 카운트 (내가 수신자일 경우)
        if (!isSender && !msg.is_read) {
          thread.unread_count += 1;
        }
      });

      // 3. Map을 배열로 변환하고 최신 메시지 순으로 정렬
      const sortedChatRooms = Array.from(threads.values()).sort((a, b) => 
        new Date(b.last_message_created_at).getTime() - new Date(a.last_message_created_at).getTime()
      );

      setChatRooms(sortedChatRooms);

    } catch (err) {
      console.error('Error fetching chat rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchChatRooms();

    if (!authUser) return;

    // 실시간 업데이트 구독
    const channel = supabase.channel(`messages_list_${authUser.id}`);

    channel
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${authUser.id}`
      }, fetchChatRooms)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${authUser.id}`
      }, fetchChatRooms)
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [authUser, fetchChatRooms]);

  const handleChatClick = (otherUserId: string, otherUserNickname: string) => {
    navigate(`/chat/${otherUserId}`, { state: { nickname: otherUserNickname } });
  };

  if (!authUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-[88px] pb-[106px]">
        <p className="text-gray-500">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <>
      <MessagesHeader />
      <div className="pt-[88px] pb-[106px] min-h-screen bg-gray-50">
        {isLoading ? (
          <div className="flex justify-center items-center h-full pt-10">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : chatRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-88px-106px)] text-gray-500">
            <MessageSquare className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">아직 주고받은 메시지가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">친구를 검색하여 대화를 시작해보세요.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chatRooms.map((room) => (
              <div
                key={room.other_user_id}
                className="flex items-center p-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100"
                onClick={() => handleChatClick(room.other_user_id, room.other_user_nickname)}
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={room.other_user_avatar_url} alt={room.other_user_nickname} />
                  <AvatarFallback>{room.other_user_nickname[0]}</AvatarFallback>
                </Avatar>
                <div className="ml-4 flex-grow min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{room.other_user_nickname}</p>
                  <p className={cn("text-sm truncate", room.unread_count > 0 ? "font-bold text-gray-800" : "text-gray-500")}>
                    {room.last_message_content}
                  </p>
                </div>
                <div className="flex flex-col items-end ml-2 shrink-0">
                  <p className="text-xs text-gray-400 mb-1">
                    {new Date(room.last_message_created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {room.unread_count > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full font-bold">
                      {room.unread_count > 9 ? '9+' : room.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Messages;