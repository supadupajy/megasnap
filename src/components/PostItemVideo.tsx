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
}

const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
  posterUrl,
  autoPlay = false,
  showControls = true,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const revealTokenRef = useRef(0);
  const firstFrameReadyRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [muted, setMuted] = useVideoMuted();

  const setFrameReady = (value: boolean) => {
    firstFrameReadyRef.current = value;
    setFirstFrameReady(value);
  };

  const setVideoRefs = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (videoRef) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    }
  }, [videoRef]);

  const revealAfterPaintedFrame = useCallback((video: HTMLVideoElement) => {
    const token = revealTokenRef.current;
    const reveal = () => {
      if (token !== revealTokenRef.current) return;
      setFrameReady(true);
    };

    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(reveal);
    } else {
      window.requestAnimationFrame(reveal);
    }
  }, []);

  useEffect(() => {
    userPausedRef.current = false;
    revealTokenRef.current += 1;
    setUserPaused(false);
    setFrameReady(false);
  }, [src]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      if (!autoPlay) setFrameReady(true);
    };
    const handlePlaying = () => {
      userPausedRef.current = false;
      setUserPaused(false);
      revealAfterPaintedFrame(video);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('playing', handlePlaying);
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [autoPlay, revealAfterPaintedFrame, src]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    if (!autoPlay) {
      if (!video.paused) video.pause();
      return;
    }

    if (userPausedRef.current) return;

    const play = () => {
      if (Number.isFinite(video.duration) && video.duration > 0.45 && video.currentTime < 0.05) {
        try {
          video.currentTime = Math.min(0.35, video.duration - 0.05);
        } catch {}
      }

      video.play().catch(() => {
        video.muted = true;
        setMuted(true);
        video.play().catch(() => {});
      });
    };

    if (video.readyState >= 2) {
      play();
      return;
    }

    video.addEventListener('canplay', play, { once: true });
    return () => video.removeEventListener('canplay', play);
  }, [autoPlay, setMuted, src]);

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
        // 활성(autoPlay) 상태일 때만 적극 로드. 비활성 슬라이드에서는
        // 메타데이터(=영상 길이/첫 프레임 디코드 준비)만 받아 모바일 데이터/CPU/메모리 부담을 줄인다.
        // 활성으로 전환되는 즉시 브라우저가 추가 데이터를 받아오므로 사용자 체감 지연은 거의 없다.
        preload={autoPlay ? "auto" : "metadata"}
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
