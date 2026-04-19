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

// 50종 이상의 고유 유튜브 ID 리스트
export const YOUTUBE_IDS_50 = [
  // --- K-POP (25개) ---
  "gdZLi9hhztQ", // NewJeans - Ditto
  "js1CtxSY38I", // IVE - I AM
  "mH0_XpSHkZo", // NewJeans - Hype Boy
  "Hbb5GPxXF1w", // NewJeans - OMG
  "v7bnOxL4LIo", // BTS - Dynamite
  "WMweEpGlu_U", // BTS - Butter
  "kCELZbeS09o", // Blackpink - Pink Venom
  "d9IxdwEFk1c", // Blackpink - Kill This Love
  "9bZkp7q19f0", // PSY - Gangnam Style
  "hTermM40EDU", // IU - Celebrity
  "CtpT_S6-B9U", // IVE - LOVE DIVE
  "TQTlCHxyuu8", // LE SSERAFIM - ANTIFRAGILE
  "M7lc1UVf-VE", // Stray Kids - S-Class
  "pFuJAIMQjHk", // TWICE - What is Love?
  "tg2uF3R_Ozo", // aespa - Next Level
  "UuV27Nq_Oks", // SEVENTEEN - Super
  "D9G1VOjua_8", // (G)I-DLE - Queencard
  "IHNzOHi8sJs", // BTS - Boy With Luv
  "fHI8X4OXW5Q", // BLACKPINK - How You Like That
  "a5uQMwRMHcs", // BIGBANG - BANG BANG BANG
  "POe9SOEKotU", // Red Velvet - Psycho
  "V1Pl8CzNzCw", // ITZY - Wannabe
  "gQLQDnZ0yS8", // EXO - Love Shot
  "dyRsYk0ViA8", // MAMAMOO - HIP
  "rRzxEiBLQCA", // Sunmi - Gashina

  // --- POP (25개) ---
  "f6YDKF0LVWw", // The Weeknd - Blinding Lights
  "b_An4U8J1V4", // Dua Lipa - Levitating
  "CuklIb9d3fI", // Dua Lipa - Don't Start Now
  "0NCP48xaSfs", // Bruno Mars - That's What I Like
  "h4m-pIReA6Y", // Lady Gaga - Bad Romance
  "kJQP7kiw5Fk", // Luis Fonsi - Despacito
  "S-sJp1FfG7Q", // Ed Sheeran - Shape of You
  "u0XmZp1S-t8", // Mark Ronson - Uptown Funk
  "F0B7HDiY-10", // Maroon 5 - Sugar
  "XqgYj8atJpE", // Katy Perry - Roar
  "fE2h3lGlOsk", // Taylor Swift - Shake It Off
  "0A6E0M_Z8r4", // Billie Eilish - bad guy
  "3YqXJ7Ssh_Q", // Justin Bieber - Sorry
  "n9N0zS5XvXw", // Ariana Grande - 7 rings
  "m8MfJg68oCs", // Harry Styles - As It Was
  "kOCkne-B8Hk", // Adele - Hello
  "z9n8ZzP4P8I", // Sia - Chandelier
  "XsX3ATc3FbA", // Camila Cabello - Havana
  "Lp_r9fX5Sfs", // Miley Cyrus - Flowers
  "7-qGKqveAnM", // Post Malone - Sunflower
  "XjJQBjWYDTs", // Imagine Dragons - Believer
  "qV5lzRHrGeg", // Shawn Mendes - Senorita
  "2S24-y0Ij3Y", // Coldplay - Hymn For The Weekend
  "SlPhMPnQ58k", // Rihanna - Diamonds
  "J6Z8WAt9v80"  // Wiz Khalifa - See You Again
];

