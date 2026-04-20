"use client";

import { getYoutubeId } from "@/lib/utils";

const YOUTUBE_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";
const verificationCache = new Map<string, Promise<boolean>>();

const toCanonicalYoutubeUrl = (url: string) => {
  const id = getYoutubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
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

export const sanitizeYoutubeMedia = async <T extends { youtube_url?: string | null; image_url?: string | null }>(item: T): Promise<T> => {
  if (!item.youtube_url) return item;

  const isValid = await verifyYoutubeUrl(item.youtube_url);
  if (isValid) return item;

  const nextImage = item.image_url?.includes("img.youtube.com") ? YOUTUBE_FALLBACK_IMAGE : item.image_url;

  return {
    ...item,
    youtube_url: null,
    image_url: nextImage || YOUTUBE_FALLBACK_IMAGE,
  };
};
