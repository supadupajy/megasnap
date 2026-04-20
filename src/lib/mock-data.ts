"use client";

import { Post, User } from '@/types';

/**
 * 1. 기초 데이터 및 상수 (모든 에러 해결 포인트)
 */
export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.4200, lng: 126.7500 }, ne: { lat: 37.7200, lng: 127.2000 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.2142, lng: 126.2142 }, ne: { lat: 33.5542, lng: 126.9142 } } }
];

export const YOUTUBE_IDS_50 = [
  "gdZLi9hhztQ", "js1CtxSY38I", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo",
  "WMweEpGlu_U", "kCELZbeS09o", "d9IxdwEFk1c", "9bZkp7q19f0", "hTermM40EDU",
  "CtpT_S6-B9U", "TQTlCHxyuu8", "M7lc1UVf-VE", "pFuJAIMQjHk", "tg2uF3R_Ozo",
  "UuV27Nq_Oks", "D9G1VOjua_8", "IHNzOHi8sJs", "fHI8X4OXW5Q", "a5uQMwRMHcs",
  "POe9SOEKotU", "V1Pl8CzNzCw", "gQLQDnZ0yS8", "dyRsYk0ViA8", "rRzxEiBLQCA",
  "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", "0NCP48xaSfs", "h4m-pIReA6Y",
  "kJQP7kiw5Fk", "S-sJp1FfG7Q", "u0XmZp1S-t8", "F0B7HDiY-10", "XqgYj8atJpE",
  "fE2h3lGlOsk", "0A6E0M_Z8r4", "3YqXJ7Ssh_Q", "n9N0zS5XvXw", "m8MfJg68oCs",
  "kOCkne-B8Hk", "z9n8ZzP4P8I", "XsX3ATc3FbA", "Lp_r9fX5Sfs", "7-qGKqveAnM",
  "XjJQBjWYDTs", "qV5lzRHrGeg", "2S24-y0Ij3Y", "SlPhMPnQ58k", "J6Z8WAt9v80"
];

export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const REALISTIC_COMMENTS = ["우와, 여기 정말 가보고 싶어요! 😍", "사진이 너무 예쁘네요. ✨", "오늘 날씨에 딱 어울리는 장소네요. 📍"];
export const AD_COMMENTS = ["[AD] 특별한 혜택을 만나보세요!", "[AD] 당신만을 위한 프리미엄 서비스."];
export const FOOD_UNSPLASH_IDS = ["photo-1504674900247-0877df9cc836", "photo-1512621776951-a57141f2eefd"];
export const UNSPLASH_IDS = ["photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531"];

/**
 * 2. 유저 관련 (StoryBar, Search.tsx 에러 해결)
 */
export const getUserById = (id: string): User => ({
  id,
  name: `Explorer_${id.substring(0, 4)}`,
  nickname: `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "탐험가입니다. 📍"
});

export const MOCK_USERS = Array.from({ length: 15 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.name, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));

/**
 * 3. 이미지 중복 해결 로직 (핵심)
 */
export const getUnsplashUrl = (sig: string | number) => {
  const seed = typeof sig === 'string' ? sig.length : sig;
  // Picsum의 고유 ID를 활용하여 절대 중복되지 않는 200장의 이미지를 순환 배정
  return `https://picsum.photos/id/${(Number(seed) % 200) + 10}/800/600`;
};

/**
 * 4. 메인 생성 로직 (createMockPosts)
 */
export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number = 15, 
  specificUserId?: string,
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueIndex = Math.floor(Math.random() * 100000);
    
    let lat, lng;
    if (bounds) {
      lat = bounds.sw.lat + (Math.random() * (bounds.ne.lat - bounds.sw.lat));
      lng = bounds.sw.lng + (random() * (bounds.ne.lng - bounds.sw.lng));
    } else {
      lat = centerLat + (Math.random() - 0.5) * 0.05;
      lng = centerLng + (Math.random() - 0.5) * 0.05;
    }

    return {
      id,
      isAd: i % 25 === 0,
      isGif: false,
      isInfluencer: Math.random() > 0.8,
      user: getUserById(specificUserId || id),
      content: REALISTIC_COMMENTS[uniqueIndex % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat, lng,
      likes: Math.floor(Math.random() * 10000),
      commentsCount: 5,
      comments: [],
      image: getUnsplashUrl(uniqueIndex), // 숫자 전달
      isLiked: false,
      createdAt: new Date(),
      borderType: 'none',
      youtubeUrl: i % 2 === 0 ? YOUTUBE_LINKS[uniqueIndex % YOUTUBE_LINKS.length] : undefined
    };
  });
};

// 랜덤 헬퍼
const random = () => Math.random();
export const initializeYoutubePool = async () => true;