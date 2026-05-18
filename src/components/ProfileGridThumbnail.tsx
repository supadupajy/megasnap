"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const getFirstVideoUrl = (post: Post): string | undefined => {
  if (isValidMediaUrl(post.videoUrl)) return post.videoUrl;
  if (Array.isArray(post.videoUrls)) {
    const found = post.videoUrls.find((url) => isValidMediaUrl(url));
    if (found) return found;
  }
  return undefined;
};

/**
 * 이미지 픽셀이 거의 검정인지 검사. CORS로 getImageData 실패하면 false(통과).
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

/**
 * 영상 파일 URL에서 클라이언트가 직접 첫 밝은 프레임을 추출해 dataURL로 반환.
 * 모든 후보 시점이 검정이면 그중 가장 밝았던 프레임 dataURL을 반환.
 * 어떤 이유로든 실패하면 null.
 */
const extractBrightVideoFrame = (videoUrl: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;

    let settled = false;
    let candidateTimes: number[] = [];
    let cursor = 0;
    let best: { dataUrl: string; luma: number } | null = null;
    const timeoutId = window.setTimeout(() => finishWithBest(), 12000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      try {
        video.removeAttribute('src');
        video.load();
      } catch {}
    };

    const finishWithBest = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(best ? best.dataUrl : null);
    };

    const finishWith = (dataUrl: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(dataUrl);
    };

    const measure = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const data = ctx.getImageData(0, 0, w, h).data;
      let totalLuma = 0;
      let brightPixels = 0;
      let sampled = 0;
      for (let i = 0; i < data.length; i += 4 * 8) {
        const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        totalLuma += luminance;
        if (luminance > 40) brightPixels += 1;
        sampled += 1;
      }
      const avgLuma = sampled > 0 ? totalLuma / sampled : 0;
      const brightRatio = sampled > 0 ? brightPixels / sampled : 0;
      return { avgLuma, brightRatio };
    };

    const tryNext = () => {
      if (cursor >= candidateTimes.length) {
        finishWithBest();
        return;
      }
      const t = candidateTimes[cursor++];
      try {
        video.currentTime = t;
      } catch {
        tryNext();
      }
    };

    const onSeeked = () => {
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 320;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          tryNext();
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const { avgLuma, brightRatio } = measure(ctx, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (!best || avgLuma > best.luma) best = { dataUrl, luma: avgLuma };
        const acceptable = avgLuma >= 28 && brightRatio >= 0.12;
        if (acceptable) {
          finishWith(dataUrl);
          return;
        }
        tryNext();
      } catch {
        tryNext();
      }
    };

    video.addEventListener('loadedmetadata', () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      candidateTimes = duration > 0.3
        ? [0.5, 1.0, 1.5, 2.0, 3.0, 5.0].filter((time) => time < duration - 0.05)
        : [0];
      if (candidateTimes.length === 0) candidateTimes = [0];
      cursor = 0;
      tryNext();
    }, { once: true });

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', () => finishWithBest(), { once: true });

    try {
      video.load();
    } catch {
      finishWithBest();
    }
  });
};

