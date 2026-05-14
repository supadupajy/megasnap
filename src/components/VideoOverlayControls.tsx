import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoMuted } from '@/hooks/use-video-muted';

/**
 * 비디오 위에 얹는 공통 오버레이 컨트롤.
 * - 좌상단 음소거 토글 버튼 (전역 muted 상태와 동기화)
 * - 하단 타임라인 (드래그 스크럽 + rAF 기반 스무스 진행률 + 현재/전체 시간 표시)
 *
 * 비디오 요소의 ref만 받아서 동작하므로, 비디오를 어떻게 마운트/제어하는지는
 * 부모 컴포넌트에 위임한다 (PostItemVideo, VideoPlayer 등).
 */
interface VideoOverlayControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  /**
   * 스크럽이 시작/끝날 때 호출. 부모가 "스크럽 전 재생 상태"를 기억해두고
   * 스크럽 종료 후 재개하고 싶을 때 사용한다. (선택)
   */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoOverlayControls: React.FC<VideoOverlayControlsProps> = ({
  videoRef,
  onScrubStart,
  onScrubEnd,
}) => {
  const [muted, setMuted] = useVideoMuted();
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // 비디오의 실시간 currentTime을 추적하는 ref (rAF가 참조)
  const videoCurrentTimeRef = useRef(0);
  // 스크럽 중 사용자가 지정한 위치를 추적하는 ref (rAF가 참조)
  const scrubTimeRef = useRef(0);
  const isDraggingRef = useRef(false);

  // DOM 직접 조작용 refs (React 리렌더 회피, 60fps 부드러운 업데이트)
  const progressBarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // ── 비디오 metadata / currentTime 추적 ─────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const updateDuration = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    const handleTimeUpdate = () => {
      videoCurrentTimeRef.current = v.currentTime || 0;
    };

    v.addEventListener('loadedmetadata', updateDuration);
    v.addEventListener('durationchange', updateDuration);
    v.addEventListener('timeupdate', handleTimeUpdate);

    // 초기값 동기화
    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    videoCurrentTimeRef.current = v.currentTime || 0;

    return () => {
      v.removeEventListener('loadedmetadata', updateDuration);
      v.removeEventListener('durationchange', updateDuration);
      v.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef]);

  // 전역 muted 상태를 video element에 반영
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [videoRef, muted]);

  // ── rAF 기반 스무스 보간 ─────────────────────────────────────
  // 비디오 timeupdate(~250ms)의 끊김을 제거. 진행 바/핸들/시간 텍스트를
  // DOM 직접 조작으로 매 프레임 업데이트한다 (React 리렌더 비용 0).
  useEffect(() => {
    if (duration <= 0) return;
    let rafId = 0;
    let smoothed = videoCurrentTimeRef.current;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      if (isDraggingRef.current) {
        // 스크럽 중: 사용자가 지정한 위치 즉시 반영
        smoothed = scrubTimeRef.current;
      } else {
        // 비디오 재생 속도(=1)로 자연스럽게 흐르고, 실제 currentTime과 부드럽게 보정
        smoothed += dt;
        const diff = videoCurrentTimeRef.current - smoothed;
        if (Math.abs(diff) > 0.4) {
          // 큰 점프(시킹/로딩 등): 즉시 동기화
          smoothed = videoCurrentTimeRef.current;
        } else {
          smoothed += diff * Math.min(1, dt * 4);
        }
      }

      if (smoothed < 0) smoothed = 0;
      if (smoothed > duration) smoothed = duration;

      const ratio = duration > 0 ? smoothed / duration : 0;
      const pct = ratio * 100;

      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }
      if (handleRef.current) {
        handleRef.current.style.left = `calc(12px + (100% - 24px) * ${ratio})`;
      }
      if (currentTimeTextRef.current) {
        currentTimeTextRef.current.textContent = formatTime(smoothed);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  // ── 스크럽(드래그) 핸들러 ────────────────────────────────────
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
    setIsScrubbing(true);

    const t = computeTimeFromClientX(e.clientX);
    scrubTimeRef.current = t;

    const v = videoRef.current;
    if (v) v.currentTime = t;

    onScrubStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const t = computeTimeFromClientX(e.clientX);
    scrubTimeRef.current = t;
    const v = videoRef.current;
    if (v) v.currentTime = t;
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    setIsScrubbing(false);

    const v = videoRef.current;
    if (v) {
      v.currentTime = scrubTimeRef.current;
      videoCurrentTimeRef.current = scrubTimeRef.current;
    }

    onScrubEnd?.();
  };

  return (
    <>
      {/* 좌상단 음소거 토글 */}
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

      {/* 하단 타임라인 (드래그 스크럽) */}
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
                {formatTime(0)}
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
              isScrubbing ? 'h-1.5' : 'h-1'
            )}
          >
            {/* 진행 바 — rAF로 매 프레임 width 업데이트 */}
            <div
              ref={progressBarRef}
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
              style={{ width: '0%' }}
            />
          </div>

          {/* 핸들 (스크럽 중에만 크게 표시) — rAF로 매 프레임 left 업데이트 */}
          <div
            ref={handleRef}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none transition-[width,height,opacity] duration-150',
              isScrubbing ? 'w-3.5 h-3.5 opacity-100' : 'w-0 h-0 opacity-0'
            )}
            style={{
              left: '12px',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      </div>
    </>
  );
};

export default VideoOverlayControls;
