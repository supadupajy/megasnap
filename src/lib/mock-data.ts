"use client";

import { Post, User } from '@/types';

/**
 * 1. 전국구 지역 데이터 (밀집도 분산)
 */
export const MAJOR_CITIES = [
  { name: "서울/수도권", lat: 37.5665, lng: 126.9780, density: 1000, bounds: { sw: { lat: 37.2, lng: 126.6 }, ne: { lat: 37.8, lng: 127.3 } } },
  { name: "강원/동해", lat: 37.7511, lng: 128.8761, density: 400, bounds: { sw: { lat: 37.3, lng: 127.8 }, ne: { lat: 38.2, lng: 129.3 } } },
  { name: "충청/대전", lat: 36.3504, lng: 127.3845, density: 400, bounds: { sw: { lat: 36.0, lng: 126.5 }, ne: { lat: 37.0, lng: 127.8 } } },
  { name: "전라/광주", lat: 35.1595, lng: 126.8526, density: 400, bounds: { sw: { lat: 34.5, lng: 126.2 }, ne: { lat: 35.8, lng: 127.5 } } },
  { name: "경상/대구", lat: 35.8714, lng: 128.6014, density: 400, bounds: { sw: { lat: 35.5, lng: 128.0 }, ne: { lat: 36.5, lng: 129.2 } } },
  { name: "부산/울산", lat: 35.1796, lng: 129.0756, density: 500, bounds: { sw: { lat: 35.0, lng: 128.7 }, ne: { lat: 35.6, lng: 129.5 } } },
  { name: "제주도", lat: 33.4996, lng: 126.5312, density: 500, bounds: { sw: { lat: 33.1, lng: 126.1 }, ne: { lat: 33.6, lng: 127.0 } } }
];

/**
 * 2. 검증된 "절대 재생 가능" 유튜브 ID 리스트 (글로벌 공식 영상 위주)
 */
export const YOUTUBE_IDS_50 = [
  "aqz-KE-BPKQ", "dQw4w9WgXcQ", "9bZkp7q19f0", "hXbZ7zS6SIs", "mH0_XpSHkZo",
  "CevxZvSJLk8", "V1Pl8CzNzCw", "fHI8X4OXW5Q", "kJQP7kiw5Fk", "S-sJp1FfG7Q",
  "3YqXJ7Ssh_Q", "n9N0zS5XvXw", "m8MfJg68oCs", "kOCkne-B8Hk", "z9n8ZzP4P8I",
  "XsX3ATc3FbA", "Lp_r9fX5Sfs", "7-qGKqveAnM", "XjJQBjWYDTs", "qV5lzRHrGeg",
  "2S24-y0Ij3Y", "SlPhMPnQ58k", "J6Z8WAt9v80", "l_S-v0V2Sbs", "fKopy74weus",
  "a5uQMwRMHcs", "POe9SOEKotU", "gQLQDnZ0yS8", "dyRsYk0ViA8", "rRzxEiBLQCA"
];

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const UNSPLASH_IDS = ["photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df"];

export const REALISTIC_COMMENTS = ["분위기 정말 대박이에요! 😍", "오늘 날씨랑 찰떡인 장소 발견! ✨", "인생샷 건졌습니다. 📸", "나만 알고 싶은 명소 공유해요! 📍"];
export const AD_COMMENTS = ["[AD] 특별한 혜택을 놓치지 마세요!", "[AD] 당신만을 위한 프리미엄 서비스."];

/**
 * 3. 유틸리티 및 에러 방지 함수
 */
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국의 멋진 순간을 기록합니다. 📍"
});

export const getUnsplashUrl = (sig: number) => {
  return `https://picsum.photos/id/${(sig % 200) + 10}/800/600`;
};

export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueSeed = i + Math.floor(lat * 100);
    return {
      id, isAd: i % 30 === 0, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat: bounds ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat) : lat + (Math.random() - 0.5) * 0.1,
      lng: bounds ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng) : lng + (Math.random() - 0.5) * 0.1,
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