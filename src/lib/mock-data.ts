"use client";

import { Post, User } from '@/types';

/**
 * 1. 대한민국 8대 광역 도시 데이터 (전국 분포의 핵심)
 */
export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1200, bounds: { sw: { lat: 37.42, lng: 126.80 }, ne: { lat: 37.70, lng: 127.15 } } },
  { name: "인천", lat: 37.4563, lng: 126.7052, density: 600, bounds: { sw: { lat: 37.35, lng: 126.55 }, ne: { lat: 37.55, lng: 126.80 } } },
  { name: "대전", lat: 36.3504, lng: 127.3845, density: 600, bounds: { sw: { lat: 36.25, lng: 127.25 }, ne: { lat: 36.45, lng: 127.50 } } },
  { name: "광주", lat: 35.1595, lng: 126.8526, density: 600, bounds: { sw: { lat: 35.05, lng: 126.75 }, ne: { lat: 35.25, lng: 126.95 } } },
  { name: "대구", lat: 35.8714, lng: 128.6014, density: 700, bounds: { sw: { lat: 35.75, lng: 128.45 }, ne: { lat: 35.95, lng: 128.75 } } },
  { name: "울산", lat: 35.5384, lng: 129.3114, density: 500, bounds: { sw: { lat: 35.45, lng: 129.20 }, ne: { lat: 35.65, lng: 129.45 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 900, bounds: { sw: { lat: 35.05, lng: 128.90 }, ne: { lat: 35.25, lng: 129.20 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.20, lng: 126.20 }, ne: { lat: 33.55, lng: 126.90 } } }
];

// ... (YOUTUBE_IDS_50, REALISTIC_COMMENTS 등 기존 코드 유지)

export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `User_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `User_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국을 탐험 중입니다."
});

export const getUnsplashUrl = (sig: number) => `https://picsum.photos/id/${(sig % 200) + 15}/800/600`;

/**
 * 2. 좌표 생성 로직 (현재 화면 무시, 도시별 경계값 우선 사용)
 */
export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueSeed = i + Math.floor(lat * 100);
    
    // bounds가 있으면 해당 도시 영역 내에, 없으면 중심점 근처에 뿌립니다.
    const pLat = bounds ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat) : lat + (Math.random() - 0.5) * 0.1;
    const pLng = bounds ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng) : lng + (Math.random() - 0.5) * 0.1;

    return {
      id, isAd: false, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: "오늘의 발견! 📍",
      location: '대한민국',
      lat: pLat, lng: pLng,
      likes: Math.floor(Math.random() * 10000), commentsCount: 3, comments: [],
      image: getUnsplashUrl(uniqueSeed),
      isLiked: false, createdAt: new Date(), borderType: 'none',
    };
  });
};

// 나머지 필수 export들 유지
export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.nickname, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));
export const initializeYoutubePool = async () => true;
export const UNSPLASH_IDS = ["p1", "p2"];