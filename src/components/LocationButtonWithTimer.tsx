import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';

// 지도 마커의 24시간 만료 룰과 일치해야 함 (MapContainer.tsx와 동기)
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
// 1분마다 갱신 (지도 마커의 카운트다운 링과 같은 주기)
const TICK_INTERVAL_MS = 60 * 1000;

// ── 카운트다운 링 (알약 외부) ───────────────────────────────────────────────
// 알약 버튼을 감싸는 형태로, 버튼 가장자리에서 일정 픽셀만큼 바깥에 그려진다.
const RING_OUTSET = 4;   // 버튼 가장자리에서 바깥으로 벌어지는 픽셀 (외부 링)
const RING_STROKE = 2.5; // 링 두께

// ── 색상 팔레트 (스크린샷 기반 초록 톤) ──────────────────────────────────────
const COLOR = {
  // 알약 버튼
  pillBg: '#2D5F3F',          // 진한 숲 초록 (배경)
  pillFg: '#A8E0B5',          // 연한 잎새 초록 (텍스트/아이콘)
  pillBorder: 'rgba(168,224,181,0.35)',
  // 외부 카운트다운 링
  ringTrack: '#D8F1DE',       // 아주 옅은 초록 (지나간 시간)
  ringActive: '#5BC078',      // 진한 잎새 초록 (남은 시간)
  // 어두운 배경(Reels)에서의 트랙 — 너무 밝으면 튀므로 살짝 톤다운
  ringTrackDark: 'rgba(216,241,222,0.35)',
  // 만료 상태
  expiredBgLight: '#f3f4f6',
  expiredFgLight: '#9ca3af',
  expiredBorderLight: '#e5e7eb',
  expiredBgDark: 'rgba(255,255,255,0.06)',
  expiredFgDark: 'rgba(255,255,255,0.45)',
  expiredBorderDark: 'rgba(255,255,255,0.10)',
};

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
 * 24h 카운트다운 링이 알약 외부에 둘러진 "위치보기" 버튼.
 *
 * - 알약 자체: 진한 초록 배경 + 연한 초록 텍스트
 * - 외부 링: 트랙(옅은 초록, 지나간 시간) + 진행(진한 초록, 남은 시간)
 * - 24h 경과 시: 회색 알약 + "위치없음" + disabled (링 제거)
 * - 광고(`isAd`)는 만료 룰 적용 안 됨 (링도 표시 X)
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

  // 만료 룰이 적용되는지 (광고 X, 시간 정보 있음)
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

  // 버튼 실제 크기 측정 → 외부 링의 path 계산에 사용
  const wrapRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 36 });

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

  // 외부 링 path: 버튼 사방으로 RING_OUTSET 만큼 벌어진 알약 윤곽
  // 시작점은 12시 방향(상단 중앙), 시계 반대방향 1회전.
  const { path, perimeter, svgW, svgH, svgOffset } = useMemo(() => {
    if (size.w === 0) {
      return { path: '', perimeter: 0, svgW: 0, svgH: 0, svgOffset: 0 };
    }
    // 링이 그려질 사각형 영역 (버튼보다 outset만큼 큰 알약)
    const w = size.w + RING_OUTSET * 2;
    const h = size.h + RING_OUTSET * 2;
    const r = Math.min(h / 2, w / 2); // 알약: 코너 = height/2
    // SVG 자체는 stroke가 잘리지 않게 stroke 두께만큼 더 확보
    const padForStroke = Math.ceil(RING_STROKE / 2) + 1;
    const svgW = w + padForStroke * 2;
    const svgH = h + padForStroke * 2;

    const left = padForStroke;
    const right = padForStroke + w;
    const top = padForStroke;
    const bottom = padForStroke + h;
    const cx = padForStroke + w / 2;

    // 12시(상단 중앙) → 시계 반대방향
    const d = `M ${cx} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left} ${top + r} V ${bottom - r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${right - r} A ${r} ${r} 0 0 0 ${right} ${bottom - r} V ${top + r} A ${r} ${r} 0 0 0 ${right - r} ${top} Z`;
    // 둘레 = 직선 4개 + 원 1개
    const peri = 2 * Math.max(0, w - 2 * r) + 2 * Math.max(0, h - 2 * r) + 2 * Math.PI * r;
    return { path: d, perimeter: peri, svgW, svgH, svgOffset: padForStroke + RING_OUTSET };
  }, [size]);

  const dashOffset = -(perimeter * (1 - remainingRatio));

  // 스타일 분기
  // - 만료: 회색 + disabled
  // - 활성: 진한 초록(공통) — variant는 외부 링 트랙 색에만 영향
  const baseStyle: React.CSSProperties = isExpired
    ? {
        backgroundColor: variant === 'dark' ? COLOR.expiredBgDark : COLOR.expiredBgLight,
        color: variant === 'dark' ? COLOR.expiredFgDark : COLOR.expiredFgLight,
        border: `1px solid ${variant === 'dark' ? COLOR.expiredBorderDark : COLOR.expiredBorderLight}`,
        cursor: 'not-allowed',
        isolation: 'isolate',
      }
    : {
        backgroundColor: COLOR.pillBg,
        color: COLOR.pillFg,
        border: `1px solid ${COLOR.pillBorder}`,
        isolation: 'isolate',
      };

  const iconColor = isExpired
    ? (variant === 'dark' ? COLOR.expiredFgDark : COLOR.expiredFgLight)
    : COLOR.pillFg;
  const textColor = iconColor;
  const label = isExpired ? '위치만료' : '위치보기';

  // 링은 광고/만료/createdAt 없음에서는 표시하지 않음
  const showRing = isExpirable && !isExpired && path.length > 0;
  const trackColor = variant === 'dark' ? COLOR.ringTrackDark : COLOR.ringTrack;

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
      {/* 카운트다운 링 — 알약 외부에 표시 (버튼보다 약간 크게 absolute로 띄움) */}
      {showRing && (
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{
            position: 'absolute',
            // 버튼 중앙을 기준으로 svg가 사방으로 svgOffset 만큼 더 큰 상태
            top: -svgOffset,
            left: -svgOffset,
            width: `calc(100% + ${svgOffset * 2}px)`,
            height: `calc(100% + ${svgOffset * 2}px)`,
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 0,
          }}
        >
          {/* 트랙 (지나간 시간 = 옅은 초록) — 항상 전체 둘레 */}
          <path
            d={path}
            fill="none"
            stroke={trackColor}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 진행 (남은 시간 = 진한 초록) — 12시에서 반시계방향으로 줄어듦 */}
          <path
            d={path}
            fill="none"
            stroke={COLOR.ringActive}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={perimeter.toFixed(2)}
            strokeDashoffset={dashOffset.toFixed(2)}
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
