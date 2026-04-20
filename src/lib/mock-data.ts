"use client";

import { Post, User } from '@/types';

/**
 * 1. 전국 8대 대도시 데이터 (전국 분포용)
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

/**
 * 2. 유튜브 및 이미지 관련
 */
export const YOUTUBE_IDS_50 = [
  "aqz-KE-BPKQ", "dQw4w9WgXcQ", "9bZkp7q19f0", "V1Pl8CzNzCw", "fHI8X4OXW5Q",
  "jNQXAC9IVRw", "L_jWHffIx5E", "hXbZ7zS6SIs", "mH0_XpSHkZo", "CevxZvSJLk8"
];

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const UNSPLASH_IDS = ["photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df"];

// [에러 해결] 누락되었던 Export 추가
export const REALISTIC_COMMENTS = ["분위기 정말 대박이에요! 😍", "인생샷 건졌습니다 ✨", "오늘 날씨랑 찰떡이네요 📍", "나만 알고 싶은 명소 공유! 🌈"];
export const AD_COMMENTS = ["[AD] 특별한 혜택!", "[AD] 프리미엄 서비스"];
export const FOOD_IMAGES = [10, 15, 20, 25, 30].map(id => `https://picsum.photos/id/${id}/800/600`);

/**
 * 3. 유저 및 유틸리티
 */
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국의 멋진 순간을 기록합니다."
});

export const getUnsplashUrl = (sig: number) => `https://picsum.photos/id/${(sig % 200) + 15}/800/600`;

/**
 * 4. 모킹 및 데이터 생성
 */
export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueSeed = i + Math.floor(lat * 100);
    const pLat = bounds ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat) : lat + (Math.random() - 0.5) * 0.1;
    const pLng = bounds ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng) : lng + (Math.random() - 0.5) * 0.1;

    return {
      id, isAd: false, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat: pLat, lng: pLng,
      likes: Math.floor(Math.random() * 15000), commentsCount: 3, comments: [],
      image: getUnsplashUrl(uniqueSeed),
      isLiked: false, createdAt: new Date(), borderType: 'none',
    };
  });
};

export const MOCK_USERS = Array.from({ length: 15 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.nickname, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));
export const initializeYoutubePool = async () => true;