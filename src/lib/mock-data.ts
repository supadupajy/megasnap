"use client";

import { Post, User } from '@/types';

/**
 * 1. 전국구 지역 데이터 (밀집도 분산)
 */
export const MAJOR_CITIES = [
  { name: "서울/수도권", lat: 37.5665, lng: 126.9780, density: 600, bounds: { sw: { lat: 37.2, lng: 126.6 }, ne: { lat: 37.8, lng: 127.3 } } },
  { name: "강원/동해", lat: 37.7511, lng: 128.8761, density: 400, bounds: { sw: { lat: 37.3, lng: 127.8 }, ne: { lat: 38.2, lng: 129.3 } } },
  { name: "충청/대전", lat: 36.3504, lng: 127.3845, density: 400, bounds: { sw: { lat: 36.0, lng: 126.5 }, ne: { lat: 37.0, lng: 127.8 } } },
  { name: "전라/광주", lat: 35.1595, lng: 126.8526, density: 400, bounds: { sw: { lat: 34.5, lng: 126.2 }, ne: { lat: 35.8, lng: 127.5 } } },
  { name: "경상/대구", lat: 35.8714, lng: 128.6014, density: 400, bounds: { sw: { lat: 35.5, lng: 128.0 }, ne: { lat: 36.5, lng: 129.2 } } },
  { name: "부산/울산", lat: 35.1796, lng: 129.0756, density: 400, bounds: { sw: { lat: 35.0, lng: 128.7 }, ne: { lat: 35.6, lng: 129.5 } } },
  { name: "제주도", lat: 33.4996, lng: 126.5312, density: 400, bounds: { sw: { lat: 33.1, lng: 126.1 }, ne: { lat: 33.6, lng: 127.0 } } }
];

/**
 * 2. 유튜브 검증 리스트 (가장 안정적인 공식 영상들)
 */
export const YOUTUBE_IDS_50 = [
  "gdZLi9hhztQ", "js1CtxSY38I", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo",
  "WMweEpGlu_U", "kCELZbeS09o", "d9IxdwEFk1c", "9bZkp7q19f0", "hTermM40EDU",
  "CtpT_S6-B9U", "TQTlCHxyuu8", "M7lc1UVf-VE", "pFuJAIMQjHk", "tg2uF3R_Ozo",
  "UuV27Nq_Oks", "D9G1VOjua_8", "IHNzOHi8sJs", "fHI8X4OXW5Q", "a5uQMwRMHcs",
  "POe9SOEKotU", "V1Pl8CzNzCw", "gQLQDnZ0yS8", "dyRsYk0ViA8", "rRzxEiBLQCA",
  "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", "0NCP48xaSfs", "h4m-pIReA6Y"
];

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const UNSPLASH_IDS = ["photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531"];

export const REALISTIC_COMMENTS = ["분위기 정말 좋네요! 😍", "인생샷 건지고 갑니다 ✨", "추천받아 왔는데 만족스러워요 📍", "경치가 예술입니다! 🌈"];
export const AD_COMMENTS = ["[AD] 특별 할인 혜택!", "[AD] 프리미엄 서비스를 만나보세요."];

/**
 * 3. 필수 유틸리티 Export
 */
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `User_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `User_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국을 탐험하는 여행자입니다."
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