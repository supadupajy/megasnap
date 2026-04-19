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

export const YOUTUBE_LINKS = [
  "https://www.youtube.com/shorts/CevxZvSJLk8",
  "https://www.youtube.com/shorts/09R8_2nJtjg",
  "https://www.youtube.com/shorts/kJQP7kiw5Fk",
  "https://www.youtube.com/shorts/nfWlot6h_JM",
  "https://www.youtube.com/shorts/YQHsXMglC9A",
  "https://www.youtube.com/shorts/2vjPBrBU-TM",
  "https://www.youtube.com/shorts/fWNaR-rxAic",
  "https://www.youtube.com/shorts/LjhCEhWiKXk",
  "https://www.youtube.com/shorts/9bZkp7q19f0",
  "https://www.youtube.com/shorts/gdZLi9oWNZg"
];

const REALISTIC_COMMENTS = [
  '여기 분위기 진짜 대박이에요! 꼭 가보세요. 😍',
  '오늘 날씨랑 찰떡인 장소 발견! 기분 전환 제대로 되네요. ✨',
  '숨은 명소 발견! 나만 알고 싶지만 공유합니다. 📍',
  '주말 나들이로 딱 좋은 곳인 것 같아요. 강력 추천!',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '생각보다 사람이 많지 않아서 여유롭게 즐기다 왔어요.',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!',
  '가족들이랑 오기에도 참 좋은 곳 같아요. 👨‍👩‍👧‍👦',
  '분위기도 좋고 인테리어도 취향저격... 재방문 의사 200%!',
  '지나가다 우연히 들렀는데 너무 만족스러워서 기록 남겨요.',
  '친구들이랑 수다 떨기 딱 좋은 장소네요. 시간 가는 줄 몰랐어요.',
  '오랜만에 힐링하고 갑니다. 공기가 너무 맑고 좋네요.',
  '여기 진짜 뷰 맛집이네요. 눈이 호강하는 기분입니다. 🌊',
  '디테일 하나하나 신경 쓴 게 느껴지는 멋진 공간이에요.',
  '혼자 와서 조용히 생각 정리하기에도 너무 좋을 것 같아요.'
];

const AD_COMMENTS = [
  '[AD] 지금 바로 특별한 혜택을 만나보세요! 놓치면 후회합니다.',
  '[AD] 당신만을 위한 프리미엄 서비스를 경험할 시간입니다.',
  '[AD] 인기 폭발! 지금 가장 핫한 아이템을 확인해보세요.',
  '[AD] 오늘만 진행되는 특별 프로모션, 지금 확인하세요!',
  '[AD] 최고의 선택, 당신의 일상을 더 특별하게 만들어드립니다.'
];

export const UNSPLASH_IDS = [
  "1501785888041-af3ef285b470", "1470071459604-3b5ec3a7fe05", "1441974231531-c6227db76b6e", 
  "1500673922987-e212871fec22", "1464822759023-fed622ff2c3b", "1472214103451-9374bd1c798e",
  "1516035069371-29a1b244cc32", "1504674900247-0877df9cc836", "1517841905240-472988babdf9"
];

export const FOOD_UNSPLASH_IDS = [
  "1504674900247-0877df9cc836", "1512621776951-a57141f2eefd", "1476224489176-e88e5948482b",
  "1493770348161-369560ae357d", "1482049016688-2d3e1b311543", "1484723091739-30a097e8f929"
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
    
    const hasYoutube = !isAd && randomFn() > 0.5; 
    const youtubeUrl = hasYoutube ? YOUTUBE_LINKS[Math.floor(randomFn() * YOUTUBE_LINKS.length)] : undefined;

    let lat, lng;
    if (bounds) {
      lat = bounds.sw.lat + (randomFn() * (bounds.ne.lat - bounds.sw.lat));
      lng = bounds.sw.lng + (randomFn() * (bounds.ne.lng - bounds.sw.lng));
    } else {
      lat = centerLat + (randomFn() - 0.5) * 0.1;
      lng = centerLng + (randomFn() - 0.5) * 0.1;
    }
    
    const content = isAd 
      ? AD_COMMENTS[Math.floor(randomFn() * AD_COMMENTS.length)]
      : REALISTIC_COMMENTS[Math.floor(randomFn() * REALISTIC_COMMENTS.length)];
    
    let image = "";
    if (isAd) {
      image = getUnsplashUrl(FOOD_UNSPLASH_IDS[Math.floor(randomFn() * FOOD_UNSPLASH_IDS.length)]);
    } else if (hasYoutube && youtubeUrl) {
      image = getYoutubeThumbnail(youtubeUrl) || getUnsplashUrl(UNSPLASH_IDS[0]);
    } else {
      image = getUnsplashUrl(UNSPLASH_IDS[Math.floor(randomFn() * UNSPLASH_IDS.length)]);
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