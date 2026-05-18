"use client";

import React, { useMemo } from 'react';
import { Play } from 'lucide-react';

import { Post } from '@/types';
import { getOptimizedMarkerImage } from '@/lib/utils';
import { getPostMediaItems } from '@/utils/post-media';

interface ProfileGridThumbnailProps {
  post: Post;
  onError: () => void;
}

const FALLBACK_IMAGE = '/placeholder.svg';

const ProfileGridThumbnail = ({ post, onError }: ProfileGridThumbnailProps) => {
  const mediaItems = useMemo(
    () => getPostMediaItems(post, { trustGeneratedVideoThumbnails: true }),
    [post]
  );
  const firstMedia = mediaItems[0];
  const hasVideo = !!(post.videoUrl || (Array.isArray(post.videoUrls) && post.videoUrls.length > 0));

  if (!firstMedia) {
    return (
      <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
        <img
          src={FALLBACK_IMAGE}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover hover:opacity-80 transition-opacity"
          onError={onError}
        />
      </div>
    );
  }

  if (firstMedia.type === 'video') {
    const posterCandidate = firstMedia.posterUrl || post.image_url || post.image;
    const posterSrc = posterCandidate
      ? getOptimizedMarkerImage(posterCandidate, post.id)
      : FALLBACK_IMAGE;

    return (
      <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
        <img
          src={posterSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover hover:opacity-80 transition-opacity"
          onError={onError}
        />
        <div className="absolute top-2 right-2 z-10">
          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
      <img
        src={getOptimizedMarkerImage(firstMedia.url, post.id)}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover hover:opacity-80 transition-opacity"
        onError={onError}
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