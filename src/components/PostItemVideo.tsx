import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import VideoOverlayControls from './VideoOverlayControls';
import { useVideoMuted } from '@/hooks/use-video-muted';

const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const shortDebugUrl = (url?: string) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return `${parsed.hostname}/${parts.slice(-2).join('/')}`;
  } catch {
    return url.slice(0, 120);
  }
};

interface PostItemVideoProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  src: string;
  posterUrl?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  debugLabel?: string;
}

const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
  posterUrl,
  autoPlay = false,
  showControls = true,
  debugLabel = 'post-item-video',
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const revealTokenRef = useRef(0);
  const [userPaused, setUserPaused] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [muted, setMuted] = useVideoMuted();

  const log = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    const video = localVideoRef.current;
    const computed = video && typeof window !== 'undefined' ? window.getComputedStyle(video) : null;
    console.info('[video-flicker-debug]', event, {
      label: debugLabel,
      src: shortDebugUrl(src),
      posterUrl: shortDebugUrl(posterUrl),
      autoPlay,
      firstFrameReady,
      video: video ? {
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: Number(video.currentTime.toFixed(3)),
        duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : String(video.duration),
        paused: video.paused,
        seeking: video.seeking,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        inlineOpacity: video.style.opacity,
        computedOpacity: computed?.opacity,
        computedBg: computed?.backgroundColor,
        visibility: computed?.visibility,
      } : null,
      ...extra,
    });
  }, [autoPlay, debugLabel, firstFrameReady, posterUrl, src]);

  const setVideoRefs = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (videoRef) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    }
    console.info('[video-flicker-debug]', el ? 'active-video-ref-attached' : 'active-video-ref-detached', {
      label: debugLabel,
      src: shortDebugUrl(src),
      posterUrl: shortDebugUrl(posterUrl),
      readyState: el?.readyState,
      networkState: el?.networkState,
    });
  }, [debugLabel, posterUrl, src, videoRef]);

  const revealAfterPaintedFrame = useCallback((video: HTMLVideoElement) => {
    const token = revealTokenRef.current;
    const reveal = () => {
      if (token !== revealTokenRef.current) return;
      log('active-video-first-frame-ready');
      setFirstFrameReady(true);
    };

    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(reveal);
    } else {
      window.requestAnimationFrame(reveal);
    }
  }, [log]);

  useEffect(() => {
    userPausedRef.current = false;
    revealTokenRef.current += 1;
    setUserPaused(false);
    setFirstFrameReady(false);
    log('active-video-src-reset');
  }, [log, src]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      log('active-video-loadeddata');
      if (!autoPlay) setFirstFrameReady(true);
    };
    const handlePlaying = () => {
      userPausedRef.current = false;
      setUserPaused(false);
      log('active-video-playing');
      revealAfterPaintedFrame(video);
    };
    const handleWaiting = () => log('active-video-waiting');
    const handleCanPlay = () => log('active-video-canplay');
    const handleError = () => log('active-video-error', { code: video.error?.code, message: video.error?.message });

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('playing', handlePlaying);
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [autoPlay, log, revealAfterPaintedFrame, src]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    log('active-video-autoplay-effect-enter');

    if (!autoPlay) {
      if (!video.paused) {
        log('active-video-autoplay-off-pause');
        video.pause();
      }
      return;
    }

    if (userPausedRef.current) {
      log('active-video-autoplay-skip-user-paused');
      return;
    }

    const play = () => {
      if (Number.isFinite(video.duration) && video.duration > 0.45 && video.currentTime < 0.05) {
        try {
          const target = Math.min(0.35, video.duration - 0.05);
          log('active-video-autoplay-seek-before-play', { target });
          video.currentTime = target;
        } catch (error) {
          log('active-video-autoplay-seek-failed', { message: error instanceof Error ? error.message : String(error) });
        }
      }

      log('active-video-play-request');
      video.play().then(() => {
        log('active-video-play-success');
      }).catch(() => {
        log('active-video-play-failed-retry-muted');
        video.muted = true;
        setMuted(true);
        video.play().then(() => log('active-video-play-retry-success')).catch((error) => {
          log('active-video-play-retry-failed', { message: error instanceof Error ? error.message : String(error) });
        });
      });
    };

    if (video.readyState >= 2) {
      play();
      return;
    }

    log('active-video-wait-canplay-for-play');
    video.addEventListener('canplay', play, { once: true });
    return () => video.removeEventListener('canplay', play);
  }, [autoPlay, log, setMuted, src]);

  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showControls) return;

    const video = localVideoRef.current;
    if (!video) return;

    if (video.paused) {
      userPausedRef.current = false;
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      setUserPaused(true);
      video.pause();
    }
  };

  const handleScrubStart = () => {
    const video = localVideoRef.current;
    if (!video) return;
    wasPlayingBeforeScrubRef.current = !video.paused;
    video.pause();
  };

  const handleScrubEnd = () => {
    const video = localVideoRef.current;
    if (!video) return;
    if (wasPlayingBeforeScrubRef.current) {
      video.play().catch(() => {});
    }
  };

  return (
    <div className="relative h-full w-full bg-transparent">
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-[1] w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      )}

      <video
        ref={setVideoRefs}
        src={src}
        className="absolute inset-0 z-[2] w-full h-full object-cover post-item-video video-hq transition-opacity duration-75"
        poster={posterUrl || TRANSPARENT_POSTER}
        loop
        muted={muted}
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        disableRemotePlayback={true}
        onClick={handleVideoTap}
        style={{
          opacity: firstFrameReady ? 1 : 0,
          backgroundColor: 'transparent',
        }}
      />

      {showControls && userPaused && firstFrameReady && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}

      {showControls && (
        <VideoOverlayControls
          videoRef={localVideoRef}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
        />
      )}
    </div>
  );
};

export default PostItemVideo;
