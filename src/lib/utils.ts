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

export const formatCount = (n: number): string => {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return (Number.isInteger(m) ? m.toString() : m.toFixed(1).replace(/\.0$/, '')) + 'M';
  }
  if (n >= 1_000) {
    return n.toLocaleString();
  }
  return n.toString();
};