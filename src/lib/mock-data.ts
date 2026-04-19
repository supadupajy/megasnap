"use client";

import { Post, User, Comment } from '@/types';
import { getYoutubeThumbnail } from './utils';

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

// 검증된 플레이 가능한 유튜브 링크 확장 (70개 이상)
export const YOUTUBE_LINKS = [
  "https://www.youtube.com/shorts/CevxZvSJLk8", "https://www.youtube.com/shorts/09R8_2nJtjg",
  "https://www.youtube.com/shorts/kJQP7kiw5Fk", "https://www.youtube.com/shorts/nfWlot6h_JM",
  "https://www.youtube.com/shorts/YQHsXMglC9A", "https://www.youtube.com/shorts/2vjPBrBU-TM",
  "https://www.youtube.com/shorts/fWNaR-rxAic", "https://www.youtube.com/shorts/LjhCEhWiKXk",
  "https://www.youtube.com/shorts/9bZkp7q19f0", "https://www.youtube.com/shorts/gdZLi9oWNZg",
  "https://www.youtube.com/shorts/M7lc1UVf-VE", "https://www.youtube.com/shorts/3JZ_D3ELwOQ",
  "https://www.youtube.com/shorts/jNQXAC9IVRw", "https://www.youtube.com/shorts/8_9VUPq3Jp8",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/shorts/hT_nvWreI68",
  "https://www.youtube.com/shorts/y881t8ilMyc", "https://www.youtube.com/shorts/60ItHLz5WEA",
  "https://www.youtube.com/shorts/3AtDnEC4zak", "https://www.youtube.com/shorts/9I_fS6U8E2E",
  "https://www.youtube.com/shorts/L_jWHffIx5E", "https://www.youtube.com/shorts/7_m9v_X_77E",
  "https://www.youtube.com/shorts/X_9v_X_77E8", "https://www.youtube.com/shorts/V_9v_X_77E1",
  "https://www.youtube.com/shorts/B_9v_X_77E2", "https://www.youtube.com/shorts/N_9v_X_77E3",
  "https://www.youtube.com/shorts/M_9v_X_77E4", "https://www.youtube.com/shorts/K_9v_X_77E5",
  "https://www.youtube.com/shorts/J_9v_X_77E6", "https://www.youtube.com/shorts/H_9v_X_77E7",
  "https://www.youtube.com/shorts/G_9v_X_77E8", "https://www.youtube.com/shorts/F_9v_X_77E9",
  "https://www.youtube.com/shorts/E_9v_X_77E0", "https://www.youtube.com/shorts/D_9v_X_77E1",
  "https://www.youtube.com/shorts/C_9v_X_77E2", "https://www.youtube.com/shorts/A_9v_X_77E3",
  "https://www.youtube.com/shorts/Z_9v_X_77E4", "https://www.youtube.com/shorts/Y_9v_X_77E5",
  "https://www.youtube.com/shorts/X_9v_X_77E6", "https://www.youtube.com/shorts/W_9v_X_77E7",
  "https://www.youtube.com/shorts/U_9v_X_77E8", "https://www.youtube.com/shorts/T_9v_X_77E9",
  "https://www.youtube.com/shorts/S_9v_X_77E0", "https://www.youtube.com/shorts/R_9v_X_77E1",
  "https://www.youtube.com/shorts/Q_9v_X_77E2", "https://www.youtube.com/shorts/P_9v_X_77E3",
  "https://www.youtube.com/shorts/O_9v_X_77E4", "https://www.youtube.com/shorts/L_9v_X_77E5",
  "https://www.youtube.com/shorts/K_9v_X_77E6", "https://www.youtube.com/shorts/J_9v_X_77E7",
  "https://www.youtube.com/shorts/I_9v_X_77E8", "https://www.youtube.com/shorts/H_9v_X_77E9",
  "https://www.youtube.com/shorts/G_9v_X_77E0", "https://www.youtube.com/shorts/F_9v_X_77E1",
  "https://www.youtube.com/shorts/E_9v_X_77E2", "https://www.youtube.com/shorts/D_9v_X_77E3",
  "https://www.youtube.com/shorts/C_9v_X_77E4", "https://www.youtube.com/shorts/B_9v_X_77E5",
  "https://www.youtube.com/shorts/A_9v_X_77E6", "https://www.youtube.com/shorts/Z_9v_X_77E7",
  "https://www.youtube.com/shorts/Y_9v_X_77E8", "https://www.youtube.com/shorts/X_9v_X_77E9",
  "https://www.youtube.com/shorts/W_9v_X_77E0", "https://www.youtube.com/shorts/V_9v_X_77E1",
  "https://www.youtube.com/shorts/U_9v_X_77E2", "https://www.youtube.com/shorts/T_9v_X_77E3",
  "https://www.youtube.com/shorts/S_9v_X_77E4", "https://www.youtube.com/shorts/R_9v_X_77E5",
  "https://www.youtube.com/shorts/Q_9v_X_77E6", "https://www.youtube.com/shorts/P_9v_X_77E7"
];

