import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';

// 지도 마커의 24시간 만료 룰과 일치해야 함 (MapContainer.tsx와 동기)
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
// 1분마다 갱신 (지도 마커의 카운트다운 링과 같은 주기)
const TICK_INTERVAL_MS = 60 * 1000;

// 알약 카운트다운 링 (지도 마커와 동일한 시각 룰)
// 12시 방향 상단 중앙에서 시작 → 시계 반대방향으로 한 바퀴 도는 path
const RING_HEIGHT = 36;            // 버튼 높이(h-9 = 36px)에 맞춤 — 초기값 용도
const RING_STROKE = 3;             // 지도 마커(4)와 시각적 무게감을 맞추기 위해 살짝 두껍게
const RING_TRACK_STROKE = 3;       // 트랙도 동일 두께(자연스러운 연속감)

// stroke의 바깥 경계가 버튼 외곽선과 정확히 일치하도록 stroke 두께의 절반만큼 안쪽으로 들임.
// → ring 전체가 박스 안에 완전히 들어와 버튼과 깔끔하게 hug됨.
// → 좌/우 반원 곡률은 (h - pad*2)/2 = (36-3)/2 = 16.5이 되어 살짝 작아지지만,
//   버튼의 border 안쪽에 ring이 깔리는 형태라 시각적으로 자연스럽다.
const RING_PADDING = 1.5;

// 카운트다운 링 컬러 (지도 마커와 통일)
// 남은 시간: 형광 라임/그린 톤으로 선명하게
// 지난 시간: 잘 보이도록 opacity를 충분히 올린 진한 초록
const RING_PROGRESS_COLOR = '#39FF14';            // 형광 네온 그린 — 남은 시간
const RING_TRACK_COLOR = 'rgba(34,197,94,0.55)';  // 진한 초록 (opacity 0.55) — 지난 시간 트랙
// 인디고 톤 버튼 배경(#eef2ff) 위에서도 네온이 또렷하게 보이도록 글로우를 살짝 강화
const RING_GLOW = '0 0 5px rgba(57,255,20,0.85)'; // 네온 발광

