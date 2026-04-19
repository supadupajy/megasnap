"use client";

export interface ChatMessage {
  id: number;
  text: string;
  sender: 'me' | 'other';
  time: string;
}

export interface ChatRoom {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  lastMessage: string;
  time: string;
  unread: boolean;
  messages: ChatMessage[];
}

// 샘플 데이터를 삭제하고 빈 배열로 시작합니다.
let chatRooms: ChatRoom[] = [];
const listeners = new Set<() => void>();

export const chatStore = {
  getRooms: () => [...chatRooms].sort((a, b) => {
    // 메시지가 있는 경우 마지막 메시지 시간 기준 정렬 (단순 구현)
    return 0; 
  }),
  
  getRoom: (id: string) => chatRooms.find(r => r.id === id),
  
  // 새로운 채팅방 생성 또는 기존 방 반환
  getOrCreateRoom: (userId: string, userName: string, userAvatar: string) => {
    const existing = chatRooms.find(r => r.id === userId);
    if (existing) return existing;
    
    const newRoom: ChatRoom = {
      id: userId,
      user: { name: userName, avatar: userAvatar },
      lastMessage: '',
      time: '방금',
      unread: false,
      messages: []
    };
    
    chatRooms = [newRoom, ...chatRooms];
    chatStore.notify();
    return newRoom;
  },
  
  addMessage: (roomId: string, text: string, sender: 'me' | 'other' = 'me') => {
    const roomIndex = chatRooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newMessage: ChatMessage = {
      id: Date.now(),
      text,
      sender,
      time: timeStr
    };
    
    const updatedRoom = {
      ...chatRooms[roomIndex],
      messages: [...chatRooms[roomIndex].messages, newMessage],
      lastMessage: text,
      time: '방금',
      unread: sender === 'other'
    };
    
    // 최신 메시지가 온 방을 맨 위로 올림
    chatRooms = [updatedRoom, ...chatRooms.filter(r => r.id !== roomId)];
    chatStore.notify();
  },
  
  markAsRead: (roomId: string) => {
    chatRooms = chatRooms.map(r => r.id === roomId ? { ...r, unread: false } : r);
    chatStore.notify();
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  
  notify: () => listeners.forEach(l => l())
};