import { useCallback, useEffect, useRef, useState } from 'react';

interface VideoThumbnailPreviewProps {
  src: string;
  className?: string;
  startTime?: number;
  debugLabel?: string;
}

const shortUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return `${parsed.hostname}/${parts.slice(-2).join('/')}`;
  } catch {
    return url.slice(0, 120);
  }
};

const VideoThumbnailPreview = ({
  src,
  className,
  startTime = 0.8,
  debugLabel = 'video-thumbnail-preview',
}: VideoThumbnailPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const [isReady, setIsReady] = useState(false);

  const log = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    const video = videoRef.current;
    const computed = video && typeof window !== 'undefined'
      ? window.getComputedStyle(video)
      : null;

    console.info('[video-flicker-debug]', event, {
      label: debugLabel,
      instanceId: instanceIdRef.current,
      src: shortUrl(src),
      startTime,
      isReady,
      video: video ? {
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: Number(video.currentTime.toFixed(3)),
        duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : String(video.duration),
        paused: video.paused,
        seeking: video.seeking,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight,
        attrSrc: shortUrl(video.getAttribute('src') || ''),
        currentSrc: shortUrl(video.currentSrc || ''),
        inlineOpacity: video.style.opacity,
        computedOpacity: computed?.opacity,
        computedBg: computed?.backgroundColor,
        display: computed?.display,
        visibility: computed?.visibility,
      } : null,
      ...extra,
    });
  }, [debugLabel, isReady, src, startTime]);

  useEffect(() => {
    setIsReady(false);
    log('thumb-reset');
  }, [log, src, startTime]);

  useEffect(() => {
    log('thumb-mount');
    return () => log('thumb-unmount');
  }, [log]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const show = (reason: string) => {
      log('thumb-ready', { reason });
      setIsReady(true);
      requestAnimationFrame(() => log('thumb-ready-after-raf', { reason }));
    };

    const seekToPreviewFrame = () => {
      log('thumb-loadedmetadata-before-seek');
      if (!Number.isFinite(el.duration) || el.duration <= 0.25) return;
      const target = Math.min(startTime, el.duration - 0.05);
      if (target > 0 && Math.abs(el.currentTime - target) > 0.05) {
        try {
          el.currentTime = target;
          log('thumb-seek-requested', { target });
        } catch (error) {
          log('thumb-seek-failed', { message: error instanceof Error ? error.message : String(error) });
        }
      }
    };

    const handleLoadedData = () => show('loadeddata');
    const handleSeeked = () => show('seeked');
    const handleCanPlay = () => show('canplay');
    const handleError = () => log('thumb-error', {
      code: el.error?.code,
      message: el.error?.message,
    });
    const handleWaiting = () => log('thumb-waiting');
    const handleSuspend = () => log('thumb-suspend');

    el.addEventListener('loadedmetadata', seekToPreviewFrame);
    el.addEventListener('loadeddata', handleLoadedData);
    el.addEventListener('seeked', handleSeeked);
    el.addEventListener('canplay', handleCanPlay);
    el.addEventListener('error', handleError);
    el.addEventListener('waiting', handleWaiting);
    el.addEventListener('suspend', handleSuspend);

    return () => {
      el.removeEventListener('loadedmetadata', seekToPreviewFrame);
      el.removeEventListener('loadeddata', handleLoadedData);
      el.removeEventListener('seeked', handleSeeked);
      el.removeEventListener('canplay', handleCanPlay);
      el.removeEventListener('error', handleError);
      el.removeEventListener('waiting', handleWaiting);
      el.removeEventListener('suspend', handleSuspend);
    };
  }, [log, src, startTime]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-transparent"
      data-video-flicker-debug={debugLabel}
    >
      <video
        ref={videoRef}
        src={src}
        className={`${className ?? ''} video-hq`.trim()}
        muted
        playsInline
        preload="auto"
        style={{
          opacity: isReady ? 1 : 0,
          transition: 'opacity 80ms linear',
          backgroundColor: 'transparent',
        }}
      />
    </div>
  );
};

export default VideoThumbnailPreview;
