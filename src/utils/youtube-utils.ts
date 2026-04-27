"use client";

import { getYoutubeId, getYoutubeThumbnail } from "@/lib/utils";

const YOUTUBE_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

// 메모리 캐시 (세션 내 중복 요청 방지)
const memoryCache = new Map<string, boolean>();

// localStorage 캐시 키 prefix
const LS_PREFIX = "yt_valid_";
// 캐시 유효 기간: 24시간
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const toCanonicalYoutubeUrl = (url: string) => {
  const id = getYoutubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
};

const isYoutubeThumbnailUrl = (url?: string | null) => {
  return typeof url === "string" && (url.includes("img.youtube.com") || url.includes("i.ytimg.com"));
};

/** localStorage에서 캐시된 결과 읽기 */
const readLocalCache = (canonicalUrl: string): boolean | null => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + canonicalUrl);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(LS_PREFIX + canonicalUrl);
      return null;
    }
    return value as boolean;
  } catch {
    return null;
  }
};

/** localStorage에 결과 저장 */
const writeLocalCache = (canonicalUrl: string, value: boolean) => {
  try {
    localStorage.setItem(LS_PREFIX + canonicalUrl, JSON.stringify({ value, ts: Date.now() }));
  } catch {
    // localStorage 용량 초과 등 무시
  }
};

/**
 * 유튜브 URL의 유효성을 검증합니다.
 * 1) 메모리 캐시 → 2) localStorage 캐시 → 3) 네트워크 요청 순으로 확인
 */
export const verifyYoutubeUrl = async (url: string): Promise<boolean> => {
  const canonicalUrl = toCanonicalYoutubeUrl(url);
  if (!canonicalUrl) return false;

  // 1. 메모리 캐시
  if (memoryCache.has(canonicalUrl)) return memoryCache.get(canonicalUrl)!;

  // 2. localStorage 캐시
  const cached = readLocalCache(canonicalUrl);
  if (cached !== null) {
    memoryCache.set(canonicalUrl, cached);
    return cached;
  }

  // 3. 네트워크 요청
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
    );
    const result = response.status === 200;
    memoryCache.set(canonicalUrl, result);
    writeLocalCache(canonicalUrl, result);
    return result;
  } catch {
    memoryCache.set(canonicalUrl, false);
    return false;
  }
};

const isValidUrl = (url: any) => {
  if (typeof url !== "string") return false;
  const clean = url.trim();
  return clean.startsWith("http") && !/post\s*content/i.test(clean);
};

const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";

/**
 * 단일 포스트의 YouTube 미디어를 정제합니다.
 */
export const sanitizeYoutubeMedia = async <T extends { youtube_url?: string | null; image_url?: string | null; id?: any; images?: any }>(item: T): Promise<T> => {
  let sanitizedItem = { ...item };

  if (!isValidUrl(sanitizedItem.image_url)) {
    sanitizedItem.image_url = SAFE_FALLBACK;
  }

  if (Array.isArray(sanitizedItem.images) && sanitizedItem.images.length > 0) {
    sanitizedItem.images = sanitizedItem.images.map(img => isValidUrl(img) ? img : SAFE_FALLBACK);
  } else {
    sanitizedItem.images = [sanitizedItem.image_url];
  }

  if (!sanitizedItem.youtube_url) return sanitizedItem;

  const isValid = await verifyYoutubeUrl(sanitizedItem.youtube_url);
  if (isValid) {
    const preferredThumbnail = getYoutubeThumbnail(sanitizedItem.youtube_url);
    if (preferredThumbnail && (!sanitizedItem.image_url || isYoutubeThumbnailUrl(sanitizedItem.image_url)) && sanitizedItem.image_url !== preferredThumbnail) {
      return { ...sanitizedItem, image_url: preferredThumbnail };
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

/**
 * 여러 포스트를 동시에 정제합니다 (병렬 처리).
 * YouTube URL이 있는 것들만 검증하고, 나머지는 즉시 처리합니다.
 */
export const sanitizeYoutubeMediaBatch = async <T extends { youtube_url?: string | null; image_url?: string | null; id?: any; images?: any }>(items: T[]): Promise<T[]> => {
  // YouTube URL이 없는 항목은 동기적으로 즉시 처리
  const syncProcess = (item: T): T => {
    let sanitizedItem = { ...item };
    if (!isValidUrl(sanitizedItem.image_url)) {
      sanitizedItem.image_url = SAFE_FALLBACK;
    }
    if (Array.isArray(sanitizedItem.images) && sanitizedItem.images.length > 0) {
      sanitizedItem.images = sanitizedItem.images.map(img => isValidUrl(img) ? img : SAFE_FALLBACK);
    } else {
      sanitizedItem.images = [sanitizedItem.image_url];
    }
    return sanitizedItem;
  };

  // YouTube URL이 있는 항목들의 URL을 미리 중복 제거하여 병렬 검증
  const youtubeUrls = [...new Set(
    items
      .filter(item => item.youtube_url)
      .map(item => item.youtube_url!)
  )];

  // 모든 YouTube URL을 동시에 검증
  if (youtubeUrls.length > 0) {
    await Promise.all(youtubeUrls.map(url => verifyYoutubeUrl(url)));
  }

  // 이제 모든 결과가 캐시에 있으므로 각 항목 처리 (실제 네트워크 요청 없음)
  return Promise.all(items.map(item => sanitizeYoutubeMedia(item)));
};
