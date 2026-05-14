import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useVideoMuted } from '@/hooks/use-video-muted';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * 안드로이드 Chrome/WebView에서 <video>가 첫 프레임을 그리기 전에
 * 기본 재생 버튼 오버레이(큰 동그라미)가 잠깐 깜빡이는 문제를 방지하기 위해
 * `playing` 이벤트가 발생할 때까지 video 요소를 시각적으로 숨겨둔다.
 */
const VideoPlayer = ({ src, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  // 외부 오버레이(댓글/태그 검색)가 떠 있는 동안 재생을 잠시 멈춰두기 위한 ref
  const wasPlayingBeforeOverlayRef = useRef(false);

  // 전역 음소거 상태 (Reels/PostItemVideo와 공유됨)
  const [muted, setMuted] = useVideoMuted();

  // 타임라인 상태
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(0 as 0 | 1);
  const [scrubTime, setScrubTime] = useState(0);
  const wasPlayingBeforeScrubRef = useRef(false);

  // rAF 기반 스무스 보간을 위한 DOM refs
  const progressBarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement>(null);
  const videoCurrentTimeRef = useRef(0);
  const isDraggingForRafRef = useRef(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handlePlaying = () => setIsReady(true);
    const handleLoadedMeta = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const handleTimeUpdate = () => {
      const t = el.currentTime || 0;
      videoCurrentTimeRef.current = t;
      setCurrentTime(t);
    };
    el.addEventListener('playing', handlePlaying);
    el.addEventListener('loadedmetadata', handleLoadedMeta);
    el.addEventListener('durationchange', handleLoadedMeta);
    el.addEventListener('timeupdate', handleTimeUpdate);

    // 일부 환경에서 autoplay가 지연될 수 있어 수동 play() 호출
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // autoplay 정책으로 실패해도 무음/playsInline이므로 대부분 통과됨
      });
    }

    // 초기값 동기화
    if (Number.isFinite(el.duration)) setDuration(el.duration);
    setCurrentTime(el.currentTime || 0);

    return () => {
      el.removeEventListener('playing', handlePlaying);
      el.removeEventListener('loadedmetadata', handleLoadedMeta);
      el.removeEventListener('durationchange', handleLoadedMeta);
      el.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [src]);

  // 전역 muted 상태를 video 요소에 반영하고, 음소거 해제 시 재생 시도
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) {
      // 사용자가 버튼으로 토글한 직후이므로 user gesture가 살아있어 재생 허용됨
      v.play().catch(() => {
        // 정책상 실패 시 다시 muted로 폴백
        v.muted = true;
      });
    }
  }, [muted, src]);

  // 댓글 다이얼로그가 열려있는 동안 영상 일시정지, 닫히면 재개
  useEffect(() => {
    let commentsOpen = !!(window as any).__commentsDialogOpen;

    const apply = () => {
      const v = videoRef.current;
      if (!v) return;
      if (commentsOpen) {
        if (!v.paused) {
          wasPlayingBeforeOverlayRef.current = true;
          v.pause();
        }
      } else if (wasPlayingBeforeOverlayRef.current) {
        wasPlayingBeforeOverlayRef.current = false;
        v.play().catch(() => {});
      }
    };

    const handleComments = (e: Event) => {
      commentsOpen = !!(e as CustomEvent).detail?.open;
      apply();
    };

    window.addEventListener('comments-dialog-visibility', handleComments);
    apply();

    return () => {
      window.removeEventListener('comments-dialog-visibility', handleComments);
    };
  }, []);

  // ── 타임라인 스크럽 ────────────────────────────────────────
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const latestScrubRef = useRef(0);

  // rAF로 진행률을 매 프레임 보간 — 비디오 timeupdate(~250ms)의 끊김을 제거.
  useEffect(() => {
    if (duration <= 0) return;
    let rafId = 0;
    let smoothed = videoCurrentTimeRef.current;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      const target = isDraggingForRafRef.current ? latestScrubRef.current : videoCurrentTimeRef.current;

      if (isDraggingForRafRef.current) {
        smoothed = target;
      } else {
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
      if (handleRef.current) {
        handleRef.current.style.left = `calc(12px + (100% - 24px) * ${ratio})`;
      }
      if (currentTimeTextRef.current) currentTimeTextRef.current.textContent = formatTime(smoothed);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

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
    isDraggingForRafRef.current = true;
    const v = videoRef.current;
    if (v) {
      wasPlayingBeforeScrubRef.current = !v.paused;
      v.pause();
    }
    setIsScrubbing(1);
    const t = computeTimeFromClientX(e.clientX);
    latestScrubRef.current = t;
    setScrubTime(t);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const t = computeTimeFromClientX(e.clientX);
    latestScrubRef.current = t;
    setScrubTime(t);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    isDraggingForRafRef.current = false;
    const t = latestScrubRef.current;
    const v = videoRef.current;
    if (v) {
      try { v.currentTime = t; } catch {}
      videoCurrentTimeRef.current = t;
      setCurrentTime(t);
      if (wasPlayingBeforeScrubRef.current) {
        v.play().catch(() => {});
      }
    }
    setIsScrubbing(0);
  };

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progress = duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        className={cn(className ?? 'w-full h-full object-cover', 'video-hq')}
        autoPlay
        loop
        muted={muted}
        playsInline
        preload="auto"
        style={{
          opacity: isReady ? 1 : 0,
          transition: 'opacity 150ms ease-out',
        }}
      />

      {/* 좌상단 음소거 토글 — 영상을 눌러도 닫히므로, 사용자가 소리를 제어할 수 있도록 별도 버튼 제공 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        aria-label={muted ? '음소거 해제' : '음소거'}
        className={cn(
          'absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md',
          'flex items-center justify-center border border-white/10',
          'active:scale-95 transition-transform'
        )}
      >
        {muted ? (
          <VolumeX className="w-4 h-4 text-white" />
        ) : (
          <Volume2 className="w-4 h-4 text-white" />
        )}
      </button>

      {/* 하단 타임라인 (드래그 스크럽 지원) */}
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

          {/* 트랙 (배경) */}
          <div
            className={cn(
              'relative w-full rounded-full bg-white/25 overflow-hidden transition-[height] duration-150',
              isScrubbing === 1 ? 'h-1.5' : 'h-1'
            )}
          >
            {/* 진행 바 — rAF로 매 프레임 width 업데이트 */}
            <div
              ref={progressBarRef}
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* 핸들 (스크럽 중에만 표시) — rAF로 매 프레임 left 업데이트 */}
          <div
            ref={handleRef}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none transition-[width,height,opacity] duration-150',
              isScrubbing === 1 ? 'w-3.5 h-3.5 opacity-100' : 'w-0 h-0 opacity-0'
            )}
            style={{
              left: `calc(12px + (100% - 24px) * ${progress})`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      </div>
    </>
  );
};

export default VideoPlayer;
