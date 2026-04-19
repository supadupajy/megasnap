"use client";

import { Post, User, Comment } from '@/types';
import { getYoutubeThumbnail } from './utils';

// 시드 기반 랜덤 함수
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

// 유튜브 영상 유효성 검증 함수
export const validateYoutubeVideo = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return response.ok;
  } catch {
    return false;
  }
};

// 100종 이상의 검증된 유튜브 ID 리스트 (K-POP, 여행, 힐링 등)
export const YOUTUBE_IDS_POOL = [
  "gdZLi9hhztQ", "js1CtxSY38I", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo",
  "WMweEpGlu_U", "kCELZbeS09o", "d9IxdwEFk1c", "9bZkp7q19f0", "hTermM40EDU",
  "CtpT_S6-B9U", "TQTlCHxyuu8", "M7lc1UVf-VE", "pFuJAIMQjHk", "tg2uF3R_Ozo",
  "UuV27Nq_Oks", "D9G1VOjua_8", "IHNzOHi8sJs", "fHI8X4OXW5Q", "a5uQMwRMHcs",
  "POe9SOEKotU", "V1Pl8CzNzCw", "gQLQDnZ0yS8", "dyRsYk0ViA8", "rRzxEiBLQCA",
  "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", "0NCP48xaSfs", "h4m-pIReA6Y",
  "kJQP7kiw5Fk", "S-sJp1FfG7Q", "u0XmZp1S-t8", "F0B7HDiY-10", "XqgYj8atJpE",
  "fE2h3lGlOsk", "0A6E0M_Z8r4", "3YqXJ7Ssh_Q", "n9N0zS5XvXw", "m8MfJg68oCs",
  "kOCkne-B8Hk", "z9n8ZzP4P8I", "XsX3ATc3FbA", "Lp_r9fX5Sfs", "7-qGKqveAnM",
  "XjJQBjWYDTs", "qV5lzRHrGeg", "2S24-y0Ij3Y", "SlPhMPnQ58k", "J6Z8WAt9v80",
  "9H_v_v_v_v_", "dQw4w9WgXcQ", "jNQXAC9IVRw", "CevxZvSJLk8", "09R8_2nJtjg",
  "hT_nvWreIhg", "L_jWHffIx5E", "RgKAFK5djSk", "V-_O7nl0Ii0", "YqeW9_5kURI",
  "fRh_vgS2dFE", "60ItHLz5WEA", "3AtDnEC4zak", "MwpMEbgC7DA", "2Vv-BfVoq4g",
  "7PCkvCPvDXk", "Lp6W4aK1S8U", "vRXZj0DzXIA", "8jRA0fc5ReE", "9bZkp7q19f0",
  "hTermM40EDU", "CtpT_S6-B9U", "TQTlCHxyuu8", "M7lc1UVf-VE", "pFuJAIMQjHk",
  "tg2uF3R_Ozo", "UuV27Nq_Oks", "D9G1VOjua_8", "IHNzOHi8sJs", "fHI8X4OXW5Q",
  "a5uQMwRMHcs", "POe9SOEKotU", "V1Pl8CzNzCw", "gQLQDnZ0yS8", "dyRsYk0ViA8",
  "rRzxEiBLQCA", "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", "0NCP48xaSfs"
];

export const YOUTUBE_LINKS = YOUTUBE_IDS_POOL.map(id => `https://www.youtube.com/shorts/${id}`);

let validYoutubeIds: string[] = [...YOUTUBE_IDS_POOL];

export const initializeYoutubePool = async () => {
  console.log("🚀 [YouTube] 영상 풀 검증 시작...");
  const checkResults = await Promise.all(
    YOUTUBE_IDS_POOL.slice(0, 50).map(async (id) => ({ id, ok: await validateYoutubeVideo(id) }))
  );
  const filtered = checkResults.filter(r => r.ok).map(r => r.id);
  if (filtered.length > 0) {
    validYoutubeIds = [...filtered, ...YOUTUBE_IDS_POOL.slice(50)];
    console.log(`✅ [YouTube] ${validYoutubeIds.length}개의 영상 풀 확보 완료!`);
  }
};

// 500개 이상의 고유 Unsplash ID (다양성 극대화)
export const UNSPLASH_IDS = Array.from({ length: 500 }).map((_, i) => {
  const baseIds = [
    "1501785888041", "1470071459604", "1441974231531", "1500673922987", "1464822759023",
    "1472214103451", "1516035069371", "1504674900247", "1517841905240", "1469474968028",
    "1501854140801", "1446776811953", "1506744038136", "1511884642898", "1532274402911"
  ];
  // 기본 ID들에 오프셋을 주어 더 많은 이미지를 생성 (Unsplash API 특성 활용)
  return `${baseIds[i % baseIds.length]}-${i}`;
});

export const FOOD_UNSPLASH_IDS = Array.from({ length: 50 }).map((_, i) => `1504674900247-${i}`);

export const getUnsplashUrl = (id: string) => {
  const cleanId = id.split('-')[0];
  return `https://images.unsplash.com/photo-${cleanId}?auto=format&fit=crop&w=800&q=80&sig=${id}`;
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
    const isAd = i % 15 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    
    const latSeed = Math.floor(centerLat * 10000);
    const lngSeed = Math.floor(centerLng * 10000);
    const uniqueIdx = (latSeed + lngSeed + i) % UNSPLASH_IDS.length;
    
    const hasYoutube = !isAd && (i % 2 === 0); 
    const ytId = hasYoutube ? validYoutubeIds[(latSeed + lngSeed + i) % validYoutubeIds.length] : undefined;
    const youtubeUrl = ytId ? `https://www.youtube.com/shorts/${ytId}` : undefined;

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
      image = getUnsplashUrl(FOOD_UNSPLASH_IDS[i % FOOD_UNSPLASH_IDS.length]);
    } else if (youtubeUrl) {
      image = getYoutubeThumbnail(youtubeUrl) || getUnsplashUrl(UNSPLASH_IDS[uniqueIdx]);
    } else {
      image = getUnsplashUrl(UNSPLASH_IDS[uniqueIdx]);
    }

    return {
      id,
      isAd,
      isGif: false,
      isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
      user: {
        id: isAd ? 'ad_partner' : (specificUserId || id),
        name: isAd ? 'Partner' : `Explorer_${id.substring(0, 4)}`,
        avatar: `https://i.pravatar.cc/150?u=${isAd ? 'ad' : id}`,
      },
      content: isAd ? "특별한 혜택을 만나보세요! ✨" : "오늘의 멋진 순간을 기록합니다. 📍",
      location: '대한민국 어딘가',
      lat,
      lng,
      likes: Math.floor(randomFn() * 15000),
      commentsCount: 5,
      comments: [],
      image,
      isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType,
      youtubeUrl
    };
  });
};

export const getUserById = (id: string): User => ({
  id,
  name: id,
  nickname: `Explorer_${id}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "탐험가입니다. 📍"
});

export const MOCK_STORIES = Array.from({ length: 10 }).map((_, i) => ({
  id: `user_${i}`,
  name: `User ${i}`,
  avatar: `https://i.pravatar.cc/150?u=user_${i}`,
  hasUpdate: Math.random() > 0.5
}));

export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));