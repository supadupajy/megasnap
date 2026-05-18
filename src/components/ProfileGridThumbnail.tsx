"use client";

import React, { useMemo } from 'react';
import { Play } from 'lucide-react';

import { Post } from '@/types';
import { getOptimizedMarkerImage } from '@/lib/utils';
import { getPostMediaItems, isValidMediaUrl, isVideoUrl } from '@/utils/post-media';

interface ProfileGridThumbnailProps {
  post: Post;
  onError: () => void;
}

const FALLBACK_IMAGE = '/placeholder.svg';

const pickSafePosterCandidate = (
  post: Post,
  primaryPoster: string | undefined,
  debugCandidates: Array<{ source: string; value: any; rejected?: string }>
): string => {
  const rawCandidates: Array<{ source: string; value: string | undefined }> = [
    { source: 'firstMedia.posterUrl', value: primaryPoster },
    ...(Array.isArray(post.images)
      ? post.images.map((url, i) => ({ source: `post.images[${i}]`, value: url }))
      : []),
    { source: 'post.image_url', value: post.image_url },
    { source: 'post.image', value: post.image },
  ];

  for (const candidate of rawCandidates) {
    if (!candidate.value) {
      debugCandidates.push({ source: candidate.source, value: candidate.value, rejected: 'empty' });
      continue;
    }
    if (!isValidMediaUrl(candidate.value)) {
      debugCandidates.push({ source: candidate.source, value: candidate.value, rejected: 'not-http-url' });
      continue;
    }
    if (isVideoUrl(candidate.value)) {
      debugCandidates.push({ source: candidate.source, value: candidate.value, rejected: 'is-video' });
      continue;
    }
    debugCandidates.push({ source: candidate.source, value: candidate.value });
    return candidate.value;
  }

  return FALLBACK_IMAGE;
};

const hasAnyVideoUrl = (post: Post): boolean => {
  if (isValidMediaUrl(post.videoUrl)) return true;
  if (Array.isArray(post.videoUrls) && post.videoUrls.some((url) => isValidMediaUrl(url))) return true;
  return false;
};

const ProfileGridThumbnail = ({ post, onError }: ProfileGridThumbnailProps) => {
  const mediaItems = useMemo(
    () => getPostMediaItems(post, { trustGeneratedVideoThumbnails: true }),
    [post]
  );
  const firstMedia = mediaItems[0];
  const hasVideo = hasAnyVideoUrl(post);

  if (!firstMedia) {
    console.log('[ProfileGridThumbnail] no firstMedia', {
      postId: post.id,
      image_url: post.image_url,
      image: post.image,
      images: post.images,
      videoUrl: post.videoUrl,
      videoUrls: post.videoUrls,
    });

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
    const debugCandidates: Array<{ source: string; value: any; rejected?: string }> = [];
    const safePoster = pickSafePosterCandidate(post, firstMedia.posterUrl, debugCandidates);
    const posterSrc = getOptimizedMarkerImage(safePoster, post.id);

    console.log('[ProfileGridThumbnail] video card', {
      postId: post.id,
      videoUrl: post.videoUrl,
      videoUrls: post.videoUrls,
      image_url: post.image_url,
      image: post.image,
      images: post.images,
      firstMediaPosterUrl: firstMedia.posterUrl,
      pickedPoster: safePoster,
      pickedPosterIsFallback: safePoster === FALLBACK_IMAGE,
      finalPosterSrc: posterSrc,
      candidates: debugCandidates,
    });

    return (
      <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
        <img
          src={posterSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover hover:opacity-80 transition-opacity"
          onError={(e) => {
            console.warn('[ProfileGridThumbnail] poster <img> failed to load', {
              postId: post.id,
              attemptedSrc: (e.currentTarget as HTMLImageElement).src,
              pickedPoster: safePoster,
            });
            onError();
          }}
        />
        <div className="absolute top-2 right-2 z-10">
          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
        </div>
      </div>
    );
  }

  const isFirstMediaUsable = isValidMediaUrl(firstMedia.url) && !isVideoUrl(firstMedia.url);
  const imageSrc = isFirstMediaUsable
    ? getOptimizedMarkerImage(firstMedia.url, post.id)
    : FALLBACK_IMAGE;

  if (!isFirstMediaUsable) {
    console.log('[ProfileGridThumbnail] image card fell back to placeholder', {
      postId: post.id,
      firstMediaUrl: firstMedia.url,
      image_url: post.image_url,
      images: post.images,
    });
  }

  return (
    <div className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer">
      <img
        src={imageSrc}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover hover:opacity-80 transition-opacity"
        onError={(e) => {
          console.warn('[ProfileGridThumbnail] image <img> failed to load', {
            postId: post.id,
            attemptedSrc: (e.currentTarget as HTMLImageElement).src,
            firstMediaUrl: firstMedia.url,
          });
          onError();
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