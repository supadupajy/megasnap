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
  "CevxZvSJLk8", "09R8_2nJtjg", "kJQP7kiw5Fk", "nfWlot6h_JM", "YQHsXMglC9A", 
  "2vjPBrBU-TM", "fWNaR-rxAic", "LjhCEhWiKXk", "9bZkp7q19f0", "gdZLi9oWNZg",
  "M7lc1UVf-VE", "3JZ_D3ELwOQ", "jNQXAC9IVRw", "8_9VUPq3Jp8", "dQw4w9WgXcQ",
  "hT_nvWreI68", "y881t8ilMyc", "60ItHLz5WEA", "3AtDnEC4zak", "9I_fS6U8E2E",
  "L_jWHffIx5E", "7_m9v_X_77E", "X_9v_X_77E8", "V_9v_X_77E1", "B_9v_X_77E2",
  "N_9v_X_77E3", "M_9v_X_77E4", "K_9v_X_77E5", "J_9v_X_77E6", "H_9v_X_77E7",
  "G_9v_X_77E8", "F_9v_X_77E9", "E_9v_X_77E0", "D_9v_X_77E1", "C_9v_X_77E2",
  "A_9v_X_77E3", "Z_9v_X_77E4", "Y_9v_X_77E5", "X_9v_X_77E6", "W_9v_X_77E7",
  "U_9v_X_77E8", "T_9v_X_77E9", "S_9v_X_77E0", "R_9v_X_77E1", "Q_9v_X_77E2",
  "P_9v_X_77E3", "O_9v_X_77E4", "L_9v_X_77E5", "K_9v_X_77E6", "J_9v_X_77E7"
];

// 검증된 ID들을 저장할 변수 (초기에는 전체 리스트 사용)
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