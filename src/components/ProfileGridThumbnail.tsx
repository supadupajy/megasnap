"use client";

import React, { useMemo, useState } from 'react';
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

const ProfileGridThumbnail = ({ post, onError }: ProfileGridThumbnailProps) => {
  const [didFallback, setDidFallback] = useState(false);

  const mediaItems = useMemo(
    () => getPostMediaItems(post, { trustGeneratedVideoThumbnails: true }),
    [post]
  );
  const firstMedia = mediaItems[0];
  const hasVideo = hasAnyVideoUrl(post);

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
          className="absolute inset-0 w-full h-full object-cover hover:opacity-80 transition-opacity"
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
        className="w-full h-full object-cover hover:opacity-80 transition-opacity"
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