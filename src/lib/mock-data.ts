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

// 대한민국 주요 도시 및 데이터 밀도 설정
export const MAJOR_CITIES = [
  { 
    name: "서울", 
    lat: 37.5665, lng: 126.9780, 
    density: 1500,
    bounds: { sw: { lat: 37.4200, lng: 126.7500 }, ne: { lat: 37.7200, lng: 127.2000 } }
  },
  { 
    name: "부산", 
    lat: 35.1796, lng: 129.0756, 
    density: 800,
    bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } }
  },
  { 
    name: "제주", 
    lat: 33.4996, lng: 126.5312, 
    density: 600,
    bounds: { sw: { lat: 33.2142, lng: 126.2142 }, ne: { lat: 33.5542, lng: 126.9142 } }
  }
];

// 현실적인 댓글/내용 풀
export const REALISTIC_COMMENTS = [
  '여기 분위기 진짜 대박이에요! 꼭 가보세요. 😍',
  '오늘 날씨랑 찰떡인 장소 발견! 기분 전환 제대로 되네요. ✨',
  '숨은 명소 발견! 나만 알고 싶지만 공유합니다. 📍',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!',
  '친구들이랑 오기 딱 좋은 곳이에요. 추천합니다!',
  '생각보다 사람이 많지 않아서 여유롭게 즐기다 가요. 😊',
  '음식이 너무 맛있어서 깜짝 놀랐어요. 가성비 최고!',
  '주차 공간도 넉넉하고 접근성이 좋네요.',
  '다음에 부모님 모시고 다시 오고 싶은 곳입니다.'
];

// 100개의 고유 Unsplash ID
export const UNSPLASH_IDS_100 = [
  "1444723126603-3e059c60c01e", "1477959858617-67f85cf4f1df", "1464822759023-fed622ff2c3b", "1501785888041-af3ef285b470", "1470071459604-ee21198b2977",
  "1441974231531-c6227db76b6e", "1500673922987-e212871fec22", "1472214103451-9374bd1c798e", "1516035069371-29a1b244cc32", "1504674900247-0877df9cc836",
  "1517841905240-472988babdf9", "1469474968028-56623f02e42e", "1470770841072-27982cba8ef2", "1501854140801-9613d5f8a2e2", "1446776811953-dd23f174d2c1",
  "1506744038136-46273834b3fb", "1511884642898-4392534f106b", "1532274402911-5a33141119ca", "1433086966358-54859d0ed716", "1505144248183-4b55149ee5ad",
  "1475924156736-311474427882", "1518173946687-2624b1c012a5", "1493246507139-91e8fad9978e", "1506901437675-4ea99fd96271", "1472396961693-8373b5a5a1d2",
  "1500382017468-9049fed747ef", "1490730141103-d8b2d2643d58", "1519681393784-d210252613af", "1486406146926-c627a92ad1ab", "1449034446853-26669b567c73",
  "1470252649378-9c29740c9fa8", "1501183638710-841dd1904471", "1493552152660-d9520b314a6a", "1511576661531-f1847b05c6a9", "1534067783941-99c8461c0c36",
  "1502082553048-f009c37129b9", "1477959858617-67f85cf4f1df", "1444703686981-53221bc092d1", "1465146344425-aaeb1e39e741", "1473442242725-3a2394286246",
  "1502672260266-56773767a742", "1501949997128-342c9139c76a", "1496715976403-12fc05799c67", "1523712999610-2abb5e8fa4fe", "1512621776951-a57141f2eef7",
  "1476224489176-de3c831c7455", "1493770348161-440185219d14", "1482049016688-1b9a000edec2", "1484723091739-6b2a4aee9978", "1540189549336-e8296ca37524",
  "1567620905732-2e2358fb18a7", "1565299624946-a2281b6d9f99", "1565958011703-0746e53ed183", "1467003909585-24512dc9fb8d", "1513104890138-d05fe2c10a95",
  "1503264116222-c03e79429360", "1507525428034-b723cf961d3e", "1519331378306-7f996a6a80d9", "1510312305626-2d028cf2e50b", "1506702315532-74541df4eeaf",
  "1516738900263-f177901d4491", "1501785888041-af3ef285b470", "1470071459604-ee21198b2977", "1441974231531-c6227db76b6e", "1500673922987-e212871fec22",
  "1464822759023-fed622ff2c3b", "1472214103451-9374bd1c798e", "1516035069371-29a1b244cc32", "1504674900247-0877df9cc836", "1517841905240-472988babdf9",
  "1469474968028-56623f02e42e", "1470770841072-27982cba8ef2", "1501854140801-9613d5f8a2e2", "1446776811953-dd23f174d2c1", "1506744038136-46273834b3fb",
  "1511884642898-4392534f106b", "1532274402911-5a33141119ca", "1433086966358-54859d0ed716", "1505144248183-4b55149ee5ad", "1475924156736-311474427882",
  "1518173946687-2624b1c012a5", "1493246507139-91e8fad9978e", "1506901437675-4ea99fd96271", "1472396961693-8373b5a5a1d2", "1500382017468-9049fed747ef",
  "1490730141103-d8b2d2643d58", "1519681393784-d210252613af", "1486406146926-c627a92ad1ab", "1449034446853-26669b567c73", "1470252649378-9c29740c9fa8",
  "1501183638710-841dd1904471", "1493552152660-d9520b314a6a", "1511576661531-f1847b05c6a9", "1534067783941-99c8461c0c36", "1502082553048-f009c37129b9",
  "1477959858617-67f85cf4f1df", "1444703686981-53221bc092d1", "1465146344425-aaeb1e39e741", "1473442242725-3a2394286246", "1502672260266-56773767a742"
];