const ProfileGridThumbnail = ({ post, onError }: ProfileGridThumbnailProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkedBlackRef = useRef(false);
  const extractedRef = useRef(false);

  const mediaItems = useMemo(
    () => getPostMediaItems(post, { trustGeneratedVideoThumbnails: true }),
    [post]
  );
  const firstMedia = mediaItems[0];
  const hasVideo = hasAnyVideoUrl(post);
  const videoUrl = useMemo(() => getFirstVideoUrl(post), [post]);
  const isVideoCard = firstMedia?.type === 'video';

  const basePoster = useMemo(() => {
    if (!isVideoCard) return FALLBACK_IMAGE;
    return pickSafePosterCandidate(post, firstMedia?.posterUrl);
  }, [isVideoCard, post, firstMedia]);

  const [extractedFrameUrl, setExtractedFrameUrl] = useState<string | null>(null);
  const [needsExtraction, setNeedsExtraction] = useState(false);
  const [didFallback, setDidFallback] = useState(false);
  // basePoster가 실제로 검정인지 검사가 끝나서 "보여줘도 안전"하다고 판정됐는지.
  // - 검사 전: <img>는 opacity 0으로 숨김 (검정 픽셀이 사용자에게 노출되지 않도록)
  // - 검사 결과 검정이 아니면 즉시 페이드 인
  // - 검정으로 판정되면 그대로 숨겨둔 채 추출된 프레임으로 교체될 때까지 회색 플레이스홀더 유지
  const [posterRevealed, setPosterRevealed] = useState(false);

  // 검정 썸네일 감지 → 클라이언트 프레임 추출 트리거
  const handleLoadedImage = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (checkedBlackRef.current) return;
    checkedBlackRef.current = true;
    if (!isVideoCard) {
      setPosterRevealed(true);
      return;
    }
    const isBlack = isImageMostlyBlack(event.currentTarget);
    if (isBlack && videoUrl) {
      // 검정이면 이 <img>는 영영 보여주지 않는다. (다음 turn에서 extractedFrameUrl로 교체됨)
      setNeedsExtraction(true);
    } else {
      // 정상 썸네일이면 그제서야 부드럽게 노출
      setPosterRevealed(true);
    }
  };

  // basePoster가 fallback이거나(=DB에 쓸 수 있는 JPG 자체가 없음) 또는 검정 감지된 경우,
  // 컨테이너가 화면에 들어왔을 때 영상에서 직접 프레임을 추출한다.
  useEffect(() => {
    if (!isVideoCard) return;
    if (!videoUrl) return;
    if (extractedRef.current) return;

    const shouldExtractEagerly = basePoster === FALLBACK_IMAGE;
    if (!shouldExtractEagerly && !needsExtraction) return;

    const target = containerRef.current;
    if (!target) return;

    const startExtraction = () => {
      if (extractedRef.current) return;
      extractedRef.current = true;
      extractBrightVideoFrame(videoUrl).then((dataUrl) => {
        if (dataUrl) {
          setExtractedFrameUrl(dataUrl);
        } else {
          setDidFallback(true);
        }
      });
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          startExtraction();
          observer.disconnect();
          break;
        }
      }
    }, { rootMargin: '200px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [isVideoCard, videoUrl, basePoster, needsExtraction]);

  if (!firstMedia) {
    return (
      <div
        ref={containerRef}
        className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
      >
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

  if (isVideoCard) {
    // 어떤 소스를 보여줄지 결정.
    // - 추출된 프레임이 있으면 그게 항상 최우선 (검정 걱정 없음)
    // - 추출 실패(didFallback) → placeholder
    // - 그 외에는 basePoster를 시도하되, "검정 검사"가 끝날 때까지는 화면에 노출하지 않는다.
    let posterSrc: string;
    if (extractedFrameUrl) posterSrc = extractedFrameUrl;
    else if (didFallback) posterSrc = FALLBACK_IMAGE;
    else posterSrc = basePoster;

    // 추출된 프레임/플레이스홀더는 즉시 노출해도 안전.
    // basePoster를 보여주는 경우에만 posterRevealed 게이트를 적용.
    const safeToReveal =
      !!extractedFrameUrl || didFallback || posterSrc === FALLBACK_IMAGE || posterRevealed;

    return (
      <div
        ref={containerRef}
        className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
      >
        <img
          src={posterSrc}
          alt=""
          loading="lazy"
          decoding="async"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover hover:opacity-80 transition-opacity"
          style={{
            opacity: safeToReveal ? 1 : 0,
            // 검사 통과 후 부드럽게 나타나도록 짧은 페이드
            transition: 'opacity 120ms ease-out',
          }}
          onLoad={extractedFrameUrl ? undefined : handleLoadedImage}
          onError={() => {
            if (!videoUrl) {
              setDidFallback(true);
              return;
            }
            // 포스터 로드 실패 → 클라이언트 프레임 추출 강제 트리거
            setNeedsExtraction(true);
          }}
        />
        <div className="absolute top-2 right-2 z-10">
          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
        </div>
      </div>
    );
  }

  const imageSrc = !isUsableImageThumbnail(firstMedia.url) ? FALLBACK_IMAGE : firstMedia.url;

  return (
    <div
      ref={containerRef}
      className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
    >
      <img
        src={imageSrc}
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