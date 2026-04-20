"use client";

import { Post, User } from '@/types';

/**
 * 1. 전국 8도 대도시 거점 데이터 (전국 분포의 핵심)
 */
export const MAJOR_CITIES = [
  { name: "서울/수도권", lat: 37.5665, lng: 126.9780, density: 1000, bounds: { sw: { lat: 37.4, lng: 126.7 }, ne: { lat: 37.7, lng: 127.2 } } },
  { name: "강원/춘천/강릉", lat: 37.7511, lng: 128.8761, density: 500, bounds: { sw: { lat: 37.3, lng: 127.9 }, ne: { lat: 38.2, lng: 129.0 } } },
  { name: "충청/대전/세종", lat: 36.3504, lng: 127.3845, density: 600, bounds: { sw: { lat: 36.1, lng: 127.1 }, ne: { lat: 36.7, lng: 127.6 } } },
  { name: "전라/광주/전주", lat: 35.1595, lng: 126.8526, density: 600, bounds: { sw: { lat: 34.8, lng: 126.5 }, ne: { lat: 35.9, lng: 127.2 } } },
  { name: "경상/대구/구미", lat: 35.8714, lng: 128.6014, density: 700, bounds: { sw: { lat: 35.6, lng: 128.3 }, ne: { lat: 36.2, lng: 128.9 } } },
  { name: "부산/울산/창원", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.0, lng: 128.6 }, ne: { lat: 35.6, lng: 129.4 } } },
  { name: "제주도", lat: 33.4996, lng: 126.5312, density: 500, bounds: { sw: { lat: 33.1, lng: 126.2 }, ne: { lat: 33.6, lng: 126.9 } } }
];

export const YOUTUBE_IDS_50 = ["aqz-KE-BPKQ", "dQw4w9WgXcQ", "9bZkp7q19f0", "V1Pl8CzNzCw", "fHI8X4OXW5Q", "jNQXAC9IVRw", "L_jWHffIx5E", "mH0_XpSHkZo", "CevxZvSJLk8", "CtpT_S6-B9U"];
export const REALISTIC_COMMENTS = ["분위기 정말 좋아요! 😍", "여기 꼭 가보세요 ✨", "오늘 날씨에 딱이네요 📍", "인생샷 성지 발견 📸"];
export const AD_COMMENTS = ["[AD] 지금 바로 혜택을 확인하세요!", "[AD] 당신만을 위한 프리미엄 서비스.", "[AD] 신규 오픈! 특별 이벤트 중입니다."];
export const FOOD_IMAGES = [10, 15, 20, 25, 30].map(id => `https://picsum.photos/id/${id}/800/600`);

export const getUserById = (id: string): User => ({
  id,
  name: `Explorer_${id.substring(0, 4)}`,
  nickname: `Explorer_${id.substring(0, 4)}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국의 멋진 순간을 기록합니다."
});

export const getUnsplashUrl = (sig: number) => `https://picsum.photos/id/${(sig % 200) + 15}/800/600`;

/**
 * 2. 좌표 생성 로직 (bounds 내부로 랜덤 배치)
 */
export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const pLat = bounds ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat) : lat + (Math.random() - 0.5) * 0.1;
    const pLng = bounds ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng) : lng + (Math.random() - 0.5) * 0.1;

    return {
      id, isAd: false, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: "전국 탐험 중! 📍",
      location: '대한민국',
      lat: pLat, lng: pLng,
      likes: Math.floor(Math.random() * 10000), commentsCount: 3, comments: [],
      image: getUnsplashUrl(i),
      isLiked: false, createdAt: new Date(), borderType: 'none',
    };
  });
};

export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const MOCK_USERS = Array.from({ length: 15 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.nickname, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));
export const initializeYoutubePool = async () => true;
export const UNSPLASH_IDS = ["photo1", "photo2"];