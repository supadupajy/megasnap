import React, { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MapLevelIndicatorProps {
  level: number;
  minLevel?: number;
  maxLevel?: number;
  markerHiddenFrom?: number;
  className?: string;
  style?: React.CSSProperties;
  onLevelChange?: (level: number) => void;
}

const MapLevelIndicator = ({
  level,
  minLevel = 3,
  maxLevel = 11,
  markerHiddenFrom = 7,
  className,
  style,
  onLevelChange,
}: MapLevelIndicatorProps) => {
  const safeLevel = Math.min(Math.max(Math.round(level), minLevel), maxLevel);
  const markerVisible = safeLevel < markerHiddenFrom;
  const progress = ((safeLevel - minLevel) / (maxLevel - minLevel)) * 100;
  const hiddenStart = ((markerHiddenFrom - minLevel) / (maxLevel - minLevel)) * 100;

  const trackRef = useRef<HTMLDivElement>(null);
  const lastEmittedLevelRef = useRef<number>(safeLevel);

  const computeLevelFromClientY = useCallback(
    (clientY: number): number | null => {
      const trackEl = trackRef.current;
      if (!trackEl) return null;
      const rect = trackEl.getBoundingClientRect();
      if (rect.height <= 0) return null;
      const rawRatio = (clientY - rect.top) / rect.height;
      const ratio = Math.min(Math.max(rawRatio, 0), 1);
      // 위쪽(0%) = minLevel(가장 확대), 아래쪽(100%) = maxLevel(가장 축소)
      const next = Math.round(minLevel + ratio * (maxLevel - minLevel));
      return Math.min(Math.max(next, minLevel), maxLevel);
    },
    [minLevel, maxLevel],
  );

  const emit = useCallback(
    (clientY: number) => {
      if (!onLevelChange) return;
      const next = computeLevelFromClientY(clientY);
      if (next === null) return;
      if (next === lastEmittedLevelRef.current) return;
      lastEmittedLevelRef.current = next;
      onLevelChange(next);
    },
    [onLevelChange, computeLevelFromClientY],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onLevelChange) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      lastEmittedLevelRef.current = safeLevel;
      emit(e.clientY);
    },
    [onLevelChange, emit, safeLevel],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onLevelChange) return;
      const target = e.currentTarget;
      if (!target.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      e.stopPropagation();
      emit(e.clientY);
    },
    [onLevelChange, emit],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.hasPointerCapture(e.pointerId)) {
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  const interactive = !!onLevelChange;

  // + 버튼: 레벨 1 감소(확대), − 버튼: 레벨 1 증가(축소)
  // 카카오맵 레벨 체계는 숫자가 작을수록 확대, 클수록 축소
  const handleZoomIn = useCallback(() => {
    if (!onLevelChange) return;
    if (safeLevel <= minLevel) return;
    const next = safeLevel - 1;
    lastEmittedLevelRef.current = next;
    onLevelChange(next);
  }, [onLevelChange, safeLevel, minLevel]);

  const handleZoomOut = useCallback(() => {
    if (!onLevelChange) return;
    if (safeLevel >= maxLevel) return;
    const next = safeLevel + 1;
    lastEmittedLevelRef.current = next;
    onLevelChange(next);
  }, [onLevelChange, safeLevel, maxLevel]);

  return (
    <div
      className={cn(
        'fixed right-4 z-[35] select-none',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
        className,
      )}
      style={style}
      aria-label={`지도 레벨 ${safeLevel}, ${markerVisible ? '마커 표시 중' : '마커 숨김 상태'}`}
    >
      <div className="flex h-[156px] w-9 flex-col items-center rounded-[17px] border border-white/70 bg-white/45 px-1 py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={!interactive || safeLevel <= minLevel}
          aria-label="확대"
          className={cn(
            'flex h-5 w-7 items-center justify-center rounded-md text-[14px] font-black leading-none text-slate-800',
            'transition-all active:scale-90 active:bg-slate-900/10',
            (!interactive || safeLevel <= minLevel) && 'opacity-40',
          )}
        >
          +
        </button>

        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            'relative my-1 h-[72px] w-5',
            interactive ? 'cursor-grab active:cursor-grabbing touch-none' : '',
          )}
          style={interactive ? { touchAction: 'none' } : undefined}
        >
          <div className="absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 overflow-hidden rounded-full bg-slate-200/80 pointer-events-none">
            <div
              className="absolute left-0 top-0 w-full bg-amber-400"
              style={{ height: `${hiddenStart}%` }}
            />
            <div
              className="absolute bottom-0 left-0 w-full bg-emerald-500"
              style={{ height: `${100 - hiddenStart}%` }}
            />
          </div>

          <div
            className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition-[top,background-color] duration-300 ease-out pointer-events-none"
            style={{
              top: `${progress}%`,
              backgroundColor: markerVisible ? '#f59e0b' : '#10b981',
            }}
          />

          <div
            className="absolute left-1/2 h-px w-3.5 -translate-x-1/2 bg-white/90 shadow-sm pointer-events-none"
            style={{ top: `${hiddenStart}%` }}
          />
        </div>

        <button
          type="button"
          onClick={handleZoomOut}
          disabled={!interactive || safeLevel >= maxLevel}
          aria-label="축소"
          className={cn(
            'flex h-5 w-7 items-center justify-center rounded-md text-[14px] font-black leading-none text-slate-700',
            'transition-all active:scale-90 active:bg-slate-900/10',
            (!interactive || safeLevel >= maxLevel) && 'opacity-40',
          )}
        >
          −
        </button>
        <div className="mt-0.5 text-[9px] font-black leading-none text-slate-600">{safeLevel}</div>
        <div
          className={cn(
            'mt-1 flex w-7 items-center justify-center whitespace-nowrap rounded-full border px-0.5 py-0.5 text-[7px] font-black leading-none tracking-[-0.12em] shadow-sm transition-colors duration-500 ease-out',
            markerVisible
              ? 'border-amber-200 bg-amber-50/95 text-amber-700'
              : 'border-emerald-200 bg-emerald-50/95 text-emerald-700',
          )}
        >
          {markerVisible ? '마커' : '히트맵'}
        </div>
      </div>
    </div>
  );
};

export default MapLevelIndicator;