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

const pickSafePosterCandidate = (post: Post, primaryPoster?: string): string => {
  const candidates: Array<string | undefined> = [
    primaryPoster,
    ...(Array.isArray(post.images) ? post.images : []),
    post.image_url,
    post.image,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!isValidMediaUrl(candidate)) continue;
    if (isVideoUrl(candidate)) continue;
    return candidate;
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
    // 원본 썸네일 URL을 그대로 사용. (supabase 이미지 transform이 비활성화된 환경에서
    // render/image 경로가 빈 응답을 주며 까만 칸이 되는 것을 방지.)
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

  const isFirstMediaUsable = isValidMediaUrl(firstMedia.url) && !isVideoUrl(firstMedia.url);
  const imageSrc = didFallback || !isFirstMediaUsable ? FALLBACK_IMAGE : firstMedia.url;

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