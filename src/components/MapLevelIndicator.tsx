import React from 'react';
import { cn } from '@/lib/utils';

interface MapLevelIndicatorProps {
  level: number;
  minLevel?: number;
  maxLevel?: number;
  markerHiddenFrom?: number;
  className?: string;
  style?: React.CSSProperties;
}

const MapLevelIndicator = ({
  level,
  minLevel = 3,
  maxLevel = 11,
  markerHiddenFrom = 7,
  className,
  style,
}: MapLevelIndicatorProps) => {
  const safeLevel = Math.min(Math.max(Math.round(level), minLevel), maxLevel);
  const markerVisible = safeLevel < markerHiddenFrom;
  const progress = ((safeLevel - minLevel) / (maxLevel - minLevel)) * 100;
  const hiddenStart = ((markerHiddenFrom - minLevel) / (maxLevel - minLevel)) * 100;

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-4 z-[35] select-none',
        className,
      )}
      style={style}
      aria-label={`지도 레벨 ${safeLevel}, ${markerVisible ? '마커 표시 중' : '마커 숨김 상태'}`}
    >
      <div className="flex w-10 flex-col items-center rounded-[18px] border border-white/70 bg-white/45 px-1 py-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <div className="text-[13px] font-black leading-none text-slate-800">+</div>

        <div className="relative my-1.5 h-[84px] w-4">
          <div className="absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="absolute left-0 top-0 w-full bg-emerald-500"
              style={{ height: `${hiddenStart}%` }}
            />
            <div
              className="absolute bottom-0 left-0 w-full bg-rose-400"
              style={{ height: `${100 - hiddenStart}%` }}
            />
          </div>

          <div
            className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition-[top,background-color] duration-200"
            style={{
              top: `${progress}%`,
              backgroundColor: markerVisible ? '#10b981' : '#fb7185',
            }}
          />

          <div
            className="absolute left-1/2 h-px w-3.5 -translate-x-1/2 bg-white/90 shadow-sm"
            style={{ top: `${hiddenStart}%` }}
          />
        </div>

        <div className="text-[13px] font-black leading-none text-slate-700">−</div>
        <div className="mt-1 text-[10px] font-black leading-none text-slate-600">{safeLevel}</div>
        <div
          className={cn(
            'mt-1.5 flex w-8 items-center justify-center whitespace-nowrap rounded-full border px-0.5 py-1 text-[7px] font-black leading-none tracking-[-0.12em] shadow-sm',
            markerVisible
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
              : 'border-rose-200 bg-rose-50/95 text-rose-700',
          )}
        >
          {markerVisible ? '마커' : '히트맵'}
        </div>
      </div>
    </div>
  );
};

export default MapLevelIndicator;