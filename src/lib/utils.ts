"use client";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from '@capacitor/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getYoutubeId(url: string) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function getYoutubeThumbnail(url: string) {
  const id = getYoutubeId(url);
  if (!id) return null;
  // maxresdefault는 고해상도지만, 영상에 따라 존재하지 않을 수 있어 에러(엑박)를 유발할 수 있음
  // 가장 확실하고 준수한 화질인 hqdefault를 유지하되, 마커에서는 리사이징 없이 원본을 신뢰합니다.
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// Unsplash Placeholder 리맵핑 유틸리티
export function getUnsplashPlaceholder(id: string, category: string = 'general') {
  const seed = id.split('-').pop() || '1';
  // 마커용 작은 이미지가 아닌 원본급 해상도 요청
  const width = 1200; 
  const height = 1200;
  
  const keywords: Record<string, string> = {
    food: 'food,restaurant',
    place: 'landscape,nature,travel',
    accident: 'road,traffic',
    animal: 'animal,pet',
    general: 'landscape,city'
  };
  
  const keyword = keywords[category] || keywords.general;
  return `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=${width}&q=100&sig=${seed}`;
}

export const isMobilePlatform = () => Capacitor.isNativePlatform();