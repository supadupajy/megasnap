import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import VideoOverlayControls from './VideoOverlayControls';
import { useVideoMuted } from '@/hooks/use-video-muted';

const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface PostItemVideoProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  /** 영상이 첫 프레임을 디코드하기 전 보여줄 썸네일 (피드의 이미지 URL). */
  posterUrl?: string;
  autoPlay?: boolean;
}

/**
 * 리스트뷰용 영상 플레이어 컴포넌트.
 * - 영상 영역 탭 → 재생/일시정지 토글
 * - 일시정지 시 중앙에 큰 플레이 아이콘 오버레이
 * - 영상이 첫 프레임을 디코드하기 전에는 posterUrl 썸네일을 보여주고,
 *   준비되면 비디오로 부드럽게 페이드인한다 (흰/회색 빈 박스 방지)
 *
 * 음소거 토글/타임라인/스크럽 등 공통 컨트롤은 VideoOverlayControls가 처리한다.
 */
const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
  posterUrl,
  autoPlay = false,
}) => {
  const [userPaused, setUserPaused] = useState(false);
  const userPausedRef = useRef(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [muted, setMuted] = useVideoMuted();

  useEffect(() => {
    userPausedRef.current = false;
    setUserPaused(false);
    setFirstFrameReady(false);

    const v = videoRef.current;
    if (!v) return;

    const tryPlay = () => {
      if (!autoPlay || userPausedRef.current) return;
      v.play().catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
    };
    const markReady = () => setFirstFrameReady(true);
    const onCanPlay = () => {
      markReady();
      tryPlay();
    };
    const onPlaying = () => {
      setUserPaused(false);
      markReady();
    };

    v.addEventListener('loadeddata', markReady);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('playing', onPlaying);

    if (v.readyState >= 2) {
      markReady();
      tryPlay();
    }

    return () => {
      v.removeEventListener('loadeddata', markReady);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('playing', onPlaying);
    };
  }, [videoRef, src, autoPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [videoRef, muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!autoPlay) v.pause();
  }, [videoRef, autoPlay]);

  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPausedRef.current = false;
      setUserPaused(false);
      v.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      setUserPaused(true);
      v.pause();
    }
  };

  const wasPlayingBeforeScrubRef = useRef(false);
  const handleScrubStart = () => {
    const v = videoRef.current;
    if (!v) return;
    wasPlayingBeforeScrubRef.current = !v.paused;
    v.pause();
  };
  const handleScrubEnd = () => {
    const v = videoRef.current;
    if (!v) return;
    if (wasPlayingBeforeScrubRef.current) {
      v.play().catch(() => {});
    }
  };

  return (
    <div className="relative h-full w-full bg-neutral-900">
      {/* 첫 프레임 디코드 전 보여줄 썸네일.
          posterUrl이 있을 때만 <img>로 깔아 두고, 영상이 준비되면 부드럽게 사라진다.
          이렇게 별도 <img>로 두는 이유: <video poster>는 영상이 잠시라도 재생되면 사라지지만,
          우리는 영상 페이드인이 끝날 때까지 썸네일을 유지해 깜빡임을 없애기 위함. */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: firstFrameReady ? 0 : 1,
            transition: 'opacity 200ms ease-out',
          }}
          draggable={false}
        />
      )}

      <video
        ref={videoRef}
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
          transition: 'opacity 200ms ease-out',
        }}
      />

      {userPaused && firstFrameReady && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}

      <VideoOverlayControls
        videoRef={videoRef}
        onScrubStart={handleScrubStart}
        onScrubEnd={handleScrubEnd}
      />
    </div>
  );
};

export default PostItemVideo;
