"use client";

import { Post, User } from '@/types';

/**
 * 1. 기초 데이터 및 상수 (에러 해결 포인트)
 */
export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.42, lng: 126.75 }, ne: { lat: 37.72, lng: 127.2 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.04, lng: 128.89 }, ne: { lat: 35.31, lng: 129.23 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.21, lng: 126.21 }, ne: { lat: 33.55, lng: 126.91 } } }
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

// 에러 해결을 위해 명시적으로 export
export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);

// [에러 해결] Popular.tsx에서 찾는 UNSPLASH_IDS 추가
export const UNSPLASH_IDS = [
  "photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df", "photo-1464822759023-fed622ff2c3b", "photo-1514924013411-cbf25faa35bb", "photo-1493246507139-1506901437675",
  "photo-1469474968028-56623f02e42e", "photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531", "photo-1441974231531-1500673922987", "photo-1532274402911-1506744038136"
];

export const REALISTIC_COMMENTS = ["분위기 정말 좋네요! 😍", "인생샷 건지고 갑니다 ✨", "추천받아 왔는데 만족스러워요 📍", "오늘 날씨 대박이네요! 🌈"];
export const AD_COMMENTS = ["[AD] 특별 할인 혜택!", "[AD] 지금 예약하세요."];

/**
 * 2. 유틸리티 함수 및 이미지 로직
 */
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `User_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `User_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "SNS 탐험가입니다."
});

// 중복 방지 이미지 URL 생성 (Picsum 200종 배정)
export const getUnsplashUrl = (sig: number) => {
  return `https://picsum.photos/id/${(sig % 200) + 10}/800/600`;
};

/**
 * 3. 메인 모킹 함수 (createMockPosts)
 */
export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const likes = Math.floor(Math.random() * 20000);
    const uniqueSeed = i + Math.floor(lat * 100);

    return {
      id, isAd: i % 30 === 0, isGif: false, 
      isInfluencer: likes > 12000,
      user: getUserById(userId || id),
      content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat: bounds ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat) : lat + (Math.random() - 0.5) * 0.1,
      lng: bounds ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng) : lng + (Math.random() - 0.5) * 0.1,
      likes, commentsCount: 5, comments: [],
      image: getUnsplashUrl(uniqueSeed),
      isLiked: false, createdAt: new Date(), borderType: 'none',
      youtubeUrl: i % 2 === 0 ? YOUTUBE_LINKS[uniqueSeed % YOUTUBE_LINKS.length] : undefined
    };
  });
};

/**
 * 4. UI 구성용 데이터 (StoryBar, Search 등)
 */
export const MOCK_USERS = Array.from({ length: 15 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.nickname, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));
export const initializeYoutubePool = async () => true;