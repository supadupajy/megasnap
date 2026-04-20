"use client";

import { Post, User } from '@/types';
import { getYoutubeThumbnail } from './utils';

// ... (seededRandom, getTierFromId, getUserById 함수는 그대로 유지)

/**
 * [개선] Unsplash URL 생성 로직
 * ID가 있으면 특정 이미지를, 없으면 키워드 기반 무작위 이미지를 반환합니다.
 */
export const getUnsplashUrl = (id?: string, sig?: number) => {
  if (id) {
    // 특정 ID 사용 시 (100종)
    return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=800&sig=${sig || Math.random()}`;
  } else {
    // 키워드 기반 무작위 이미지 (중복 방지 핵심)
    // lgtm, city, korea 등의 키워드를 섞어 다양성 확보
    const keywords = ['city', 'seoul', 'korea', 'architecture', 'nightview', 'street'];
    const randomKeyword = keywords[(sig || 0) % keywords.length];
    return `https://source.unsplash.com/featured/800x600?${randomKeyword}&sig=${sig || Math.random()}`;
  }
};

// ... (MAJOR_CITIES, UNSPLASH_IDS, YOUTUBE_IDS_50 등 데이터 리스트 그대로 유지)

/**
 * [개선] 포스팅 생성 로직
 * 이미지 선택 시 순차적(%)이 아닌 랜덤 요소를 강화합니다.
 */
export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number = 15, 
  specificUserId?: string,
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substring(2, 11);
    const isAd = i % 25 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    
    // 시그니처에 랜덤성을 대폭 추가
    const sig = Math.floor(Math.random() * 1000000);
    
    const hasYoutube = !isAd && (i % 2 === 0); 
    const ytId = hasYoutube ? YOUTUBE_IDS_50[sig % YOUTUBE_IDS_50.length] : undefined;
    const youtubeUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined;

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
      image = getUnsplashUrl(FOOD_UNSPLASH_IDS[sig % FOOD_UNSPLASH_IDS.length], sig);
    } else if (youtubeUrl) {
      image = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    } else {
      // [핵심 변경] 70%는 고정 ID 풀에서, 30%는 완전 무작위 키워드 이미지에서 가져옴
      if (Math.random() > 0.3) {
        image = getUnsplashUrl(UNSPLASH_IDS[sig % UNSPLASH_IDS.length], sig);
      } else {
        image = getUnsplashUrl(undefined, sig);
      }
    }

    return {
      id,
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: getUserById(isAd ? 'ad_partner' : (specificUserId || `user_${id.substring(0, 3)}`)),
      content: isAd ? AD_COMMENTS[sig % AD_COMMENTS.length] : REALISTIC_COMMENTS[sig % REALISTIC_COMMENTS.length],
      location: '대한민국',
      lat,
      lng,
      likes: Math.floor(randomFn() * 10000),
      commentsCount: Math.floor(randomFn() * 30),
      comments: [],
      image,
      isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType,
      youtubeUrl
    };
  });
};

// ... (나머지 export 함수들 유지)