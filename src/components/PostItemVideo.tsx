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
 * - 영상이 첫 프레임을 디코드하기 전에는 어두운 배경만 보여주고,
 *   첫 프레임이 준비되면 그대로 노출해 "썸네일 → 영상 첫프레임" 전환 시 튀는 현상을 없앤다.
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

    // 이미 첫 프레임을 디코드한 상태(readyState >= 2: HAVE_CURRENT_DATA)면 즉시 ready로 표시
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
    <div className="relative h-full w-full bg-neutral-900">
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 z-[1] w-full h-full object-cover post-item-video video-hq"
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
