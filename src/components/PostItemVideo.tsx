import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useVideoMuted } from '@/hooks/use-video-muted';

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
  // 화면에 표시할 "사용자가 직접 일시정지함" 상태.
  // - 자동 재생/스크롤/buffering/loop 전환 등으로 인한 짧은 pause는 무시한다.
  // - 사용자가 영상 영역을 탭해서 명시적으로 일시정지한 경우에만 true가 된다.
  // 이렇게 해야 영상 시작 직후나 슬라이드 전환 중에 큰 재생 아이콘이 깜빡이는
  // 플리커링이 발생하지 않는다.
  const [userPaused, setUserPaused] = useState(false);
  // 비디오의 첫 프레임이 실제로 그려졌는지(playing 이벤트 발생) 추적.
  // 첫 프레임이 그려지기 전에 video를 노출하면 브라우저가 회색 placeholder나
  // 기본 재생 아이콘을 잠깐 그려서 플리커링이 발생하므로, 그 전까지는 opacity:0으로 숨긴다.
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [muted, setMuted] = useVideoMuted();
  const wasPlayingBeforeScrubRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const latestTimeRef = useRef(0);

  // rAF 기반 스무스 보간을 위한 DOM refs
  const progressBarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement>(null);
  // 외부 timeupdate를 ref로도 추적 (rAF가 참조)
  const videoCurrentTimeRef = useRef(0);

  // 전역 muted 상태를 video 요소에 적용
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [videoRef, muted, src]);

  // 영상 시간/길이 추적 (재생 상태는 별도 — userPaused만 사용)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTimeUpdate = () => {
      const t = v.currentTime || 0;
      videoCurrentTimeRef.current = t;
      if (!isDraggingRef.current) setCurrentTime(t);
    };
    const onLoadedMeta = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    const onDurationChange = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    // 영상이 외부 요인으로 다시 재생되기 시작하면 (예: 자동 재생),
    // userPaused 플래그도 해제해서 오버레이가 노출되지 않도록 한다.
    // 또한 첫 프레임이 그려진 신호로도 사용한다.
    const onPlaying = () => {
      setUserPaused(false);
      setFirstFrameReady(true);
    };

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('playing', onPlaying);

    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('playing', onPlaying);
    };
  }, [videoRef, src]);

  // src가 바뀌면 사용자 일시정지 상태와 첫 프레임 준비 상태 초기화
  useEffect(() => {
    setUserPaused(false);
    setFirstFrameReady(false);
  }, [src]);

  // rAF로 진행률을 매 프레임 보간 — 비디오 timeupdate(~250ms)의 끊김을 제거.
  // 진행 바 width, 핸들 left, 현재 시간 텍스트를 DOM 직접 조작으로 업데이트해
  // React 리렌더 없이 60fps로 부드럽게 흐른다.
  useEffect(() => {
    if (duration <= 0) return;
    let rafId = 0;
    let smoothed = videoCurrentTimeRef.current;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      const target = isDraggingRef.current ? latestTimeRef.current : videoCurrentTimeRef.current;

      if (isDraggingRef.current) {
        smoothed = target;
      } else {
        // 비디오 재생 속도(=1)로 자연스럽게 흐르게 한 뒤, 실제 currentTime과 부드럽게 보정.
        smoothed += dt;
        const diff = target - smoothed;
        if (Math.abs(diff) > 0.4) smoothed = target;
        else smoothed += diff * Math.min(1, dt * 4);
      }

      if (smoothed < 0) smoothed = 0;
      if (smoothed > duration) smoothed = duration;

      const ratio = duration > 0 ? smoothed / duration : 0;
      const pct = ratio * 100;

      if (progressBarRef.current) progressBarRef.current.style.width = `${pct}%`;
      if (handleRef.current) handleRef.current.style.left = `${pct}%`;
      if (currentTimeTextRef.current) currentTimeTextRef.current.textContent = formatTime(smoothed);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  // 사용자가 영상 영역을 탭한 경우에만 명시적으로 일시정지/재생을 토글.
  // 이때만 userPaused가 true가 되어 큰 플레이 아이콘 오버레이가 노출된다.
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
        // poster 속성을 명시적으로 지정하는 것이 핵심.
        // 안드로이드 WebView는 video element가 첫 프레임을 디코드하기 전에
        // 회색 배경 위에 OS 네이티브 재생 아이콘을 그리는데, poster가 지정되어 있으면
        // 그 자리에 poster 이미지를 대신 그려서 네이티브 컨트롤이 보이지 않게 한다.
        poster={posterImage}
        className="absolute inset-0 z-[1] w-full h-full object-cover bg-gray-200 post-item-video video-hq"
        loop
        playsInline
        disablePictureInPicture
        controls={false}
        // 안드로이드/iOS WebView가 추가 컨트롤(다운로드, 캐스트 등)을 그리는 것을 차단
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        disableRemotePlayback={true}
        onClick={handleVideoTap}
        onLoadedData={onLoadedData}
      />

      {/* poster(썸네일) 이미지를 video 위에 항상 덮어둔다.
          - 첫 프레임이 그려지기 전까지는 완전 불투명(opacity:1)으로 video를 가린다.
          - 첫 프레임이 그려지면(firstFrameReady) opacity:0으로 부드럽게 사라진다.
          - 이렇게 하면 fade 도중에도 poster가 video를 덮은 상태이므로
            안드로이드 WebView의 회색 placeholder/네이티브 컨트롤이 노출되지 않는다.
          - showPoster prop이 명시적으로 true일 때(외부에서 강제로 poster 유지)도 표시. */}
      <img
        src={posterImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 z-10 w-full h-full object-cover bg-gray-200 pointer-events-none"
        onError={onImageError}
        style={{
          opacity: showPoster || !firstFrameReady ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      />

      {/* 좌측 상단 음소거 토글 버튼
          - z-index는 영상 내부 다른 오버레이(poster z-10, 일시정지 z-20, 진행바 z-30)보다 위에 있되,
            페이지의 sticky/fixed 헤더(보통 z-40~z-50)보다는 낮아야 스크롤 시 헤더 뒤로 자연스럽게 가려진다. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform border border-white/10"
        aria-label={muted ? '음소거 해제' : '음소거'}
      >
        {muted ? (
          <VolumeX className="w-4 h-4 text-white" />
        ) : (
          <Volume2 className="w-4 h-4 text-white" />
        )}
      </button>

      {/* 일시정지 시 중앙 플레이 아이콘 오버레이
          - 사용자가 직접 탭으로 일시정지한 경우(userPaused=true)에만 노출.
          - 그리고 비디오 첫 프레임이 그려진 후(firstFrameReady)에만 노출.
          - 자동 재생/스크롤/buffering/loop 전환/로딩 중에는 절대 표시되지 않는다. */}
      {userPaused && firstFrameReady && !showPoster && (
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
          {/* 시간 표시 (타임라인 우측 상단) — 현재 / 전체 */}
          {duration > 0 && (
            <div className="absolute -top-4 right-3 pointer-events-none flex items-baseline gap-1">
              <span
                ref={currentTimeTextRef}
                className="text-white text-[11px] font-black tabular-nums leading-none tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
              >
                {formatTime(displayTime)}
              </span>
              <span className="text-white/60 text-[11px] font-black tabular-nums leading-none tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                / {formatTime(duration)}
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
            {/* 진행 바 — rAF로 매 프레임 width 업데이트 */}
            <div
              ref={progressBarRef}
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* 스크럽 핸들 — rAF로 매 프레임 left 업데이트 */}
          <div
            ref={handleRef}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none transition-[width,height,opacity] duration-150',
              isScrubbing ? 'w-3 h-3 opacity-100' : 'w-0 h-0 opacity-0'
            )}
            style={{
              left: `${progress * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PostItemVideo;
