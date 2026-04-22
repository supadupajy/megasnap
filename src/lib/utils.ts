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
  // hqdefault도 깨지는 경우가 있을 수 있으므로 mqdefault(중간 해상도, 항상 존재)를 fallback으로 고려
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// Unsplash Placeholder 리맵핑 유틸리티
export function getUnsplashPlaceholder(id: string, category: string = 'general') {
  const seed = id.split('-').pop() || '1';
  const width = 800;
  const height = 800;
  
  const keywords: Record<string, string> = {
    food: 'food,restaurant',
    place: 'landscape,nature,travel',
    accident: 'road,traffic',
    animal: 'animal,pet',
    general: 'landscape,city'
  };
  
  const keyword = keywords[category] || keywords.general;
  return `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=${width}&q=80&sig=${seed}`;
}

export const isMobilePlatform = () => Capacitor.isNativePlatform();