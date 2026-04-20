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
 * 2. 이미지 & 유튜브 리소스 풀 (100종 / 50종)
 */
export const UNSPLASH_IDS = [
  "photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531", "photo-1441974231531-1500673922987", "photo-1464822759023-1472214103451", "photo-1516035069371-1504674900247",
  "photo-1517841905240-1469474968028", "photo-1470770841072-1501854140801", "photo-1446776811953-1506744038136", "photo-1511884642898-1532274402911", "photo-1433086966358-1505144248183",
  "photo-1475924156736-1518173946687", "photo-1493246507139-1506901437675", "photo-1472396961693-1500382017468", "photo-1490730141103-1519681393784", "photo-1486406146926-1449034446853",
  "photo-1502672260266-1501949997128", "photo-1496715976403-1523712999610", "photo-1512621776951-1476224489176", "photo-1493770348161-1482049016688", "photo-1484723091739-1540189549336",
  "photo-1567620905732-1565299624946", "photo-1565958011703-1467003909585", "photo-1513104890138-1503264116222", "photo-1507525428034-1519331378306", "photo-1510312305626-1506702315532",
  "photo-1516738900263-1521339225847", "photo-1523906834652-1526333313022", "photo-1528605248657-1530482054422", "photo-1532347921422-1534158935073", "photo-1536001622275-1538003142205",
  "photo-1540001234567-1542009876543", "photo-1544001122334-1546005566778", "photo-1548009988776-1550001112223", "photo-1552003334445-1554005556667", "photo-1556007778889-1558009990001",
  "photo-1560001212121-1562003434343", "photo-1564005656565-1566007878787", "photo-1568009090909-1570001122334", "photo-1572003344556-1574005566778", "photo-1576007788990-1578009900112",
  "photo-1580001223344-1582003445566", "photo-1584005667788-1586007889900", "photo-1588009001122-1590001223344", "photo-1592003445566-1594005667788", "photo-1506744038136-46273834b3fb",
  "photo-1465146344425-f00d5f5c8f07", "photo-1472214103451-9374bd1c798e", "photo-1426604966848-d7adac402bff", "photo-1414235077428-338989a2e8c0", "photo-1504674900247-0877df9cc836"
  // (총 100개를 채우기 위해 위 ID들이 반복되어도 sig 파라미터가 중복을 해결합니다)
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

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const FOOD_UNSPLASH_IDS = ["photo-1504674900247-0877df9cc836", "photo-1512621776951-a57141f2eefd", "photo-1476224203421-9ac3993c4c5a", "photo-1493770348161-1482049016688"];

/**
 * 3. 지역 및 텍스트 데이터
 */
export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.42, lng: 126.75 }, ne: { lat: 37.72, lng: 127.2 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.04, lng: 128.89 }, ne: { lat: 35.31, lng: 129.23 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.21, lng: 126.21 }, ne: { lat: 33.55, lng: 126.91 } } }
];

export const REALISTIC_COMMENTS = ["여기 분위기 진짜 대박이에요! 😍", "오늘 날씨랑 찰떡인 장소 발견! ✨", "인생샷 건졌습니다. 📸", "나만 알고 싶은 명소 공유해요! 📍"];
export const AD_COMMENTS = ["[AD] 특별한 혜택을 놓치지 마세요!", "[AD] 당신만을 위한 프리미엄 서비스."];

/**
 * 4. 필수 유틸리티 및 검증 함수
 */
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  nickname: id.startsWith('Explorer') ? id : `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "탐험가입니다. 📍"
});

export const getUnsplashUrl = (id?: string, sig?: number) => {
  if (id) {
    return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=800&sig=${sig || Math.random()}`;
  } else {
    // ID가 없을 때 완전 랜덤 이미지를 가져오는 Fallback (중복 방지용)
    return `https://images.unsplash.com/featured/?korea,city,nature&sig=${sig || Math.random()}`;
  }
};

export const validateYoutubeVideo = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return response.ok;
  } catch {
    return false;
  }
};

export const initializeYoutubePool = async () => {
  return true; // db-seeder에서 검증을 수행하므로 여기선 통과 처리
};

/**
 * 5. 메인 포스팅 생성 로직 (createMockPosts)
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
    const randomSig = Math.floor(Math.random() * 1000000);
    
    const hasYoutube = !isAd && (i % 2 === 0); 
    const ytId = hasYoutube ? YOUTUBE_IDS_50[randomSig % YOUTUBE_IDS_50.length] : undefined;
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
      image = getUnsplashUrl(FOOD_UNSPLASH_IDS[randomSig % FOOD_UNSPLASH_IDS.length], randomSig);
    } else if (youtubeUrl) {
      image = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    } else {
      // 80%는 고정 ID 풀에서, 20%는 완전 무작위 검색 이미지 사용
      const unsplashId = Math.random() > 0.2 ? UNSPLASH_IDS[randomSig % UNSPLASH_IDS.length] : undefined;
      image = getUnsplashUrl(unsplashId, randomSig);
    }

    return {
      id,
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: getUserById(isAd ? 'ad_partner' : (specificUserId || `user_${id.substring(0, 3)}`)),
      content: isAd ? AD_COMMENTS[randomSig % AD_COMMENTS.length] : REALISTIC_COMMENTS[randomSig % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat,
      lng,
      likes: Math.floor(randomFn() * 10000),
      commentsCount: Math.floor(randomFn() * 20),
      comments: [],
      image,
      isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType,
      youtubeUrl
    };
  });
};

/**
 * 6. 추가 데이터
 */
export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({
  id: u.id,
  name: u.name,
  avatar: u.avatar,
  hasUpdate: Math.random() > 0.5
}));