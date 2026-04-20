"use client";

import { Post, User } from '@/types';
import { getYoutubeThumbnail } from './utils';

/**
 * 1. 기초 유틸리티
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

/**
 * 2. 이미지 다양성 극대화 로직 (500개 이상의 체감 효과)
 */
const IMAGE_CATEGORIES = [
  'seoul', 'korea', 'travel', 'nightview', 'street', 'cafe', 'mountain', 
  'ocean', 'forest', 'architecture', 'fashion', 'interior', 'minimal', 
  'lifestyle', 'people', 'landscape', 'sunset', 'art', 'urban', 'culture'
];

export const getUnsplashUrl = (sig: number) => {
  // 카테고리를 sig에 따라 다양하게 배정 (20개 카테고리)
  const category = IMAGE_CATEGORIES[sig % IMAGE_CATEGORIES.length];
  
  // 1/4 확률로 Picsum 사용 (완전 무작위성 확보)
  if (sig % 4 === 0) {
    return `https://picsum.photos/seed/${sig}/800/600`;
  }
  
  // 3/4 확률로 Unsplash 키워드 + 고유 시드 조합 (실질적으로 무제한 풀)
  // images.unsplash.com/featured 로 요청하면 키워드에 맞는 최신 이미지를 가져옵니다.
  return `https://images.unsplash.com/featured/?${category}&sig=${sig}`;
};

/**
 * 3. 유튜브 및 기타 리소스 (기존 유지)
 */
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

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const FOOD_UNSPLASH_IDS = ["photo-1504674900247-0877df9cc836", "photo-1512621776951-a57141f2eefd", "photo-1476224203421-9ac3993c4c5a", "photo-1493770348161-1482049016688"];
export const UNSPLASH_IDS = ["photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531"]; // 이제 getUnsplashUrl에서 키워드를 쓰므로 ID 풀은 상징적으로만 둡니다.

export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.42, lng: 126.75 }, ne: { lat: 37.72, lng: 127.2 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.04, lng: 128.89 }, ne: { lat: 35.31, lng: 129.23 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.21, lng: 126.21 }, ne: { lat: 33.55, lng: 126.91 } } }
];

export const REALISTIC_COMMENTS = ["여기 정말 추천해요! 😍", "오늘 날씨 대박 ✨", "인생샷 건졌습니다 📸", "다음에 또 오고 싶네요 📍"];
export const AD_COMMENTS = ["[AD] 지금 할인 중!", "[AD] 프리미엄 서비스를 만나보세요."];

export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "탐험가입니다. 📍"
});

export const validateYoutubeVideo = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return response.ok;
  } catch {
    return false;
  }
};

export const initializeYoutubePool = async () => true;

/**
 * 4. 메인 포스팅 모킹 함수
 */
export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number = 15, 
  specificUserId?: string,
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const isAd = i % 25 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    // [중요] 생성 시점마다 고유한 시드를 만들어 이미지 중복 완전 차단
    const randomSeed = Math.floor(Math.random() * 10000000);
    
    const hasYoutube = !isAd && (i % 2 === 0); 
    const ytId = hasYoutube ? YOUTUBE_IDS_50[randomSeed % YOUTUBE_IDS_50.length] : undefined;
    const youtubeUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined;

    let lat, lng;
    if (bounds) {
      lat = bounds.sw.lat + (randomFn() * (bounds.ne.lat - bounds.sw.lat));
      lng = bounds.sw.lng + (randomFn() * (bounds.ne.lng - bounds.sw.lng));
    } else {
      lat = centerLat + (randomFn() - 0.5) * 0.05;
      lng = centerLng + (randomFn() - 0.5) * 0.05;
    }
    
    let image = "";
    if (isAd) {
      image = `https://images.unsplash.com/featured/?food,restaurant&sig=${randomSeed}`;
    } else if (youtubeUrl) {
      image = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    } else {
      image = getUnsplashUrl(randomSeed);
    }

    return {
      id, isAd, isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: getUserById(isAd ? 'ad_partner' : (specificUserId || `user_${id.substring(0, 3)}`)),
      content: isAd ? AD_COMMENTS[i % AD_COMMENTS.length] : REALISTIC_COMMENTS[randomSeed % REALISTIC_COMMENTS.length],
      location: '대한민국', lat, lng,
      likes: Math.floor(randomFn() * 10000),
      commentsCount: Math.floor(randomFn() * 15),
      comments: [], image, isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType, youtubeUrl
    };
  });
};

export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.name, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));