// 🐛 디버그: 버튼 위에 측정값/계산값/시각 가이드 오버레이를 띄움. 정렬 작업 완료 후 false로.
const RING_DEBUG = true;

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

  // 버튼 너비를 사전에 알 수 없으므로 ResizeObserver로 측정.
  const wrapRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: RING_HEIGHT });
  // 🐛 디버그용 raw 측정값
  const [debugInfo, setDebugInfo] = useState<{
    rawW: number; rawH: number;
    borderRadius: string; borderTopWidth: string;
    paddingLeft: string; paddingRight: string;
    backgroundColor: string;
  } | null>(null);

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
      if (RING_DEBUG) {
        const cs = window.getComputedStyle(el);
        setDebugInfo({
          rawW: r.width,
          rawH: r.height,
          borderRadius: cs.borderRadius,
          borderTopWidth: cs.borderTopWidth,
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          backgroundColor: cs.backgroundColor,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // path와 둘레 계산 (메모이즈)
  // 버튼이 알약 형태(border-radius: 9999)이므로 좌/우 끝은 완전한 반원.
  // → 반지름 r = 높이의 절반으로 두면 좌/우 변(V 직선)이 사라지고
  //    좌우 끝이 정확한 반원이 되어 알약 외곽선과 완벽히 일치한다.
  const { path, perimeter, geom } = useMemo(() => {
    if (size.w === 0) return { path: '', perimeter: 0, geom: null as null | {
      pad: number; w: number; h: number; r: number;
      left: number; right: number; top: number; bottom: number; cx: number;
    } };
    const pad = RING_PADDING;
    const w = size.w - pad * 2;
    const h = size.h - pad * 2;
    const r = h / 2;
    const left = pad;
    const right = pad + w;
    const top = pad;
    const bottom = pad + h;
    const cx = pad + w / 2;
    // 12시(상단 중앙) → 시계 반대방향, 좌/우 끝은 180° 반원
    const d = `M ${cx} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${right - r} A ${r} ${r} 0 0 0 ${right - r} ${top} Z`;
    const peri = 2 * (w - 2 * r) + 2 * Math.PI * r;
    return { path: d, perimeter: peri, geom: { pad, w, h, r, left, right, top, bottom, cx } };
  }, [size]);

  // 🐛 디버그: 콘솔에 측정값 / 계산값 출력
  useEffect(() => {
    if (!RING_DEBUG || !debugInfo || !geom) return;
    // border-radius computed value를 px 숫자로 추출 (가능한 경우)
    const brMatch = debugInfo.borderRadius.match(/^([\d.]+)px/);
    const buttonRadiusPx = brMatch ? Number(brMatch[1]) : NaN;
    // border-radius: 9999px인 경우 시각적 반지름은 size.h / 2
    const effectiveButtonRadius = Number.isFinite(buttonRadiusPx)
      ? Math.min(buttonRadiusPx, size.h / 2)
      : size.h / 2;
    console.log('[LocationButtonWithTimer] debug', {
      raw: { w: debugInfo.rawW, h: debugInfo.rawH },
      rounded: { w: size.w, h: size.h },
      computedStyle: debugInfo,
      ring: {
        RING_STROKE,
        RING_PADDING,
        pathRadius: geom.r,
        pathCenterTopY: geom.top, // path 중심선의 상단 y
        pathCenterBottomY: geom.bottom,
        leftArcCenterX: geom.left + geom.r,
        rightArcCenterX: geom.right - geom.r,
      },
      alignment: {
        effectiveButtonRadius,
        ringRadius: geom.r,
        radiusDelta: geom.r - effectiveButtonRadius, // 0이면 곡률 일치
        strokeOuterEdgeOffsetFromBox: RING_PADDING - RING_STROKE / 2, // 0이면 외곽선 위, 음수면 박스 밖
        strokeInnerEdgeOffsetFromBox: RING_PADDING + RING_STROKE / 2, // 박스 안쪽으로 들어오는 거리
      },
    });
  }, [debugInfo, geom, size.w, size.h]);

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
        // 인디고 배경 + 밝은 텍스트로 강조감 ↑
        backgroundColor: '#4f46e5',          // Tailwind indigo-600
        color: '#ffffff',
        border: '1px solid #4338ca',         // indigo-700 — 살짝 진한 테두리
        boxShadow: '0 1px 2px rgba(79,70,229,0.25)',
        isolation: 'isolate',
      };

  const iconColor = isExpired
    ? (variant === 'dark' ? 'rgba(255,255,255,0.45)' : '#9ca3af')
    : '#ffffff'; // light/dark 모두 밝은 텍스트/아이콘

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
          - path 중심선이 버튼 외곽선 위에 오도록 padding=0 + overflow:visible */}
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
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          {/* 진행 (남은 시간 — 연한 초록)
              linecap을 'butt'로 두어 dashoffset에 의해 잘린 끝점이
              둥글게 부풀어 곡률이 달라 보이는 시각적 착시를 방지 */}
          <path
            d={path}
            fill="none"
            stroke={RING_PROGRESS_COLOR}
            strokeWidth={RING_STROKE}
            strokeLinecap="butt"
            strokeLinejoin="round"
            strokeDasharray={perimeter.toFixed(2)}
            strokeDashoffset={dashOffset.toFixed(2)}
            style={{ filter: `drop-shadow(${RING_GLOW})` }}
          />

          {/* 🐛 디버그 시각 가이드 */}
          {RING_DEBUG && geom && (
            <g>
              {/* 1. 버튼 박스 외곽 (getBoundingClientRect) — 빨간 점선 */}
              <rect
                x={0}
                y={0}
                width={size.w}
                height={size.h}
                fill="none"
                stroke="red"
                strokeWidth={0.6}
                strokeDasharray="3 2"
              />
              {/* 2. ring path 중심선 (실제로 stroke가 그려지는 중심) — 파란 실선 */}
              <path
                d={path}
                fill="none"
                stroke="blue"
                strokeWidth={0.6}
                strokeOpacity={0.9}
              />
              {/* 3. stroke의 바깥 경계 (= 중심선에서 stroke/2 밖) — 시안 점선
                   버튼 외곽선과 이것이 일치해야 정렬 OK */}
              {/* 4. 좌/우 반원 중심점 — 빨간 점 */}
              <circle cx={geom.left + geom.r} cy={geom.top + geom.r} r={1.5} fill="red" />
              <circle cx={geom.right - geom.r} cy={geom.top + geom.r} r={1.5} fill="red" />
              {/* 5. path 시작점 (12시) — 노란 점 */}
              <circle cx={geom.cx} cy={geom.top} r={1.5} fill="yellow" stroke="black" strokeWidth={0.3} />
              {/* 6. 버튼 알약 추정 외곽선 (size.h/2 반지름 + 외곽선 위) — 오렌지 점선 */}
              <path
                d={`M ${size.w / 2} 0 H ${size.h / 2} A ${size.h / 2} ${size.h / 2} 0 0 0 ${size.h / 2} ${size.h} H ${size.w - size.h / 2} A ${size.h / 2} ${size.h / 2} 0 0 0 ${size.w - size.h / 2} 0 Z`}
                fill="none"
                stroke="orange"
                strokeWidth={0.6}
                strokeDasharray="2 2"
              />
            </g>
          )}
        </svg>
      )}

      {/* 🐛 디버그 텍스트 라벨 — 버튼 위에 측정값 표시 */}
      {RING_DEBUG && debugInfo && geom && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
          style={{
            bottom: '100%',
            marginBottom: 4,
            fontSize: 9,
            lineHeight: 1.25,
            fontFamily: 'monospace',
            color: '#111',
            background: 'rgba(255,255,255,0.97)',
            border: '1px solid #f43f5e',
            borderRadius: 4,
            padding: '3px 5px',
            zIndex: 99,
            textAlign: 'left',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 1 }}>📊 LocationButton ring</div>
          <div>raw: {debugInfo.rawW.toFixed(2)} × {debugInfo.rawH.toFixed(2)}</div>
          <div>round: {size.w} × {size.h}</div>
          <div>btn br: {debugInfo.borderRadius}</div>
          <div>btn bw: {debugInfo.borderTopWidth}</div>
          <div>btn pad: L{debugInfo.paddingLeft} R{debugInfo.paddingRight}</div>
          <div style={{ marginTop: 2, color: '#16a34a', fontWeight: 700 }}>—— ring ——</div>
          <div>pad: {RING_PADDING} · stroke: {RING_STROKE}</div>
          <div>ring r: {geom.r.toFixed(2)} (btn r expected: {(size.h / 2).toFixed(2)})</div>
          <div>arc cx L: {(geom.left + geom.r).toFixed(2)} R: {(geom.right - geom.r).toFixed(2)}</div>
          <div>stroke outer edge offset: {(RING_PADDING - RING_STROKE / 2).toFixed(2)}px</div>
          <div style={{ marginTop: 2, color: '#666' }}>
            🟥 box · 🟦 path · 🟧 expected btn outline
          </div>
        </div>
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
