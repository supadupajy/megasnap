import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import VideoOverlayControls from './VideoOverlayControls';
import { useVideoMuted } from '@/hooks/use-video-muted';

const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface PostItemVideoProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
}

/**
 * 리스트뷰용 영상 플레이어 컴포넌트.
 * - 영상 영역 탭 → 재생/일시정지 토글
 * - 일시정지 시 중앙에 큰 플레이 아이콘 오버레이
 * - 별도 이미지 썸네일 대신 비디오가 디코드한 첫 프레임부터 노출
 *
 * 음소거 토글/타임라인/스크럽 등 공통 컨트롤은 VideoOverlayControls가 처리한다.
 */
const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
}) => {
  const [userPaused, setUserPaused] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [muted] = useVideoMuted();

  useEffect(() => {
    setUserPaused(false);
    setFirstFrameReady(false);

    const v = videoRef.current;
    if (!v) return;

    const markReady = () => setFirstFrameReady(true);
    const onPlaying = () => {
      setUserPaused(false);
      markReady();
    };

    v.addEventListener('loadeddata', markReady);
    v.addEventListener('canplay', markReady);
    v.addEventListener('playing', onPlaying);

    if (v.readyState >= 2) markReady();

    return () => {
      v.removeEventListener('loadeddata', markReady);
      v.removeEventListener('canplay', markReady);
      v.removeEventListener('playing', onPlaying);
    };
  }, [videoRef, src]);

  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => {});
    } else {
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
    <div className="relative h-full w-full bg-gray-200">
      <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 z-[1] w-full h-full object-cover bg-gray-200 post-item-video video-hq"
        poster={TRANSPARENT_POSTER}
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
          transition: 'opacity 120ms ease-out',
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
