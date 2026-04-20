"use client";

import { Post, User } from '@/types';
import { getYoutubeThumbnail } from './utils';

/**
 * 1. 기본 유틸리티 함수들
 */
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return ((hash - 1) / 2147483646) * 0.999999999999999;
  };
};

const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  if (val < 0.01) return 'diamond';
  if (val < 0.03) return 'gold';
  if (val < 0.07) return 'silver';
  if (val < 0.15) return 'popular';
  return 'none';
};

// [추가된 부분] 프로필 조회 등에 사용되는 함수
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "세상을 탐험하는 여행자입니다. 📍"
});

/**
 * 2. 데이터 풀 (이미지 100종, 유튜브 50종)
 */
export const UNSPLASH_IDS = [
  "photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531", "photo-1441974231531-1500673922987", "photo-1464822759023-1472214103451", "photo-1516035069371-1504674900247",
  "photo-1517841905240-1469474968028", "photo-1470770841072-1501854140801", "photo-1446776811953-1506744038136", "photo-1511884642898-1532274402911", "photo-1433086966358-1505144248183",
  "photo-1475924156736-1518173946687", "photo-1493246507139-1506901437675", "photo-1472396961693-1500382017468", "photo-1490730141103-1519681393784", "photo-1486406146926-1449034446853",
  "photo-1502672260266-1501949997128", "photo-1496715976403-1523712999610", "photo-1512621776951-1476224489176", "photo-1493770348161-1482049016688", "photo-1484723091739-1540189549336",
  // ... (사용자님이 가진 100개 리스트를 여기에 유지하셔도 좋습니다)
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

// 별칭으로도 사용할 수 있도록 추가
export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const FOOD_UNSPLASH_IDS = ["photo-1504674900247-0877df9cc836", "photo-1512621776951-a57141f2eefd", "photo-1476224203421-9ac3993c4c5a", "photo-1493770348161-1482049016688"];

/**
 * 3. 지역 및 텍스트 설정
 */
export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.42, lng: 126.75 }, ne: { lat: 37.72, lng: 127.2 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.04, lng: 128.89 }, ne: { lat: 35.31, lng: 129.23 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.21, lng: 126.21 }, ne: { lat: 33.55, lng: 126.91 } } }
];

export const REALISTIC_COMMENTS = ["여기 분위기 진짜 대박이에요! 😍", "오늘 날씨랑 찰떡인 장소 발견! ✨", "인생샷 건졌습니다. 📸"];
export const AD_COMMENTS = ["[AD] 특별한 혜택을 만나보세요!", "[AD] 당신의 일상을 특별하게."];

/**
 * 4. 핵심 생성 함수 (Export 필수)
 */
export const getUnsplashUrl = (id: string, sig?: number) => {
  const baseUrl = `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=800`;
  return sig !== undefined ? `${baseUrl}&sig=${sig}` : baseUrl;
};

export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number = 15, 
  specificUserId?: string,
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  return Array.from({ length: count }).map((_, i) => {
    const id = specificUserId ? `${specificUserId}_post_${i}` : Math.random().toString(36).substr(2, 9);
    const isAd = i % 25 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    const sig = Math.floor(centerLat * 1000) + Math.floor(centerLng * 1000) + i;
    
    const hasYoutube = !isAd && (i % 2 === 0); 
    const ytId = hasYoutube ? YOUTUBE_IDS_50[sig % YOUTUBE_IDS_50.length] : undefined;
    const youtubeUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined;

    let lat, lng;
    if (bounds) {
      lat = bounds.sw.lat + (randomFn() * (bounds.ne.lat - bounds.sw.lat));
      lng = bounds.sw.lng + (randomFn() * (bounds.ne.lng - bounds.sw.lng));
    } else {
      lat = centerLat + (randomFn() - 0.5) * 0.1;
      lng = centerLng + (randomFn() - 0.5) * 0.1;
    }
    
    let image = "";
    if (isAd) {
      image = getUnsplashUrl(FOOD_UNSPLASH_IDS[i % FOOD_UNSPLASH_IDS.length], sig);
    } else if (youtubeUrl) {
      image = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    } else {
      image = getUnsplashUrl(UNSPLASH_IDS[sig % UNSPLASH_IDS.length], sig);
    }

    return {
      id,
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: {
        id: isAd ? 'ad_partner' : (specificUserId || `user_${id.substring(0, 3)}`),
        name: isAd ? 'Partner' : `Explorer_${id.substring(0, 4)}`,
        avatar: `https://i.pravatar.cc/150?u=${isAd ? 'ad' : id}`,
      },
      content: isAd ? AD_COMMENTS[i % AD_COMMENTS.length] : REALISTIC_COMMENTS[i % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat,
      lng,
      likes: Math.floor(randomFn() * 10000),
      commentsCount: Math.floor(randomFn() * 30),
      comments: [],
      image,
      isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType,
      youtubeUrl
    };
  });
};

// 스토리 및 사용자 리스트 (에러 방지용 추가)
export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({
  id: u.id,
  name: u.name,
  avatar: u.avatar,
  hasUpdate: Math.random() > 0.5
}));