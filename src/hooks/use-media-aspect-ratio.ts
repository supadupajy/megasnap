import { useEffect, useState } from 'react';

type MediaType = 'image' | 'video';

const getDisplayRatio = (width: number, height: number) => {
  if (!width || !height) return '1 / 1';
  const ratio = width / height;

  if (ratio >= 0.9 && ratio <= 1.1) return '1 / 1';
  return '3 / 4';
};

export const useMediaAspectRatio = (src?: string | null, type: MediaType = 'image') => {
  const [aspectRatio, setAspectRatio] = useState('1 / 1');

  useEffect(() => {
    if (!src || src === '/placeholder.svg') {
      setAspectRatio('1 / 1');
      return;
    }

    let cancelled = false;

    if (type === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.removeAttribute('src');
        video.load();
      };

      video.onloadedmetadata = () => {
        if (!cancelled) {
          setAspectRatio(getDisplayRatio(video.videoWidth, video.videoHeight));
        }
        cleanup();
      };

      video.onerror = () => {
        if (!cancelled) setAspectRatio('1 / 1');
        cleanup();
      };

      video.src = src;
      video.load();

      return () => {
        cancelled = true;
        cleanup();
      };
    }

    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setAspectRatio(getDisplayRatio(img.naturalWidth, img.naturalHeight));
      }
    };
    img.onerror = () => {
      if (!cancelled) setAspectRatio('1 / 1');
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, type]);

  return aspectRatio;
};