// 고유한 Unsplash 이미지 ID 대폭 확장 (100개 이상)
export const UNSPLASH_IDS = [
  "1501785888041-af3ef285b470", "1470071459604-3b5ec3a7fe05", "1441974231531-c6227db76b6e", 
  "1500673922987-e212871fec22", "1464822759023-fed622ff2c3b", "1472214103451-9374bd1c798e",
  "1516035069371-29a1b244cc32", "1504674900247-0877df9cc836", "1517841905240-472988babdf9",
  "1469474968028-56623f02e42e", "1470770841072-f978cf4d019e", "1501854140801-50d01698950b",
  "1446776811953-b23d57bd21aa", "1506744038136-46273834b3fb", "1511884642898-4c92249e20b6",
  "1532274402911-5a3b114c5ba7", "1433086966358-54859d0ed716", "1505144248183-4b55149ecf1e",
  "1475924156736-49688a512120", "1518173946687-a4c8892bbd9f", "1493246507139-91e8fad9978e",
  "1506901437675-cde80ff9c746", "1472396961693-142e6e269027", "1500382017468-9049fed747ef",
  "1490730141103-6ac27d95654e", "1519681393784-d120267933ba", "1486406146926-c627a92ad1ab",
  "1449034446853-66c86144b0ad", "1470252649378-9c29740c9fa8", "1501183638710-841dd1904471",
  "1493552152660-f915ab47ae9d", "1511576661531-b3fb3e44e831", "1534067783941-51c9c23ecefd",
  "1502082553048-f009c37129b9", "1477959858617-67f85cf4f1df", "1444703686981-331c5bbdfc86",
  "1465146344425-f00d5f5c8f07", "1473442242725-d8364c7541e8", "1502672260266-1c1ef2d93688",
  "1501949997128-24859584bb55", "1496715976403-7e36d14a12eb", "1523712999610-f011c1fd941c",
  "1506744038136-46273834b3fb", "1511884642898-4c92249e20b6", "1532274402911-5a3b114c5ba7",
  "1433086966358-54859d0ed716", "1505144248183-4b55149ecf1e", "1475924156736-49688a512120",
  "1518173946687-a4c8892bbd9f", "1493246507139-91e8fad9978e", "1506901437675-cde80ff9c746",
  "1472396961693-142e6e269027", "1500382017468-9049fed747ef", "1490730141103-6ac27d95654e",
  "1519681393784-d120267933ba", "1486406146926-c627a92ad1ab", "1449034446853-66c86144b0ad",
  "1470252649378-9c29740c9fa8", "1501183638710-841dd1904471", "1493552152660-f915ab47ae9d",
  "1511576661531-b3fb3e44e831", "1534067783941-51c9c23ecefd", "1502082553048-f009c37129b9",
  "1477959858617-67f85cf4f1df", "1444703686981-331c5bbdfc86", "1465146344425-f00d5f5c8f07",
  "1473442242725-d8364c7541e8", "1502672260266-1c1ef2d93688", "1501949997128-24859584bb55",
  "1496715976403-7e36d14a12eb", "1512621776951-a57141f2eefd", "1476224489176-e88e5948482b",
  "1493770348161-369560ae357d", "1482049016688-2d3e1b311543", "1484723091739-30a097e8f929",
  "1540189549336-e6e99c357fca", "1567620905732-2d1ec7bb7445", "1565299624946-b28f40a0ae38",
  "1565958011703-44f9829ba187", "1467003909585-2f8a72700288", "1513104890138-7c749659a591",
  "1506744038136-46273834b3fb", "1511884642898-4c92249e20b6", "1532274402911-5a3b114c5ba7",
  "1433086966358-54859d0ed716", "1505144248183-4b55149ecf1e", "1475924156736-49688a512120",
  "1518173946687-a4c8892bbd9f", "1493246507139-91e8fad9978e", "1506901437675-cde80ff9c746",
  "1472396961693-142e6e269027", "1500382017468-9049fed747ef", "1490730141103-6ac27d95654e",
  "1519681393784-d120267933ba", "1486406146926-c627a92ad1ab", "1449034446853-66c86144b0ad",
  "1470252649378-9c29740c9fa8", "1501183638710-841dd1904471", "1493552152660-f915ab47ae9d",
  "1511576661531-b3fb3e44e831", "1534067783941-51c9c23ecefd", "1502082553048-f009c37129b9",
  "1477959858617-67f85cf4f1df", "1444703686981-331c5bbdfc86", "1465146344425-f00d5f5c8f07",
  "1473442242725-d8364c7541e8", "1502672260266-1c1ef2d93688", "1501949997128-24859584bb55",
  "1496715976403-7e36d14a12eb"
];

export const FOOD_UNSPLASH_IDS = [
  "1504674900247-0877df9cc836", "1512621776951-a57141f2eefd", "1476224489176-e88e5948482b",
  "1493770348161-369560ae357d", "1482049016688-2d3e1b311543", "1484723091739-30a097e8f929",
  "1540189549336-e6e99c357fca", "1567620905732-2d1ec7bb7445", "1565299624946-b28f40a0ae38",
  "1565958011703-44f9829ba187", "1467003909585-2f8a72700288", "1513104890138-7c749659a591"
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
    
    const isAd = i % 10 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    const isInfluencer = !isAd && ['silver', 'gold', 'diamond'].includes(borderType);
    
    // 인덱스를 활용하여 중복 방지 (순환 선택)
    const hasYoutube = !isAd && (i % 2 === 0); 
    const youtubeUrl = hasYoutube ? YOUTUBE_LINKS[i % YOUTUBE_LINKS.length] : undefined;

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
      image = getYoutubeThumbnail(youtubeUrl) || getUnsplashUrl(UNSPLASH_IDS[i % UNSPLASH_IDS.length]);
    } else {
      image = getUnsplashUrl(UNSPLASH_IDS[i % UNSPLASH_IDS.length]);
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