import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';

// 지도 마커의 24시간 만료 룰과 일치해야 함 (MapContainer.tsx와 동기)
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
// 1분마다 갱신 (지도 마커의 카운트다운 링과 같은 주기)
const TICK_INTERVAL_MS = 60 * 1000;

// 둥근 사각 카운트다운 링 (지도 마커와 동일한 시각 룰)
// 12시 방향 상단 중앙에서 시작 → 시계 반대방향으로 한 바퀴 도는 path
const RING_HEIGHT = 36;            // 버튼 높이(h-9 = 36px)에 맞춤 — 초기값 용도
const RING_STROKE = 2.5;           // 깔끔하고 세련된 두께
const RING_TRACK_STROKE = 2.5;     // 트랙도 동일 두께(자연스러운 연속감)
// path 중심선이 박스 가장자리에서 정확히 stroke의 절반만큼 안쪽에 위치하도록 함.
// 이렇게 하면 stroke의 바깥 경계가 박스(=버튼) 외곽선과 정확히 일치하여
// 알약 좌/우 끝이 버튼 바깥으로 떠 보이는 현상이 사라진다.
const RING_PADDING = RING_STROKE / 2;

// 카운트다운 링 컬러 (지도 마커와 통일)
const RING_PROGRESS_COLOR = '#16a34a';            // 진한 초록 (Tailwind green-600) — 남은 시간
const RING_TRACK_COLOR = 'rgba(34,197,94,0.22)';  // 연한 초록 — 지난 시간 트랙
const RING_GLOW = '0 0 4px rgba(22,163,74,0.55)'; // 부드러운 발광

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
  // 버튼이 알약 형태(border-radius: 9999)이므로 좌/우 끝은 완전한 반원이어야 함.
  // → 반지름 r = (높이 - padding*2) / 2로 두면 좌/우 변(V 직선)이 사라지고
  //    좌우 끝이 정확한 반원이 되어 알약 외곽선과 완벽히 일치한다.
  const { path, perimeter } = useMemo(() => {
    if (size.w === 0) return { path: '', perimeter: 0 };
    const pad = RING_PADDING;
    const w = size.w - pad * 2;
    const h = size.h - pad * 2;
    // 알약 형태: 반지름 = 높이의 절반 (좌/우 끝이 완전한 반원)
    const r = h / 2;
    const left = pad;
    const right = pad + w;
    const top = pad;
    const bottom = pad + h;
    const cx = pad + w / 2;
    // 12시(상단 중앙) → 시계 반대방향
    // 좌/우 끝의 V(수직 직선) 명령을 제거 — 반원만 그리면 됨.
    // M cx,top                                     상단 중앙에서 시작
    // H left + r                                    상단을 왼쪽으로 (직선)
    // A r,r 0 0 0 left + r,bottom (sweep=0, large=0) 좌측 반원 (반시계, 12시→6시 방향)
    //                                              ↑ x좌표 동일, y만 +h → 180도 호
    // H right - r                                   하단을 오른쪽으로 (직선)
    // A r,r 0 0 0 right - r,top                     우측 반원 (반시계, 6시→12시 방향)
    // Z                                             닫기
    const d = `M ${cx} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${right - r} A ${r} ${r} 0 0 0 ${right - r} ${top} Z`;
    // 둘레 길이: 상단 직선 + 좌측 반원 + 하단 직선 + 우측 반원
    //          = 2 * (w - 2r) + 2 * (π * r)
    //          = 2 * (w - 2r) + 2πr
    const peri = 2 * (w - 2 * r) + 2 * Math.PI * r;
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
  const label = isExpired ? '위치없음' : '위치보기';

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
      {/* 카운트다운 링 (만료 전에만 표시)
          - 트랙(지난 시간): 연한 초록 stroke로 전체 둘레를 깔아둠
          - 진행(남은 시간): 그 위에 진한 초록 stroke를 dashoffset으로 보여줌
          - stroke의 바깥 경계가 버튼 외곽선과 정확히 일치하도록 padding/viewBox 정렬 */}
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
          {/* 트랙 (지난 시간 — 연한 초록) */}
          <path
            d={path}
            fill="none"
            stroke={RING_TRACK_COLOR}
            strokeWidth={RING_TRACK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 진행 (남은 시간 — 진한 초록) */}
          <path
            d={path}
            fill="none"
            stroke={RING_PROGRESS_COLOR}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={perimeter.toFixed(2)}
            strokeDashoffset={dashOffset.toFixed(2)}
            style={{ filter: `drop-shadow(${RING_GLOW})` }}
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
