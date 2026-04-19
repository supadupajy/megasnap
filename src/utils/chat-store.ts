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

// 초기 예시 데이터 (Mock)
const INITIAL_CHATS: ChatRoom[] = [
  {
    id: 'travel_maker',
    user: { name: 'travel_maker', avatar: 'https://i.pravatar.cc/150?u=travel_maker' },
    lastMessage: '오! 감사합니다. 바로 가봐야겠네요!',
    time: '12분',
    unread: true,
    messages: [
      { id: 1, text: "안녕하세요! 성수동 카페 정보 좀 알려주실 수 있나요?", sender: 'other', time: '오후 2:12' },
      { id: 2, text: "네, 당연하죠! 어떤 스타일의 카페를 찾으시나요?", sender: 'me', time: '오후 2:15' },
      { id: 3, text: "조용하고 작업하기 좋은 곳이면 좋겠어요.", sender: 'other', time: '오후 2:16' },
      { id: 4, text: "그렇다면 '카페 어니언'이나 '대림창고' 보다는 '로우키'를 추천드려요.", sender: 'me', time: '오후 2:18' },
      { id: 5, text: "오! 감사합니다. 바로 가봐야겠네요!", sender: 'other', time: '오후 2:20' },
    ]
  },
  {
    id: 'seoul_snap',
    user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=seoul_snap' },
    lastMessage: '사진 너무 잘 찍으시네요! 👍',
    time: '2시간',
    unread: false,
    messages: [
      { id: 1, text: "작가님 어제 올리신 남산 타워 사진 정말 멋져요!", sender: 'me', time: '오전 10:05' },
      { id: 5, text: "사진 너무 잘 찍으시네요! 👍", sender: 'other', time: '오전 11:05' },
    ]
  }
];

let chatRooms: ChatRoom[] = [...INITIAL_CHATS];
const listeners = new Set<() => void>();

export const chatStore = {
  getRooms: () => [...chatRooms],
  
  getRoom: (id: string) => chatRooms.find(r => r.id === id),
  
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
    
    chatRooms = [updatedRoom, ...chatRooms.filter(r => r.id !== roomId)];
    chatStore.notify();
  },
  
  markAsRead: (roomId: string) => {
    chatRooms = chatRooms.map(r => r.id === roomId ? { ...r, unread: false } : r);
    chatStore.notify();
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  
  notify: () => listeners.forEach(l => l())
};