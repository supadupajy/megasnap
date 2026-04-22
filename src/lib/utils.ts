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
  // [FIX] 저해상도 hqdefault 대신 고해상도 maxresdefault 시도, 실패 시 sddefault 사용
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

// Unsplash Placeholder 리맵핑 유틸리티
export function getUnsplashPlaceholder(id: string, category: string = 'general') {
  const seed = id.split('-').pop() || '1';
  const width = 1080; // [FIX] 해상도 상향 (800 -> 1080)
  const height = 1080;
  
  const keywords: Record<string, string> = {
    food: 'food,restaurant',
    place: 'landscape,nature,travel',
    accident: 'road,traffic',
    animal: 'animal,pet',
    general: 'landscape,city'
  };
  
  const keyword = keywords[category] || keywords.general;
  return `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=${width}&q=90&sig=${seed}`; // [FIX] q=90으로 품질 향상
}

export const isMobilePlatform = () => Capacitor.isNativePlatform();