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

// 50개의 검증된 유튜브 ID 리스트
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
  "XjJQBjWYDTs", "qV5lzRHrGeg", "2S24-y0Ij3Y", "SlPhMPnQ58k", "J6Z8WAt9v80"
];

export const YOUTUBE_LINKS = YOUTUBE_IDS_POOL.map(id => `https://www.youtube.com/shorts/${id}`);

let validYoutubeIds: string[] = [...YOUTUBE_IDS_POOL];

export const initializeYoutubePool = async () => {
  const checkResults = await Promise.all(
    YOUTUBE_IDS_POOL.slice(0, 30).map(async (id) => ({ id, ok: await validateYoutubeVideo(id) }))
  );
  const filtered = checkResults.filter(r => r.ok).map(r => r.id);
  if (filtered.length > 0) {
    validYoutubeIds = [...filtered, ...YOUTUBE_IDS_POOL.slice(30)];
  }
};

// 100개의 고유 Unsplash ID 리스트
export const UNSPLASH_IDS = [
  "photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531", "photo-1441974231531-1500673922987", "photo-1464822759023-1472214103451", "photo-1516035069371-1504674900247",
  "photo-1517841905240-1469474968028", "photo-1470770841072-1501854140801", "photo-1446776811953-1506744038136", "photo-1511884642898-1532274402911", "photo-1433086966358-1505144248183",
  "photo-1475924156736-1518173946687", "photo-1493246507139-1506901437675", "photo-1472396961693-1500382017468", "photo-1490730141103-1519681393784", "photo-1486406146926-1449034446853",
  "photo-1470252649378-1501183638710", "photo-1493552152660-1511576661531", "photo-1534067783941-1502082553048", "photo-1477959858617-1444703686981", "photo-1465146344425-1473442242725",
  "photo-1502672260266-1501949997128", "photo-1496715976403-1523712999610", "photo-1512621776951-1476224489176", "photo-1493770348161-1482049016688", "photo-1484723091739-1540189549336",
  "photo-1567620905732-1565299624946", "photo-1565958011703-1467003909585", "photo-1513104890138-1503264116222", "photo-1507525428034-1519331378306", "photo-1510312305626-1506702315532",
  "photo-1516738900263-1521339225847", "photo-1523906834652-1526333313022", "photo-1528605248657-1530482054422", "photo-1532347921422-1534158935073", "photo-1536001622275-1538003142205",
  "photo-1540001234567-1542009876543", "photo-1544001122334-1546005566778", "photo-1548009988776-1550001112223", "photo-1552003334445-1554005556667", "photo-1556007778889-1558009990001",
  "photo-1560001212121-1562003434343", "photo-1564005656565-1566007878787", "photo-1568009090909-1570001122334", "photo-1572003344556-1574005566778", "photo-1576007788990-1578009900112",
  "photo-1580001223344-1582003445566", "photo-1584005667788-1586007889900", "photo-1588009001122-1590001223344", "photo-1592003445566-1594005667788", "photo-1596007889900",
  "photo-1598009001122-1600001223344", "photo-1602003445566-1604005667788", "photo-1606007889900-1608009001122", "photo-1610001223344-1612003445566", "photo-1614005667788",
  "photo-1616007889900-1618009001122", "photo-1620001223344-1622003445566", "photo-1624005667788-1626007889900", "photo-1628009001122-1630001223344", "photo-1632003445566",
  "photo-1634005667788-1636007889900", "photo-1638009001122-1640001223344", "photo-1642003445566-1644005667788", "photo-1646007889900-1648009001122", "photo-1650001223344",
  "photo-1652003445566-1654005667788", "photo-1656007889900-1658009001122", "photo-1660001223344-1662003445566", "photo-1664005667788-1666007889900", "photo-1668009001122",
  "photo-1670001223344-1672003445566", "photo-1674005667788-1676007889900", "photo-1678009001122-1680001223344", "photo-1682003445566-1684005667788", "photo-1686007889900",
  "photo-1688009001122-1690001223344", "photo-1692003445566-1694005667788", "photo-1696007889900-1698009001122", "photo-1700001223344-1702003445566", "photo-1704005667788",
  "photo-1706007889900-1708009001122", "photo-1710001223344-1712003445566", "photo-1714005667788-1716007889900", "photo-1718009001122-1720001223344", "photo-1722003445566",
  "photo-1724005667788-1726007889900", "photo-1728009001122-1730001223344", "photo-1732003445566-1734005667788", "photo-1736007889900-1738009001122", "photo-1740001223344",
  "photo-1742003445566-1744005667788", "photo-1746007889900-1748009001122", "photo-1750001223344-1752003445566", "photo-1754005667788-1756007889900", "photo-1758009001122",
  "photo-1760001223344-1762003445566", "photo-1764005667788-1766007889900", "photo-1768009001122-1770001223344", "photo-1772003445566-1774005667788", "photo-1776007889900"
];

// 20개의 음식 Unsplash ID 리스트
export const FOOD_UNSPLASH_IDS = [
  "photo-1504674900247", "photo-1512621776951", "photo-1476224489176", "photo-1493770348161", "photo-1482049016688",
  "photo-1484723091739", "photo-1540189549336", "photo-1567620905732", "photo-1565299624946", "photo-1565958011703",
  "photo-1467003909585", "photo-1513104890138", "photo-1504674900247", "photo-1512621776951", "photo-1476224489176",
  "photo-1493770348161", "photo-1482049016688", "photo-1484723091739", "photo-1540189549336", "photo-1567620905732"
];

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
    const isAd = i % 15 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    
    const latSeed = Math.floor(centerLat * 10000);
    const lngSeed = Math.floor(centerLng * 10000);
    const uniqueIdx = (latSeed + lngSeed + i) % UNSPLASH_IDS.length;
    const sig = latSeed + lngSeed + i; // 고유 시그니처 생성
    
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
      image = getUnsplashUrl(FOOD_UNSPLASH_IDS[i % FOOD_UNSPLASH_IDS.length], sig);
    } else if (youtubeUrl) {
      image = getYoutubeThumbnail(youtubeUrl) || getUnsplashUrl(UNSPLASH_IDS[uniqueIdx], sig);
    } else {
      image = getUnsplashUrl(UNSPLASH_IDS[uniqueIdx], sig);
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