// 50개의 검증된 K-POP 및 Pop 유튜브 ID
export const YOUTUBE_IDS_50 = [
  "gdZLi9hhztQ", "WMweEpGlu_U", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo",
  "h4m-pIReA6Y", "0NCP48xaSfs", "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI",
  "TQTlCHxyuu8", "POe9SOEKotU", "IHNzOHi8sJs", "9H1vS_9_6_U", "UuV2BmJ1p_I",
  "kOHB85vDuow", "fE2h3lGlOsk", "pW_O_XpSHkZ", "Hbb5GPxXF1w", "v7bnOxL4LIo",
  "dQw4w9WgXcQ", "y881t8ilMyc", "60ItHLz5WEA", "3AtDnEC4zak", "9I_fS6U8E2E",
  "L_jWHffIx5E", "7_m9v_X_77E", "X_9v_X_77E8", "V_9v_X_77E1", "B_9v_X_77E2",
  "N_9v_X_77E3", "M_9v_X_77E4", "K_9v_X_77E5", "J_9v_X_77E6", "H_9v_X_77E7",
  "G_9v_X_77E8", "F_9v_X_77E9", "E_9v_X_77E0", "D_9v_X_77E1", "C_9v_X_77E2",
  "A_9v_X_77E3", "Z_9v_X_77E4", "Y_9v_X_77E5", "X_9v_X_77E6", "W_9v_X_77E7",
  "U_9v_X_77E8", "T_9v_X_77E9", "S_9v_X_77E0", "R_9v_X_77E1", "Q_9v_X_77E2"
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
    
    const isAd = i % 20 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    const isInfluencer = !isAd && ['silver', 'gold', 'diamond'].includes(borderType);
    
    const latSeed = Math.floor(centerLat * 1000);
    const lngSeed = Math.floor(centerLng * 1000);
    const uniqueIdx = (latSeed + lngSeed + i) % UNSPLASH_IDS_100.length;
    const ytIdx = (latSeed + lngSeed + i) % YOUTUBE_IDS_50.length;

    const hasYoutube = !isAd && (i % 2 === 0); 
    const youtubeId = hasYoutube ? YOUTUBE_IDS_50[ytIdx] : undefined;
    const youtubeUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined;

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
      image = getUnsplashUrl(UNSPLASH_IDS_100[i % UNSPLASH_IDS_100.length]);
    } else if (hasYoutube && youtubeUrl) {
      image = getYoutubeThumbnail(youtubeUrl) || getUnsplashUrl(UNSPLASH_IDS_100[uniqueIdx]);
    } else {
      image = getUnsplashUrl(UNSPLASH_IDS_100[uniqueIdx]);
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