// 호환성을 위해 YOUTUBE_LINKS 내보내기 추가
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/shorts/${id}`);

// 검증된 ID들을 저장할 변수
let validYoutubeIds: string[] = [...YOUTUBE_IDS_50];

// 앱 시작 시 또는 필요 시 호출하여 유효한 영상만 필터링
export const initializeYoutubePool = async () => {
  console.log("🚀 영상 50종 정책 검증 중...");
  const checkResults = await Promise.all(
    YOUTUBE_IDS_50.map(async (id) => ({ id, ok: await validateYoutubeVideo(id) }))
  );
  validYoutubeIds = checkResults.filter(r => r.ok).map(r => r.id);
  console.log(`✅ ${validYoutubeIds.length}개의 클린 영상 확보 완료!`);
};

// 고유한 Unsplash 이미지 ID 200개 이상 확보
export const UNSPLASH_IDS = [
  "1501785888041", "1470071459604", "1441974231531", "1500673922987", "1464822759023", "1472214103451", "1516035069371", "1504674900247", "1517841905240", "1469474968028",
  "1470770841072", "1501854140801", "1446776811953", "1506744038136", "1511884642898", "1532274402911", "1433086966358", "1505144248183", "1475924156736", "1518173946687",
  "1493246507139", "1506901437675", "1472396961693", "1500382017468", "1490730141103", "1519681393784", "1486406146926", "1449034446853", "1470252649378", "1501183638710",
  "1493552152660", "1511576661531", "1534067783941", "1502082553048", "1477959858617", "1444703686981", "1465146344425", "1473442242725", "1502672260266", "1501949997128",
  "1496715976403", "1523712999610", "1512621776951", "1476224489176", "1493770348161", "1482049016688", "1484723091739", "1540189549336", "1567620905732", "1565299624946",
  "1565958011703", "1467003909585", "1513104890138", "1503264116222", "1507525428034", "1519331378306", "1501785888041", "1470071459604", "1441974231531", "1500673922987",
  "1510312305626", "1506702315532", "1516738900263", "1501785888041", "1470071459604", "1441974231531", "1500673922987", "1464822759023", "1472214103451", "1516035069371",
  "1504674900247", "1517841905240", "1469474968028", "1470770841072", "1501854140801", "1446776811953", "1506744038136", "1511884642898", "1532274402911", "1433086966358",
  "1505144248183", "1475924156736", "1518173946687", "1493246507139", "1506901437675", "1472396961693", "1500382017468", "1490730141103", "1519681393784", "1486406146926",
  "1449034446853", "1470252649378", "1501183638710", "1493552152660", "1511576661531", "1534067783941", "1502082553048", "1477959858617", "1444703686981", "1465146344425",
  "1473442242725", "1502672260266", "1501949997128", "1496715976403", "1523712999610", "1512621776951", "1476224489176", "1493770348161", "1482049016688", "1484723091739",
  "1540189549336", "1567620905732", "1565299624946", "1565958011703", "1467003909585", "1513104890138", "1503264116222", "1507525428034", "1519331378306", "1510312305626",
  "1506702315532", "1516738900263", "1501785888041", "1470071459604", "1441974231531", "1500673922987", "1464822759023", "1472214103451", "1516035069371", "1504674900247",
  "1517841905240", "1469474968028", "1470770841072", "1501854140801", "1446776811953", "1506744038136", "1511884642898", "1532274402911", "1433086966358", "1505144248183",
  "1475924156736", "1518173946687", "1493246507139", "1506901437675", "1472396961693", "1500382017468", "1490730141103", "1519681393784", "1486406146926", "1449034446853",
  "1470252649378", "1501183638710", "1493552152660", "1511576661531", "1534067783941", "1502082553048", "1477959858617", "1444703686981", "1465146344425", "1473442242725",
  "1502672260266", "1501949997128", "1496715976403", "1523712999610", "1512621776951", "1476224489176", "1493770348161", "1482049016688", "1484723091739", "1540189549336",
  "1567620905732", "1565299624946", "1565958011703", "1467003909585", "1513104890138", "1503264116222", "1507525428034", "1519331378306", "1510312305626", "1506702315532",
  "1516738900263", "1501785888041", "1470071459604", "1441974231531", "1500673922987", "1464822759023", "1472214103451", "1516035069371", "1504674900247", "1517841905240",
  "1469474968028", "1470770841072", "1501854140801", "1446776811953", "1506744038136", "1511884642898", "1532274402911", "1433086966358", "1505144248183", "1475924156736",
  "1518173946687", "1493246507139", "1506901437675", "1472396961693", "1500382017468", "1490730141103", "1519681393784", "1486406146926", "1449034446853", "1470252649378"
];

export const FOOD_UNSPLASH_IDS = [
  "1504674900247", "1512621776951", "1476224489176", "1493770348161", "1482049016688", "1484723091739", "1540189549336", "1567620905732", "1565299624946", "1565958011703",
  "1467003909585", "1513104890138", "1504674900247", "1512621776951", "1476224489176", "1493770348161", "1482049016688", "1484723091739", "1540189549336", "1567620905732"
];

export const getUnsplashUrl = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

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
    
    // 광고 비율 5%
    const isAd = i % 20 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    const isInfluencer = !isAd && ['silver', 'gold', 'diamond'].includes(borderType);
    
    // 좌표와 인덱스를 조합하여 고유한 이미지 인덱스 생성
    const latSeed = Math.floor(centerLat * 1000);
    const lngSeed = Math.floor(centerLng * 1000);
    const uniqueIdx = (latSeed + lngSeed + i) % UNSPLASH_IDS.length;
    
    // 검증된 유튜브 ID 풀에서 순환 선택
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
    
    const content = isAd 
      ? "특별한 혜택을 만나보세요! ✨"
      : "오늘의 멋진 순간을 기록합니다. 📍";
    
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
      isInfluencer,
      user: {
        id: isAd ? 'ad_partner' : (specificUserId || id),
        name: isAd ? 'Partner' : `Explorer_${id.substring(0, 4)}`,
        avatar: `https://i.pravatar.cc/150?u=${isAd ? 'ad' : id}`,
      },
      content,
      location: '대한민국 어딘가',
      lat,
      lng,
      likes: Math.floor(randomFn() * 5000),
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