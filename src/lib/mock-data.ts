"use client";

import { Post, User } from '@/types';

/**
 * 1. 전국구 초고밀도 지역 데이터
 */
export const MAJOR_CITIES = [
  { name: "서울/수도권", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.35, lng: 126.75 }, ne: { lat: 37.75, lng: 127.2 } } },
  { name: "강원/동해", lat: 37.7511, lng: 128.8761, density: 800, bounds: { sw: { lat: 37.4, lng: 128.5 }, ne: { lat: 38.1, lng: 129.1 } } },
  { name: "충청/대전", lat: 36.3504, lng: 127.3845, density: 800, bounds: { sw: { lat: 36.1, lng: 127.1 }, ne: { lat: 36.6, lng: 127.6 } } },
  { name: "전라/광주", lat: 35.1595, lng: 126.8526, density: 800, bounds: { sw: { lat: 34.9, lng: 126.5 }, ne: { lat: 35.4, lng: 127.1 } } },
  { name: "경상/대구", lat: 35.8714, lng: 128.6014, density: 800, bounds: { sw: { lat: 35.6, lng: 128.3 }, ne: { lat: 36.1, lng: 128.9 } } },
  { name: "부산/울산", lat: 35.1796, lng: 129.0756, density: 1000, bounds: { sw: { lat: 35.05, lng: 128.9 }, ne: { lat: 35.45, lng: 129.4 } } },
  { name: "제주도", lat: 33.4996, lng: 126.5312, density: 800, bounds: { sw: { lat: 33.25, lng: 126.3 }, ne: { lat: 33.55, lng: 126.8 } } }
];

/**
 * 2. 100% 재생 보장 유튜브 ID 및 광고 이미지
 */
export const YOUTUBE_IDS_50 = ["aqz-KE-BPKQ", "9bZkp7q19f0", "dQw4w9WgXcQ", "V1Pl8CzNzCw", "fHI8X4OXW5Q", "jNQXAC9IVRw", "L_jWHffIx5E", "mH0_XpSHkZo", "CevxZvSJLk8", "CtpT_S6-B9U"];
export const YOUTUBE_IDS_POOL = YOUTUBE_IDS_50;
export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map(id => `https://www.youtube.com/watch?v=${id}`);
export const FOOD_IMAGES = [10, 15, 20, 25, 30].map(id => `https://picsum.photos/id/${id}/800/600`); // 광고용 음식 이미지

export const REALISTIC_COMMENTS = ["분위기 정말 좋아요! 😍", "여기 꼭 가보세요 ✨", "오늘 날씨에 딱이네요 📍", "인생샷 성지 발견 📸"];
export const AD_COMMENTS = ["[AD] 지금 바로 혜택을 확인하세요!", "[AD] 당신만을 위한 프리미엄 서비스.", "[AD] 신규 오픈! 특별 이벤트 진행 중입니다."];
export const UNSPLASH_IDS = ["photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df"];

/**
 * 3. 유틸리티 함수
 */
export const getUserById = (id: string): User => ({
  id,
  name: id.startsWith('Explorer') ? id : (id === 'ad_partner' ? '공식 파트너' : `Explorer_${id.substring(0, 4)}`),
  nickname: id.startsWith('Explorer') ? id : (id === 'ad_partner' ? '공식 파트너' : `Explorer_${id.substring(0, 4)}`),
  avatar: id === 'ad_partner' ? 'https://i.pravatar.cc/150?u=ad' : `https://i.pravatar.cc/150?u=${id}`,
  bio: "대한민국의 멋진 순간을 기록합니다."
});

export const getUnsplashUrl = (sig: number) => `https://picsum.photos/id/${(sig % 180) + 40}/800/600`;

export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueSeed = i + Math.floor(lat * 100);
    return {
      id, isAd: i % 30 === 0, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: i % 30 === 0 ? AD_COMMENTS[i % AD_COMMENTS.length] : REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat: bounds ? bounds.sw.lat + (Math.random() * (bounds.ne.lat - bounds.sw.lat)) : lat + (Math.random() - 0.5) * 0.05,
      lng: bounds ? bounds.sw.lng + (Math.random() * (bounds.ne.lng - bounds.sw.lng)) : lng + (Math.random() - 0.5) * 0.05,
      likes: Math.floor(Math.random() * 20000), commentsCount: 5, comments: [],
      image: i % 30 === 0 ? FOOD_IMAGES[i % FOOD_IMAGES.length] : getUnsplashUrl(uniqueSeed),
      isLiked: false, createdAt: new Date(), borderType: 'none',
    };
  });
};

export const MOCK_USERS = Array.from({ length: 15 }).map((_, i) => getUserById(`user_${i}`));
export const MOCK_STORIES = MOCK_USERS.map(u => ({ id: u.id, name: u.nickname, avatar: u.avatar, hasUpdate: Math.random() > 0.5 }));
export const initializeYoutubePool = async () => true;