"use client";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from '@capacitor/core';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from "@/integrations/supabase/client";

export const PLACEHOLDER_IMAGE = '/placeholder.svg';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getFallbackImage = (_seed: string = 'default') => {
  return PLACEHOLDER_IMAGE;
};

export const getPlaceholderImage = (_width: number = 800, _height: number = 600, _seed: string = 'seed') => {
  return PLACEHOLDER_IMAGE;
};

export const isMobilePlatform = () => Capacitor.isNativePlatform();

const MARKER_IMAGE_TRANSFORM = {
  width: 160,
  height: 160,
  quality: 60,
  resize: 'cover' as const,
};

// 업로드된 포스팅 이미지는 3:4 비율로 저장되므로, 표시용 트랜스폼도 동일한 3:4 비율을 사용해
// Supabase image render가 추가로 정사각형으로 크롭하지 않도록 한다.
// (정사각형으로 두면 가로 이미지의 좌우, 또는 세로 이미지의 위아래가 잘려 사용자가 의도한 구도와 달라진다.)
const FEED_IMAGE_TRANSFORM = {
  width: 1200,
  height: 1600,
  quality: 88,
  resize: 'cover' as const,
};

const DETAIL_IMAGE_TRANSFORM = {
  width: 1440,
  height: 1920,
  quality: 90,
  resize: 'cover' as const,
};

const BANNER_IMAGE_TRANSFORM = {
  width: 1200,
  height: 600,
  quality: 78,
  resize: 'cover' as const,
};

const getSupabaseStorageSource = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.supabase.co')) return null;

    const match = parsed.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;

    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
};

const getOptimizedSupabaseImage = (
  url: string,
  transform: { width: number; height: number; quality: number; resize: 'cover' | 'contain' | 'fill' }
): string => {
  const normalizedUrl = url.trim();
  const lowerUrl = normalizedUrl.toLowerCase();

  if (
    normalizedUrl.startsWith('data:') ||
    normalizedUrl.startsWith('/') ||
    lowerUrl.endsWith('.svg') ||
    lowerUrl.includes('.svg?') ||
    lowerUrl.endsWith('.gif') ||
    lowerUrl.includes('.gif?')
  ) {
    return normalizedUrl;
  }

  const supabaseSource = getSupabaseStorageSource(normalizedUrl);
  if (supabaseSource) {
    const { data } = supabase.storage
      .from(supabaseSource.bucket)
      .getPublicUrl(supabaseSource.path, { transform });
    return data.publicUrl;
  }

  return normalizedUrl;
};

export const getOptimizedFeedImage = (url: string | null | undefined, seed: string = 'default'): string => {
  if (!url || url === 'null' || url === 'undefined') return getFallbackImage(seed);
  return getOptimizedSupabaseImage(url.trim(), FEED_IMAGE_TRANSFORM);
};

export const getOptimizedDetailImage = (url: string | null | undefined, seed: string = 'default'): string => {
  if (!url || url === 'null' || url === 'undefined') return getFallbackImage(seed);
  return getOptimizedSupabaseImage(url.trim(), DETAIL_IMAGE_TRANSFORM);
};

export const getOptimizedBannerImage = (url: string | null | undefined, seed: string = 'default'): string => {
  if (!url || url === 'null' || url === 'undefined') return getFallbackImage(seed);
  return getOptimizedSupabaseImage(url.trim(), BANNER_IMAGE_TRANSFORM);
};

export const getOptimizedMarkerImage = (url: string | null | undefined, seed: string = 'default') => {
  if (!url || url === 'null' || url === 'undefined') {
    return getFallbackImage(seed);
  }

  const normalizedUrl = url.trim();
  const lowerUrl = normalizedUrl.toLowerCase();

  if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('/')) {
    return normalizedUrl;
  }

  if (
    lowerUrl.endsWith('.svg') ||
    lowerUrl.includes('.svg?') ||
    lowerUrl.endsWith('.gif') ||
    lowerUrl.includes('.gif?')
  ) {
    return normalizedUrl;
  }

  const supabaseSource = getSupabaseStorageSource(normalizedUrl);
  if (supabaseSource) {
    const { data } = supabase.storage
      .from(supabaseSource.bucket)
      .getPublicUrl(supabaseSource.path, { transform: MARKER_IMAGE_TRANSFORM });

    return data.publicUrl;
  }

  return normalizedUrl;
};

/**
 * 이미지 파일을 Canvas API로 리사이즈 + 압축합니다.
 * - 긴 변 기준 maxSize px 이하로 리사이즈
 * - JPEG quality로 압축
 * - 결과는 File 객체로 반환 (원본 파일명 유지, 확장자는 jpg)
 */
export const compressImage = (
  file: File,
  maxSize = 1920,
  quality = 0.82
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { naturalWidth: w, naturalHeight: h } = img;

      // 리사이즈 필요 여부 판단
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round((h / w) * maxSize);
          w = maxSize;
        } else {
          w = Math.round((w / h) * maxSize);
          h = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 생성할 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 압축에 실패했습니다.'));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressed = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 로드할 수 없습니다.'));
    };

    img.src = url;
  });
};

