"use client";

import { Post, User } from '@/types';

// ... (MAJOR_CITIES, YOUTUBE_IDS_50 리스트는 이전과 동일하게 유지)

/**
 * 유튜브 썸네일 URL 생성기 (호환성 최우선)
 * maxresdefault 대신 hqdefault를 사용해야 모든 영상에서 깨지지 않습니다.
 */
export const getYoutubeThumbnail = (videoId: string) => {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

// ... (getUnsplashUrl, getUserById 함수 유지)

export const createMockPosts = (lat: number, lng: number, count: number, userId?: string, bounds?: any): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const uniqueSeed = i + Math.floor(lat * 100);
    const ytId = YOUTUBE_IDS_50[uniqueSeed % YOUTUBE_IDS_50.length];

    return {
      id, isAd: i % 35 === 0, isGif: false, isInfluencer: Math.random() > 0.8,
      user: getUserById(userId || id),
      content: REALISTIC_COMMENTS[uniqueSeed % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat: bounds ? bounds.sw.lat + (Math.random() * (bounds.ne.lat - bounds.sw.lat)) : lat + (Math.random() - 0.5) * 0.1,
      lng: bounds ? bounds.sw.lng + (Math.random() * (bounds.ne.lng - bounds.sw.lng)) : lng + (Math.random() - 0.5) * 0.1,
      likes: Math.floor(Math.random() * 20000), commentsCount: 5, comments: [],
      // [수정] 호환성 높은 썸네일로 배정
      image: i % 2 === 0 ? getYoutubeThumbnail(ytId) : getUnsplashUrl(uniqueSeed),
      isLiked: false, createdAt: new Date(), borderType: 'none',
      youtubeUrl: i % 2 === 0 ? `https://www.youtube.com/watch?v=${ytId}` : undefined
    };
  });
};

// (나머지 MOCK_USERS, MOCK_STORIES 등 유지)