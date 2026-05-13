import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';

// 지도 마커의 24시간 만료 룰과 일치해야 함 (MapContainer.tsx와 동기)
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
// 1분마다 갱신 (지도 마커의 카운트다운 링과 같은 주기)
const TICK_INTERVAL_MS = 60 * 1000;

// 둥근 사각 카운트다운 링 (지도 마커와 동일한 시각 룰)
// 12시 방향 상단 중앙에서 시작 → 시계 반대방향으로 한 바퀴 도는 path
const RING_PADDING = 2;            // 버튼 외곽에서 안쪽으로 들이는 픽셀
const RING_VIEWBOX = 100;          // 비율 기반 (가로/세로 비율이 달라도 stretch)
const RING_HEIGHT = 36;            // 버튼 높이(h-9 = 36px)에 맞춤
const RING_STROKE = 3;             // 버튼은 마커보다 작아서 살짝 얇게
const RING_CORNER = 18;            // 알약 형태 (h-9 → border-radius:9999 → 코너 r = h/2 = 18)

interface LocationButtonWithTimerProps {
  createdAt?: Date | string | number | null;
  /** 광고는 만료 룰 적용 안 함 */
  isAd?: boolean;
  /** 만료/경과 정보를 무시하고 항상 활성 (lat/lng 자체가 없는 경우는 별도 처리, 여기는 표시되는 경우만 사용) */
  forceActive?: boolean;
  onClick: (e: React.MouseEvent) => void;
  /** light: 일반 페이지(흰 배경), dark: Reels 등 어두운 배경 */
  variant?: 'light' | 'dark';
}

/**
 * 24h 카운트다운 링이 있는 "위치보기" 버튼.
 * - 24h 경과 시: 회색 + "위치없음" + disabled
 * - 광고(`isAd`)는 만료 룰 적용 안 됨
 * - 광고이거나 createdAt이 없으면 링도 표시하지 않음
 */
const LocationButtonWithTimer: React.FC<LocationButtonWithTimerProps> = ({
  createdAt,
  isAd = false,
  forceActive = false,
  onClick,
  variant = 'light',
}) => {
  // createdAt → ms 변환
  const createdMs = useMemo(() => {
    if (createdAt == null) return null;
    if (createdAt instanceof Date) return createdAt.getTime();
    const t = new Date(createdAt).getTime();
    return Number.isFinite(t) ? t : null;
  }, [createdAt]);

  // 만료 룰이 적용되는지 (광고/광고대기 X, 시간 정보 있음)
  const isExpirable = !isAd && createdMs !== null && !forceActive;

  // 현재 시간 (1분마다 tick)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isExpirable) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isExpirable]);

  const elapsed = isExpirable ? now - (createdMs as number) : 0;
  const isExpired = isExpirable && elapsed >= MARKER_LIFESPAN_MS;
  const remainingRatio = isExpirable
    ? Math.max(0, 1 - elapsed / MARKER_LIFESPAN_MS)
    : 1;

  // 사각 둥근 path (12시 → 반시계 방향)를 동적으로 계산 (버튼 비율에 맞춤)
  // 단순화를 위해 viewBox=preserveAspectRatio="none"으로 늘리지 않고,
  // 비율 보존하면서도 stroke가 자연스럽도록 실제 픽셀 좌표 기반 path 사용.
  // 단, 버튼 너비를 사전에 알 수 없으므로 ResizeObserver로 측정.
  const wrapRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: RING_HEIGHT });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize(prev => {
        const nw = Math.round(r.width);
        const nh = Math.round(r.height);
        if (prev.w === nw && prev.h === nh) return prev;
        return { w: nw, h: nh };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // path와 둘레 계산 (메모이즈)
  const { path, perimeter } = useMemo(() => {
    if (size.w === 0) return { path: '', perimeter: 0 };
    const pad = RING_PADDING;
    const w = size.w - pad * 2;
    const h = size.h - pad * 2;
    // 코너 반지름은 높이의 절반 (알약 형태) — 단, 너비/높이 한쪽보다 크면 안 됨
    const r = Math.min(RING_CORNER - pad, h / 2, w / 2);
    const left = pad;
    const right = pad + w;
    const top = pad;
    const bottom = pad + h;
    const cx = pad + w / 2;
    // 12시(상단 중앙) → 시계 반대방향
    const d = `M ${cx} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left} ${top + r} V ${bottom - r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${right - r} A ${r} ${r} 0 0 0 ${right} ${bottom - r} V ${top + r} A ${r} ${r} 0 0 0 ${right - r} ${top} Z`;
    // 둘레 길이: 직선 4개 + 90°*4 호(=원 1개)
    const peri = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
    return { path: d, perimeter: peri };
  }, [size]);

  const dashOffset = -(perimeter * (1 - remainingRatio));

  // 스타일 분기
  // - 만료: 회색 + disabled
  // - 활성: 기존 인디고(라이트) / 흰색-반투명(다크)
  const baseStyle: React.CSSProperties = isExpired
    ? {
        backgroundColor: variant === 'dark' ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
        color: variant === 'dark' ? 'rgba(255,255,255,0.45)' : '#9ca3af',
        border: variant === 'dark'
          ? '1px solid rgba(255,255,255,0.10)'
          : '1px solid #e5e7eb',
        cursor: 'not-allowed',
        isolation: 'isolate',
      }
    : variant === 'dark'
    ? {
        backgroundColor: 'rgba(255,255,255,0.10)',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.20)',
        backdropFilter: 'blur(6px)',
        isolation: 'isolate',
      }
    : {
        backgroundColor: '#eef2ff',
        color: '#4f46e5',
        border: '1px solid #c7d2fe',
        isolation: 'isolate',
      };

  const iconColor = isExpired
    ? (variant === 'dark' ? 'rgba(255,255,255,0.45)' : '#9ca3af')
    : (variant === 'dark' ? '#ffffff' : '#4f46e5');

  const textColor = iconColor;
  const label = isExpired ? '위치만료' : '위치보기';

  // 링은 광고/만료/createdAt 없음에서는 표시하지 않음
  const showRing = isExpirable && !isExpired && path.length > 0;

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={(e) => {
        if (isExpired) {
          e.stopPropagation();
          return;
        }
        onClick(e);
      }}
      disabled={isExpired}
      aria-disabled={isExpired}
      aria-label={label}
      className="relative inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-full transition-all shrink-0 whitespace-nowrap active:scale-95 disabled:active:scale-100"
      style={baseStyle}
    >
      {/* 카운트다운 링 (만료 전에만 표시) */}
      {showRing && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 1,
          }}
        >
          <path
            d={path}
            fill="none"
            stroke="rgba(57,255,20,0.5)"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={perimeter.toFixed(2)}
            strokeDashoffset={dashOffset.toFixed(2)}
            style={{ filter: 'drop-shadow(0 0 3px rgba(57,255,20,0.55))' }}
          />
        </svg>
      )}

      <Navigation
        className="w-3.5 h-3.5 relative"
        style={{ fill: iconColor, color: iconColor, flexShrink: 0, zIndex: 2 }}
      />
      <span
        className="relative"
        style={{ fontSize: '10px', fontWeight: 900, color: textColor, lineHeight: 1, zIndex: 2 }}
      >
        {label}
      </span>
    </button>
  );
};

export default LocationButtonWithTimer;