export const cropImageToAspectRatio = (
  file: File,
  crop: { x: number; y: number } = { x: 50, y: 50 },
  zoom = 1,
  aspectRatio = 3 / 4,
  maxHeight = 1920,
  quality = 0.86
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const sourceW = img.naturalWidth;
      const sourceH = img.naturalHeight;
      if (!sourceW || !sourceH) {
        reject(new Error('이미지 크기를 확인할 수 없습니다.'));
        return;
      }

      const sourceAspect = sourceW / sourceH;
      let baseCropW = sourceW;
      let baseCropH = sourceH;

      if (sourceAspect > aspectRatio) {
        baseCropW = sourceH * aspectRatio;
      } else if (sourceAspect < aspectRatio) {
        baseCropH = sourceW / aspectRatio;
      }

      const safeZoom = Math.max(1, zoom || 1);
      const cropW = Math.min(sourceW, baseCropW / safeZoom);
      const cropH = Math.min(sourceH, baseCropH / safeZoom);

      const cropXPercent = Math.max(0, Math.min(100, crop.x));
      const cropYPercent = Math.max(0, Math.min(100, crop.y));
      const sourceX = ((sourceW - cropW) * cropXPercent) / 100;
      const sourceY = ((sourceH - cropH) * cropYPercent) / 100;

      const outputH = Math.min(maxHeight, Math.round(baseCropH));
      const outputW = Math.round(outputH * aspectRatio);

      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 생성할 수 없습니다.'));
        return;
      }

      ctx.drawImage(img, sourceX, sourceY, cropW, cropH, 0, 0, outputW, outputH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 크롭에 실패했습니다.'));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const cropped = new File([blob], `${baseName}-3x4.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(cropped);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 로드할 수 없습니다.'));
    };

    img.src = url;
  });
};

/**
 * 원본 이미지의 특정 사각형(sx, sy, sw, sh)을 그대로 잘라 3:4 캔버스에 그려 업로드용 파일을 만든다.
 * - 사각형 비율이 3:4가 아니어도 letterbox(상하 또는 좌우 여백) 없이 비율을 유지해 contain 방식으로 배치.
 * - 가로 이미지의 미리보기 가시 영역을 그대로 업로드할 때 사용.
 */
export const cropImageBySourceRect = (
  file: File,
  sourceRect: { sx: number; sy: number; sw: number; sh: number },
  aspectRatio = 3 / 4,
  maxHeight = 1920,
  quality = 0.86
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { sx, sy, sw, sh } = sourceRect;
      if (sw <= 0 || sh <= 0) {
        reject(new Error('잘못된 크롭 영역입니다.'));
        return;
      }

      const outputH = Math.min(maxHeight, Math.round(sh));
      const outputW = Math.round(outputH * aspectRatio);

      // 가시 영역(sw:sh)을 출력 캔버스(outputW:outputH) 안에 contain으로 배치
      const fitScale = Math.min(outputW / sw, outputH / sh);
      const drawW = Math.round(sw * fitScale);
      const drawH = Math.round(sh * fitScale);
      const drawX = Math.round((outputW - drawW) / 2);
      const drawY = Math.round((outputH - drawH) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 생성할 수 없습니다.'));
        return;
      }

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, outputW, outputH);
      ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, drawW, drawH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 크롭에 실패했습니다.'));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const cropped = new File([blob], `${baseName}-viewport.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(cropped);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 로드할 수 없습니다.'));
    };

    img.src = url;
  });
};

export const createVideoThumbnail = async (file: File): Promise<Blob> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<Blob>((resolve, reject) => {
      const video = document.createElement('video');
      let settled = false;
      let timeoutId: number | undefined;

      const cleanup = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        video.pause();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
      };

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const fail = (error?: unknown) => {
        finish(() => {
          reject(error instanceof Error ? error : new Error('비디오 썸네일을 생성할 수 없습니다.'));
        });
      };

      const capture = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = video.videoWidth || 320;
          const height = video.videoHeight || 320;
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            fail();
            return;
          }

          context.drawImage(video, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) {
              fail();
              return;
            }

            finish(() => resolve(blob));
          }, 'image/jpeg', 0.82);
        } catch (error) {
          fail(error);
        }
      };

      const moveToCaptureFrame = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;

        if (duration <= 0.2) {
          capture();
          return;
        }

        const seekTime = Math.min(Math.max(duration * 0.15, 0.1), duration - 0.1);

        try {
          video.currentTime = seekTime;
        } catch {
          capture();
        }
      };

      timeoutId = window.setTimeout(() => {
        fail(new Error('비디오 썸네일 생성 시간이 초과되었습니다.'));
      }, 10000);

      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;

      video.addEventListener('loadedmetadata', moveToCaptureFrame, { once: true });
      video.addEventListener('seeked', capture, { once: true });
      video.addEventListener('error', () => fail(), { once: true });
      video.load();
    });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

export const formatRelativeTime = (date: Date | string): string => {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  if (Math.abs(diffMs) < 60_000) return '1분 전';
  return formatDistanceToNow(d, { addSuffix: true, locale: ko });
};

/**
 * 큰 숫자를 K / M 단위로 축약 표기한다.
 * - 1,000 미만: 원본 그대로 (예: 999)
 * - 1,000 이상 ~ 1,000,000 미만: 소수점 1자리 K (예: 1.2K, 12.3K, 999.9K)
 *   단, 정확히 정수배일 때도 ".0K"가 노출되도록 소수점은 항상 1자리 유지.
 * - 1,000,000 이상: 소수점 1자리 M (예: 1.0M, 12.3M)
 * 잘림(floor) 방식: 1,299 → 1.2K (반올림 시 사용자가 실제값보다 큰 숫자를 보지 않도록).
 */
export const formatCount = (n: number): string => {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) {
    const m = Math.floor(n / 100_000) / 10;
    return `${m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = Math.floor(n / 100) / 10;
    return `${k.toFixed(1)}K`;
  }
  return n.toString();
};