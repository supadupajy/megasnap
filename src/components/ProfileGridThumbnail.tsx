"use client";

import React, { useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import { Post } from '@/types';
import { getPostMediaItems, isValidMediaUrl, isVideoUrl } from '@/utils/post-media';

interface ProfileGridThumbnailProps {
  post: Post;
  onError: () => void;
}

const FALLBACK_IMAGE = '/placeholder.svg';
const IMAGE_EXTENSION_REGEX = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)(\?|#|$)/i;

const getUrlPathname = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const isUsableImageThumbnail = (url: unknown): url is string => {
  if (!isValidMediaUrl(url)) return false;
  if (isVideoUrl(url)) return false;
  const pathname = getUrlPathname(url);
  return IMAGE_EXTENSION_REGEX.test(pathname);
};

const pickSafePosterCandidate = (post: Post, primaryPoster?: string): string => {
  const candidates: Array<string | undefined> = [
    primaryPoster,
    ...(Array.isArray(post.images) ? post.images : []),
    post.image_url,
    post.image,
  ];

  for (const candidate of candidates) {
    if (isUsableImageThumbnail(candidate)) return candidate;
  }

  return FALLBACK_IMAGE;
};

const hasAnyVideoUrl = (post: Post): boolean => {
  if (isValidMediaUrl(post.videoUrl)) return true;
  if (Array.isArray(post.videoUrls) && post.videoUrls.some((url) => isValidMediaUrl(url))) return true;
  return false;
};

/**
 * 로드된 <img>의 픽셀 평균 휘도를 측정해 너무 어두우면 검은 썸네일로 간주.
 * - sample step을 크게 잡아 비용은 그리드 칸 당 1회, 수 ms 이내로 끝난다.
 * - 같은 origin의 supabase storage 이미지는 보통 CORS 헤더가 동봉되어 toDataURL/getImageData가 가능.
 *   getImageData가 실패(보안 오류)하면 그냥 통과시켜 영향 0.
 */
const isImageMostlyBlack = (img: HTMLImageElement): boolean => {
  try {
    const w = Math.min(48, img.naturalWidth || 48);
    const h = Math.min(48, img.naturalHeight || 48);
    if (w <= 0 || h <= 0) return false;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    let totalLuma = 0;
    let brightPixels = 0;
    let sampledPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      totalLuma += luminance;
      if (luminance > 40) brightPixels += 1;
      sampledPixels += 1;
    }

    if (sampledPixels === 0) return false;
    const avgLuma = totalLuma / sampledPixels;
    const brightRatio = brightPixels / sampledPixels;
    return avgLuma < 18 && brightRatio < 0.04;
  } catch {
    return false;
  }
};

const ProfileGridThumbnail = ({ post, onError }: ProfileGridThumbnailProps) => {
  const [didFallback, setDidFallback] = useState(false);
  const checkedRef = useRef(false);

  const mediaItems = useMemo(
    () => getPostMediaItems(post, { trustGeneratedVideoThumbnails: true }),
    [post]
  );
  const firstMedia = mediaItems[0];
  const hasVideo = hasAnyVideoUrl(post);

  const handleLoadedImage = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (checkedRef.current || didFallback) return;
    checkedRef.current = true;
    const imgEl = event.currentTarget;
    // 어두운 썸네일 감지 → placeholder로 교체
    if (isImageMostlyBlack(imgEl)) {
      setDidFallback(true);
    }
  };

  if (!firstMedia) {
    return (
      <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
        <img
          src={FALLBACK_IMAGE}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover hover:opacity-80 transition-opacity"
        />
      </div>
    );
  }

  if (firstMedia.type === 'video') {
    const safePoster = pickSafePosterCandidate(post, firstMedia.posterUrl);
    const posterSrc = didFallback ? FALLBACK_IMAGE : safePoster;

    return (
      <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
        <img
          src={posterSrc}
          alt=""
          loading="lazy"
          decoding="async"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover hover:opacity-80 transition-opacity"
          onLoad={handleLoadedImage}
          onError={() => {
            if (!didFallback) setDidFallback(true);
          }}
        />
        <div className="absolute top-2 right-2 z-10">
          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
        </div>
      </div>
    );
  }

  const imageSrc = didFallback || !isUsableImageThumbnail(firstMedia.url) ? FALLBACK_IMAGE : firstMedia.url;

  return (
    <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
      <img
        src={imageSrc}
        alt=""
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className="w-full h-full object-cover hover:opacity-80 transition-opacity"
        onLoad={handleLoadedImage}
        onError={() => {
          if (!didFallback) setDidFallback(true);
        }}
      />
      {hasVideo && (
        <div className="absolute top-2 right-2 z-10">
          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
        </div>
      )}
    </div>
  );
};

export default ProfileGridThumbnail;