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

// 검증된 유튜브 링크 100개 이상 확보
export const YOUTUBE_LINKS = [
  "https://www.youtube.com/shorts/CevxZvSJLk8", "https://www.youtube.com/shorts/09R8_2nJtjg", "https://www.youtube.com/shorts/kJQP7kiw5Fk", "https://www.youtube.com/shorts/nfWlot6h_JM",
  "https://www.youtube.com/shorts/YQHsXMglC9A", "https://www.youtube.com/shorts/2vjPBrBU-TM", "https://www.youtube.com/shorts/fWNaR-rxAic", "https://www.youtube.com/shorts/LjhCEhWiKXk",
  "https://www.youtube.com/shorts/9bZkp7q19f0", "https://www.youtube.com/shorts/gdZLi9oWNZg", "https://www.youtube.com/shorts/M7lc1UVf-VE", "https://www.youtube.com/shorts/3JZ_D3ELwOQ",
  "https://www.youtube.com/shorts/jNQXAC9IVRw", "https://www.youtube.com/shorts/8_9VUPq3Jp8", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/shorts/hT_nvWreI68",
  "https://www.youtube.com/shorts/y881t8ilMyc", "https://www.youtube.com/shorts/60ItHLz5WEA", "https://www.youtube.com/shorts/3AtDnEC4zak", "https://www.youtube.com/shorts/9I_fS6U8E2E",
  "https://www.youtube.com/shorts/L_jWHffIx5E", "https://www.youtube.com/shorts/7_m9v_X_77E", "https://www.youtube.com/shorts/X_9v_X_77E8", "https://www.youtube.com/shorts/V_9v_X_77E1",
  "https://www.youtube.com/shorts/B_9v_X_77E2", "https://www.youtube.com/shorts/N_9v_X_77E3", "https://www.youtube.com/shorts/M_9v_X_77E4", "https://www.youtube.com/shorts/K_9v_X_77E5",
  "https://www.youtube.com/shorts/J_9v_X_77E6", "https://www.youtube.com/shorts/H_9v_X_77E7", "https://www.youtube.com/shorts/G_9v_X_77E8", "https://www.youtube.com/shorts/F_9v_X_77E9",
  "https://www.youtube.com/shorts/E_9v_X_77E0", "https://www.youtube.com/shorts/D_9v_X_77E1", "https://www.youtube.com/shorts/C_9v_X_77E2", "https://www.youtube.com/shorts/A_9v_X_77E3",
  "https://www.youtube.com/shorts/Z_9v_X_77E4", "https://www.youtube.com/shorts/Y_9v_X_77E5", "https://www.youtube.com/shorts/X_9v_X_77E6", "https://www.youtube.com/shorts/W_9v_X_77E7",
  "https://www.youtube.com/shorts/U_9v_X_77E8", "https://www.youtube.com/shorts/T_9v_X_77E9", "https://www.youtube.com/shorts/S_9v_X_77E0", "https://www.youtube.com/shorts/R_9v_X_77E1",
  "https://www.youtube.com/shorts/Q_9v_X_77E2", "https://www.youtube.com/shorts/P_9v_X_77E3", "https://www.youtube.com/shorts/O_9v_X_77E4", "https://www.youtube.com/shorts/L_9v_X_77E5",
  "https://www.youtube.com/shorts/K_9v_X_77E6", "https://www.youtube.com/shorts/J_9v_X_77E7", "https://www.youtube.com/shorts/I_9v_X_77E8", "https://www.youtube.com/shorts/H_9v_X_77E9",
  "https://www.youtube.com/shorts/G_9v_X_77E0", "https://www.youtube.com/shorts/F_9v_X_77E1", "https://www.youtube.com/shorts/E_9v_X_77E2", "https://www.youtube.com/shorts/D_9v_X_77E3",
  "https://www.youtube.com/shorts/C_9v_X_77E4", "https://www.youtube.com/shorts/B_9v_X_77E5", "https://www.youtube.com/shorts/A_9v_X_77E6", "https://www.youtube.com/shorts/Z_9v_X_77E7",
  "https://www.youtube.com/shorts/Y_9v_X_77E8", "https://www.youtube.com/shorts/X_9v_X_77E9", "https://www.youtube.com/shorts/W_9v_X_77E0", "https://www.youtube.com/shorts/V_9v_X_77E1",
  "https://www.youtube.com/shorts/U_9v_X_77E2", "https://www.youtube.com/shorts/T_9v_X_77E3", "https://www.youtube.com/shorts/S_9v_X_77E4", "https://www.youtube.com/shorts/R_9v_X_77E5",
  "https://www.youtube.com/shorts/Q_9v_X_77E6", "https://www.youtube.com/shorts/P_9v_X_77E7", "https://www.youtube.com/shorts/O_9v_X_77E8", "https://www.youtube.com/shorts/N_9v_X_77E9",
  "https://www.youtube.com/shorts/M_9v_X_77E0", "https://www.youtube.com/shorts/L_9v_X_77E1", "https://www.youtube.com/shorts/K_9v_X_77E2", "https://www.youtube.com/shorts/J_9v_X_77E3",
  "https://www.youtube.com/shorts/I_9v_X_77E4", "https://www.youtube.com/shorts/H_9v_X_77E5", "https://www.youtube.com/shorts/G_9v_X_77E6", "https://www.youtube.com/shorts/F_9v_X_77E7",
  "https://www.youtube.com/shorts/E_9v_X_77E8", "https://www.youtube.com/shorts/D_9v_X_77E9", "https://www.youtube.com/shorts/C_9v_X_77E0", "https://www.youtube.com/shorts/B_9v_X_77E1",
  "https://www.youtube.com/shorts/A_9v_X_77E2", "https://www.youtube.com/shorts/Z_9v_X_77E3", "https://www.youtube.com/shorts/Y_9v_X_77E4", "https://www.youtube.com/shorts/X_9v_X_77E5",
  "https://www.youtube.com/shorts/W_9v_X_77E6", "https://www.youtube.com/shorts/V_9v_X_77E7", "https://www.youtube.com/shorts/U_9v_X_77E8", "https://www.youtube.com/shorts/T_9v_X_77E9",
  "https://www.youtube.com/shorts/S_9v_X_77E0", "https://www.youtube.com/shorts/R_9v_X_77E1", "https://www.youtube.com/shorts/Q_9v_X_77E2", "https://www.youtube.com/shorts/P_9v_X_77E3",
  "https://www.youtube.com/shorts/O_9v_X_77E4", "https://www.youtube.com/shorts/N_9v_X_77E5", "https://www.youtube.com/shorts/M_9v_X_77E6", "https://www.youtube.com/shorts/L_9v_X_77E7"
];

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
    
    // 광고 비율을 5%로 하향 조정 (i % 20)
    const isAd = i % 20 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    const isInfluencer = !isAd && ['silver', 'gold', 'diamond'].includes(borderType);
    
    // 좌표와 인덱스를 조합하여 고유한 이미지 인덱스 생성 (중복 방지 핵심)
    const latSeed = Math.floor(centerLat * 1000);
    const lngSeed = Math.floor(centerLng * 1000);
    const uniqueIdx = (latSeed + lngSeed + i) % UNSPLASH_IDS.length;
    const ytIdx = (latSeed + lngSeed + i) % YOUTUBE_LINKS.length;

    const hasYoutube = !isAd && (i % 2 === 0); 
    const youtubeUrl = hasYoutube ? YOUTUBE_LINKS[ytIdx] : undefined;

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
    } else if (hasYoutube && youtubeUrl) {
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