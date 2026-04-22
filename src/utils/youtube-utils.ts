"use client";

import { getYoutubeId, getYoutubeThumbnail } from "@/lib/utils";

const YOUTUBE_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";
const verificationCache = new Map<string, Promise<boolean>>();

const toCanonicalYoutubeUrl = (url: string) => {
  const id = getYoutubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
};

const isYoutubeThumbnailUrl = (url?: string | null) => {
  return typeof url === "string" && (url.includes("img.youtube.com") || url.includes("i.ytimg.com"));
};

/**
 * 유튜브 URL의 유효성을 oEmbed API를 통해 검증합니다.
 */
export const verifyYoutubeUrl = async (url: string): Promise<boolean> => {
  const canonicalUrl = toCanonicalYoutubeUrl(url);
  if (!canonicalUrl) return false;

  const cached = verificationCache.get(canonicalUrl);
  if (cached) return cached;

  const request = fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`)
    .then((response) => response.status === 200)
    .catch((error) => {
      console.error("[YouTube Verify] Error checking URL:", canonicalUrl, error);
      return false;
    });

  verificationCache.set(canonicalUrl, request);
  return request;
};

export const sanitizeYoutubeMedia = async <T extends { youtube_url?: string | null; image_url?: string | null; id?: any; images?: any }>(item: T): Promise<T> => {
  // [CRITICAL FIX] "Post content 1" 같은 텍스트 데이터가 이미지로 들어오는 것을 원천 차단
  const isValidUrl = (url: any) => {
    if (typeof url !== 'string') return false;
    const clean = url.trim();
    return clean.startsWith('http') && !clean.includes('Post content');
  };

  const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";

  let sanitizedItem = { ...item };

  // 1. image_url 검증
  if (!isValidUrl(sanitizedItem.image_url)) {
    sanitizedItem.image_url = SAFE_FALLBACK;
  }

  // 2. images 배열 검증
  if (Array.isArray(sanitizedItem.images)) {
    sanitizedItem.images = sanitizedItem.images.map(img => isValidUrl(img) ? img : SAFE_FALLBACK);
  } else {
    sanitizedItem.images = [sanitizedItem.image_url];
  }

  if (!sanitizedItem.youtube_url) return sanitizedItem;

  const isValid = await verifyYoutubeUrl(sanitizedItem.youtube_url);
  if (isValid) {
    const preferredThumbnail = getYoutubeThumbnail(sanitizedItem.youtube_url);

    if (preferredThumbnail && (!sanitizedItem.image_url || isYoutubeThumbnailUrl(sanitizedItem.image_url)) && sanitizedItem.image_url !== preferredThumbnail) {
      return {
        ...sanitizedItem,
        image_url: preferredThumbnail,
      };
    }

    return sanitizedItem;
  }

  const nextImage = isYoutubeThumbnailUrl(sanitizedItem.image_url) ? YOUTUBE_FALLBACK_IMAGE : sanitizedItem.image_url;

  return {
    ...sanitizedItem,
    youtube_url: null,
    image_url: nextImage || YOUTUBE_FALLBACK_IMAGE,
  };
};