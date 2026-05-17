import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import VideoOverlayControls from './VideoOverlayControls';
import { useVideoMuted } from '@/hooks/use-video-muted';

const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface PostItemVideoProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [muted, setMuted] = useVideoMuted();

  const setVideoRefs = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (videoRef) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    }
  }, [videoRef]);

  useEffect(() => {
    userPausedRef.current = false;
    setUserPaused(false);
    setFirstFrameReady(false);

    const video = localVideoRef.current;
    if (!video) return;

    const markReady = () => setFirstFrameReady(true);
    const handlePlaying = () => {
      userPausedRef.current = false;
      setUserPaused(false);
      markReady();
    };

    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('playing', handlePlaying);

    if (video.readyState >= 2) markReady();

    return () => {
      video.removeEventListener('loadeddata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [src]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    if (!autoPlay) {
      if (!video.paused) video.pause();
      return;
    }

    if (userPausedRef.current) return;

    const play = () => {
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
  }, [autoPlay, src, setMuted]);

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

  const wasPlayingBeforeScrubRef = useRef(false);
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
    <div className="relative h-full w-full bg-black">
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
