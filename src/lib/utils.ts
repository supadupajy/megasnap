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

export const getYoutubeThumbnail = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const id = getYoutubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
};

/**
 * [CRITICAL FIX] Unsplash 관련 모든 기본 이미지를 Pexels 고화질 이미지로 강제 교체
 * 문제의 '노란 꽃 호수' 이미지(photo-1501785888041-af3ef285b470)를 완전히 박멸합니다.
 */
export const getFallbackImage = (seed: string = "default") => {
  const pexelsFallbacks = [
    "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg",
    "https://images.pexels.com/photos/2349141/pexels-photo-2349141.jpeg",
    "https://images.pexels.com/photos/1486337/pexels-photo-1486337.jpeg",
    "https://images.pexels.com/photos/3313009/pexels-photo-3313009.jpeg"
  ];
  let h = 0;
  for(let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return pexelsFallbacks[Math.abs(h) % pexelsFallbacks.length];
};

export const getPlaceholderImage = (width: number = 800, height: number = 600, seed: string = "seed") => {
  return getFallbackImage(seed);
};

export const isMobilePlatform = () => Capacitor.isNativePlatform();