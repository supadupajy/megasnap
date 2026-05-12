import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostItemVideoProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  posterImage: string;
  showPoster: boolean;
  onLoadedData: () => void;
  onImageError: React.ReactEventHandler<HTMLImageElement>;
}

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * 리스트뷰용 영상 플레이어 컴포넌트.
 * - 영상 영역 탭 → 재생/일시정지 토글
 * - 하단 커스텀 타임라인 (드래그 스크럽 지원)
 * - 일시정지 시 중앙에 큰 플레이 아이콘 오버레이
 */
const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
  posterImage,
  showPoster,
  onLoadedData,
  onImageError,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const wasPlayingBeforeScrubRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const latestTimeRef = useRef(0);

  // 영상 시간/길이/재생 상태 추적
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTimeUpdate = () => {
      if (!isDraggingRef.current) setCurrentTime(v.currentTime || 0);
    };
    const onLoadedMeta = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    const onDurationChange = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);

    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    setIsPaused(v.paused);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [videoRef, src]);

  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  // ── 타임라인 스크럽 ────────────────────
  const computeTimeFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    const v = videoRef.current;
    if (v) {
      wasPlayingBeforeScrubRef.current = !v.paused;
      v.pause();
    }
    setIsScrubbing(true);
    const t = computeTimeFromClientX(e.clientX);
    latestTimeRef.current = t;
    setScrubTime(t);
    if (v) v.currentTime = t;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const t = computeTimeFromClientX(e.clientX);
    latestTimeRef.current = t;
    setScrubTime(t);
    const v = videoRef.current;
    if (v) v.currentTime = t;
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    const v = videoRef.current;
    if (v) {
      v.currentTime = latestTimeRef.current;
      setCurrentTime(latestTimeRef.current);
    }
    setIsScrubbing(false);
    if (wasPlayingBeforeScrubRef.current && v) {
      v.play().catch(() => {});
    }
  };

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progress = duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;

  return (
    <div className="relative h-full w-full bg-gray-200">
      <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
      <video
        ref={videoRef}
        src={src}
        className="relative z-[1] w-full h-full object-cover bg-gray-200"
        muted
        loop
        playsInline
        disablePictureInPicture
        onClick={handleVideoTap}
        onLoadedData={onLoadedData}
      />

      {/* 비디오 로드 전 썸네일 */}
      {showPoster && (
        <img
          src={posterImage}
          alt=""
          className="absolute inset-0 z-10 w-full h-full object-cover bg-gray-200 pointer-events-none"
          onError={onImageError}
        />
      )}

      {/* 일시정지 시 중앙 플레이 아이콘 오버레이 */}
      {isPaused && !showPoster && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}

      {/* 하단 타임라인 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 select-none"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'none' }}
      >
        <div
          ref={trackRef}
          className="relative w-full px-3 py-2 cursor-pointer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {/* 스크럽 중 시간 표시 */}
          {isScrubbing && duration > 0 && (
            <div className="absolute -top-7 left-0 right-0 flex justify-center pointer-events-none">
              <span className="px-2 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-black tabular-nums backdrop-blur-md">
                {formatTime(displayTime)} / {formatTime(duration)}
              </span>
            </div>
          )}

          {/* 트랙 배경 */}
          <div
            className={cn(
              'relative w-full rounded-full bg-white/30 overflow-hidden transition-[height] duration-150',
              isScrubbing ? 'h-1.5' : 'h-1'
            )}
          >
            {/* 진행 바 */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
              style={{
                width: `${progress * 100}%`,
                transition: isScrubbing ? 'none' : 'width 120ms linear',
              }}
            />
          </div>

          {/* 스크럽 핸들 */}
          {isScrubbing && (
            <div
              className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-md pointer-events-none"
              style={{
                left: `calc(${progress * 100}% )`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PostItemVideo;
