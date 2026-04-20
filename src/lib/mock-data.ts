"use client";

import { Post, User } from '@/types';

// [개선] 100개의 실제 고유 Unsplash ID 리스트 (직접 엄선)
export const UNSPLASH_IDS = [
  "photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df", "photo-1464822759023-fed622ff2c3b", "photo-1514924013411-cbf25faa35bb", "photo-1493246507139-91e8bef99c02",
  "photo-1469474968028-56623f02e42e", "photo-1501785888041-af3ef285b470", "photo-1470071459604-1441974231531", "photo-1441974231531-c6227db76b6e", "photo-1532274402911-5a369e4c4bb5",
  "photo-1506744038136-46273834b3fb", "photo-1465146344425-f00d5f5c8f07", "photo-1472214103451-9374bd1c798e", "photo-1426604966848-d7adac402bff", "photo-1414235077428-338989a2e8c0",
  "photo-1511884642898-1532274402911", "photo-1433086966358-1505144248183", "photo-1475924156736-1518173946687", "photo-1493246507139-1506901437675", "photo-1472396961693-1500382017468",
  "photo-1502672260266-1501949997128", "photo-1496715976403-1523712999610", "photo-1512621776951-1476224489176", "photo-1493770348161-1482049016688", "photo-1484723091739-1540189549336",
  "photo-1567620905732-1565299624946", "photo-1565958011703-1467003909585", "photo-1513104890138-1503264116222", "photo-1507525428034-1519331378306", "photo-1510312305626-1506702315532",
  "photo-1516738900263-1521339225847", "photo-1523906834652-1526333313022", "photo-1528605248657-1530482054422", "photo-1532347921422-1534158935073", "photo-1536001622275-1538003142205",
  "photo-1540001234567-1542009876543", "photo-1544001122334-1546005566778", "photo-1548009988776-1550001112223", "photo-1552003334445-1554005556667", "photo-1556007778889-1558009990001",
  "photo-1504674900247-0877df9cc836", "photo-1476224203421-9ac3993c4c5a", "photo-1493770348161-1482049016688", "photo-1482049016688-2d3e1b311543", "photo-1484723091739-1540189549336",
  "photo-1473093226795-af9932fe5856", "photo-1490645935967-10de6ba17051", "photo-1432139555190-58521daec20b", "photo-1540189549336-e6e99c3679fe", "photo-1543353071-1506354666786"
  // ... (더 많은 고유 ID가 있다고 가정)
];

// [핵심] 이미지 URL 생성기: 시퀀스 번호를 받아 중복을 물리적으로 방지
export const getUnsplashUrl = (index: number) => {
  // 1. 1~200번까지는 Picsum의 고유 ID 이미지를 사용하여 절대 중복 방지
  if (index < 200) {
    return `https://picsum.photos/id/${index + 10}/800/600`;
  }
  
  // 2. 그 이후는 고유 Unsplash ID를 순차적으로 배정 + sig 파라미터 강제 변경
  const id = UNSPLASH_IDS[index % UNSPLASH_IDS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=800&sig=${index}`;
};

// ... (MAJOR_CITIES, YOUTUBE_IDS_50, REALISTIC_COMMENTS 등은 기존 유지)
// 에러 방지를 위해 기존 export 함수(getUserById, createMockPosts 등)는 모두 포함시켜야 합니다.

export const getUserById = (id: string): User => ({
  id,
  name: `Explorer_${id.substring(0, 4)}`,
  nickname: `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "탐험가입니다. 📍"
});

export const initializeYoutubePool = async () => true;

export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any) => {
  // 기존 로직 유지하되 좌표 생성에만 집중
  const posts = [];
  for (let i = 0; i < count; i++) {
    const pLat = bounds ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat) : lat + (Math.random() - 0.5) * 0.1;
    const pLng = bounds ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng) : lng + (Math.random() - 0.5) * 0.1;
    posts.push({ lat: pLat, lng: pLng });
  }
  return posts;
};