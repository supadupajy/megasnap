import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import VideoOverlayControls from './VideoOverlayControls';
import { useVideoMuted } from '@/hooks/use-video-muted';

const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface PostItemVideoProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  src: string;
  posterUrl?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  debugLabel?: string;
}

const getShortUrl = (url?: string) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return `${parsed.hostname}/${parts.slice(-2).join('/')}`;
  } catch {
    return url.slice(0, 120);
  }
};

const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
  posterUrl,
  autoPlay = false,
  showControls = true,
  debugLabel = 'unknown-video',
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const userPausedRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const firstTimeUpdateLoggedRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [muted, setMuted] = useVideoMuted();

  const getVideoSnapshot = useCallback(() => {
    const video = localVideoRef.current;
    if (!video) return { hasVideo: false };

    return {
      hasVideo: true,
      readyState: video.readyState,
      networkState: video.networkState,
      paused: video.paused,
      ended: video.ended,
      muted: video.muted,
      currentTime: Number(video.currentTime.toFixed(3)),
      duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : String(video.duration),
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      clientWidth: video.clientWidth,
      clientHeight: video.clientHeight,
      buffered: video.buffered.length
        ? `${Number(video.buffered.start(0).toFixed(3))}-${Number(video.buffered.end(video.buffered.length - 1).toFixed(3))}`
        : 'empty',
      currentSrc: getShortUrl(video.currentSrc || src),
      poster: getShortUrl(video.poster || posterUrl),
      styleOpacity: video.style.opacity,
      computedOpacity: typeof window !== 'undefined' ? window.getComputedStyle(video).opacity : undefined,
    };
  }, [posterUrl, src]);

  const debugLog = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    console.info('[video-debug]', event, {
      label: debugLabel,
      instanceId: instanceIdRef.current,
      src: getShortUrl(src),
      posterUrl: getShortUrl(posterUrl),
      autoPlay,
      showControls,
      firstFrameReady,
      userPaused: userPausedRef.current,
      ...extra,
      video: getVideoSnapshot(),
    });
  }, [autoPlay, debugLabel, firstFrameReady, getVideoSnapshot, posterUrl, showControls, src]);

  const setVideoRefs = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (videoRef) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    }

    console.info('[video-debug]', el ? 'ref-attached' : 'ref-detached', {
      label: debugLabel,
      instanceId: instanceIdRef.current,
      src: getShortUrl(src),
      posterUrl: getShortUrl(posterUrl),
      autoPlay,
      showControls,
      elementReadyState: el?.readyState,
      elementNetworkState: el?.networkState,
      elementCurrentSrc: getShortUrl(el?.currentSrc),
    });
  }, [autoPlay, debugLabel, posterUrl, showControls, src, videoRef]);

  useEffect(() => {
    debugLog('mount');
    return () => debugLog('unmount');
  }, [debugLog]);

  useEffect(() => {
    debugLog('props-change');
  }, [autoPlay, showControls, src, posterUrl, debugLabel, debugLog]);

  useEffect(() => {
    userPausedRef.current = false;
    firstTimeUpdateLoggedRef.current = false;
    setUserPaused(false);
    setFirstFrameReady(false);

    const video = localVideoRef.current;
    debugLog('src-effect-reset', { initialReadyState: video?.readyState, initialNetworkState: video?.networkState });
    if (!video) return;

    const markReady = (reason: string) => {
      setFirstFrameReady(true);
      debugLog('first-frame-ready', { reason });
    };

    const handleLoadedData = () => markReady('loadeddata');
    const handleCanPlay = () => markReady('canplay');
    const handlePlaying = () => {
      userPausedRef.current = false;
      setUserPaused(false);
      markReady('playing');
    };
    const handleLoadedMetadata = () => debugLog('loadedmetadata');
    const handleCanPlayThrough = () => debugLog('canplaythrough');
    const handleWaiting = () => debugLog('waiting');
    const handleStalled = () => debugLog('stalled');
    const handleSuspend = () => debugLog('suspend');
    const handlePlay = () => debugLog('play-event');
    const handlePause = () => debugLog('pause-event');
    const handleSeeking = () => debugLog('seeking');
    const handleSeeked = () => debugLog('seeked');
    const handleEmptied = () => debugLog('emptied');
    const handleAbort = () => debugLog('abort');
    const handleResize = () => debugLog('resize');
    const handleError = () => debugLog('error-event', {
      code: video.error?.code,
      message: video.error?.message,
    });
    const handleTimeUpdate = () => {
      if (firstTimeUpdateLoggedRef.current) return;
      firstTimeUpdateLoggedRef.current = true;
      debugLog('first-timeupdate');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('suspend', handleSuspend);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('emptied', handleEmptied);
    video.addEventListener('abort', handleAbort);
    video.addEventListener('resize', handleResize);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);

    if (video.readyState >= 2) markReady('already-ready');

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('suspend', handleSuspend);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('emptied', handleEmptied);
      video.removeEventListener('abort', handleAbort);
      video.removeEventListener('resize', handleResize);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [src, debugLog]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.muted = muted;
    debugLog('muted-sync', { muted });
  }, [debugLog, muted]);

  useEffect(() => {
    const video = localVideoRef.current;
    debugLog('autoplay-effect-enter');
    if (!video) return;

    if (!autoPlay) {
      if (!video.paused) {
        debugLog('autoplay-off-pause-before');
        video.pause();
        debugLog('autoplay-off-pause-after');
      }
      return;
    }

    if (userPausedRef.current) {
      debugLog('autoplay-skipped-user-paused');
      return;
    }

    const play = () => {
      debugLog('play-request-before');
      video.play().then(() => {
        debugLog('play-request-success');
      }).catch((error) => {
        debugLog('play-request-failed', {
          name: error instanceof Error ? error.name : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
        video.muted = true;
        setMuted(true);
        debugLog('play-request-retry-muted-before');
        video.play().then(() => {
          debugLog('play-request-retry-muted-success');
        }).catch((retryError) => {
          debugLog('play-request-retry-muted-failed', {
            name: retryError instanceof Error ? retryError.name : undefined,
            message: retryError instanceof Error ? retryError.message : String(retryError),
          });
        });
      });
    };

    if (video.readyState >= 2) {
      play();
      return;
    }

    debugLog('play-waiting-for-canplay');
    video.addEventListener('canplay', play, { once: true });
    return () => video.removeEventListener('canplay', play);
  }, [autoPlay, src, setMuted, debugLog]);

  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    debugLog('tap', { showControls });
    if (!showControls) return;

    const video = localVideoRef.current;
    if (!video) return;

    if (video.paused) {
      userPausedRef.current = false;
      setUserPaused(false);
      debugLog('tap-play-before');
      video.play().then(() => {
        debugLog('tap-play-success');
      }).catch((error) => {
        debugLog('tap-play-failed', {
          name: error instanceof Error ? error.name : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      userPausedRef.current = true;
      setUserPaused(true);
      debugLog('tap-pause-before');
      video.pause();
      debugLog('tap-pause-after');
    }
  };

  const handleScrubStart = () => {
    const video = localVideoRef.current;
    if (!video) return;
    wasPlayingBeforeScrubRef.current = !video.paused;
    debugLog('scrub-start', { wasPlayingBeforeScrub: wasPlayingBeforeScrubRef.current });
    video.pause();
  };

  const handleScrubEnd = () => {
    const video = localVideoRef.current;
    if (!video) return;
    debugLog('scrub-end', { shouldResume: wasPlayingBeforeScrubRef.current });
    if (wasPlayingBeforeScrubRef.current) {
      video.play().then(() => {
        debugLog('scrub-resume-success');
      }).catch((error) => {
        debugLog('scrub-resume-failed', {
          name: error instanceof Error ? error.name : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }
  };

  return (
    <div className="relative h-full w-full bg-black" data-video-debug-label={debugLabel}>
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{
            opacity: firstFrameReady ? 0 : 1,
            transition: 'opacity 180ms ease-out',
          }}
          draggable={false}
          onLoad={() => debugLog('poster-load')}
          onError={() => debugLog('poster-error')}
        />
      )}

      <video
        ref={setVideoRefs}
        src={src}
        className="absolute inset-0 z-[1] w-full h-full object-cover post-item-video video-hq"
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
          transition: 'opacity 180ms ease-out',
          backgroundColor: '#000',
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
