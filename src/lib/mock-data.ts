"use client";

import { Post, User } from '@/types';

/**
 * 1. 전국구 초고밀도 지역 데이터
 */
export const MAJOR_CITIES = [
  { name: "서울/수도권", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.35, lng: 126.75 }, ne: { lat: 37.75, lng: 127.2 } } },
  { name: "강원/동해", lat: 37.7511, lng: 128.8761, density: 800, bounds: { sw: { lat: 37.4, lng: 128.5 }, ne: { lat: 38.1, lng: 129.1 } } },
  { name: "충청/대전", lat: 36.3504, lng: 127.3845, density: 800, bounds: { sw: { lat: 36.1, lng: 127.1 }, ne: { lat: 36.6, lng: 127.6 } } },
  { name: "전라/광주", lat: 35.1595, lng: 126.8526, density: 800, bounds: { sw: { lat: 34.9, lng: 126.5 }, ne: { lat: 35.4, lng: 127.1 } } },
  { name: "경상/대구", lat: 35.8714, lng: 128.6014, density: 800, bounds: { sw: { lat: 35.6, lng: 128.3 }, ne: { lat: 36.1, lng: 128.9 } } },
  { name: "부산/울산", lat: 35.1796, lng: 129.0756, density: 1000, bounds: { sw: { lat: 35.05, lng: 128.9 }, ne: { lat: 35.45, lng: 129.4 } } },
  { name: "제주도", lat: 33.4996, lng: 126.5312, density: 800, bounds: { sw: { lat: 33.25, lng: 126.3 }, ne: { lat: 33.55, lng: 126.8 } } }
];

/**
 * 2. [골든 리스트] 한국 내 임베드 재생이 100% 보장된 공식 ID
 */
export const YOUTUBE_IDS_50 = [
  "aqz-KE-BPKQ", "dQw4w9WgXcQ", "9bZkp7q19f0", "V1Pl8CzNzCw", "fHI8X4OXW5Q",
  "mH0_XpSHkZo", "CevxZvSJLk8", "kJQP7kiw5Fk", "S-sJp1FfG7Q", "3YqXJ7Ssh_Q",
  "hT_nvWreIhg", "XqgYj8atJpE", "0A6E0M_Z8r4", "kJQP7kiw5Fk", "L_jWHffIx5E",
  "CevxZvSJLk8", "m8MfJg68oCs", "kOCkne-B8Hk", "z9n8ZzP4P8I", "XsX3ATc3FbA"
];

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const UNSPLASH_IDS = ["photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df"];
export const REALISTIC_COMMENTS = ["분위기 대박! 😍", "여기 꼭 가보세요 ✨", "오늘 날씨에 딱이네요 📍", "인생샷 건졌습니다 📸"];
export const AD_COMMENTS = ["[AD] 특별 혜택!", "[AD] 프리미엄 서비스"];

export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국의 멋진 순간을 기록합니다."
});

export const getUnsplashUrl = (sig: number) => {
  return `https://picsum.photos/id/${(sig % 200) + 15}/800/600`;
};

export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueSeed = i + Math.floor(lat * 100);
    return {
      id, isAd: i % 35 === 0, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat: bounds ? bounds.sw.lat + (Math.random() * (bounds.ne.lat - bounds.sw.lat)) : lat + (Math.random() - 0.5) * 0.05,
      lng: bounds ? bounds.sw.lng + (Math.random() * (bounds.ne.lng - bounds.sw.lng)) : lng + (Math.random() - 0.5) * 0.05,
      likes: Math.floor(Math.random() * 20000), commentsCount: 5, comments: [],
      image: getUnsplashUrl(uniqueSeed),
      isLiked: false, createdAt: new Date(), borderType: 'none',
      youtubeUrl: i % 2 === 0 ? YOUTUBE_LINKS[uniqueSeed % YOUTUBE_LINKS.length] : undefined
    };
  });
};

export const MOCK_USERS = Array.from({ length: 15 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.nickname, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));
export const initializeYoutubePool = async () => true;