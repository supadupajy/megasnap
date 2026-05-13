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
// → 좌/우 반원 중심점이 버튼 알약 반원 중심과 동일해져 동심 알약이 된다.
const RING_PADDING = RING_STROKE / 2;

// 카운트다운 링 컬러 (지도 마커와 통일)
// 남은 시간: 형광 라임/그린 톤으로 선명하게
// 지난 시간: 잘 보이도록 opacity를 충분히 올린 진한 초록
const RING_PROGRESS_COLOR = '#39FF14';            // 형광 네온 그린 — 남은 시간
const RING_TRACK_COLOR = 'rgba(34,197,94,0.55)';  // 진한 초록 (opacity 0.55) — 지난 시간 트랙
// 인디고 톤 버튼 배경(#eef2ff) 위에서도 네온이 또렷하게 보이도록 글로우를 살짝 강화
const RING_GLOW = '0 0 5px rgba(57,255,20,0.85)'; // 네온 발광

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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize(prev => {
        // 소수점 width(예: 81.32px)를 반올림하면 SVG가 실제 버튼보다 미세하게 작아져
        // 알약 외곽이 삐뚤어져 보인다. DOMRect의 raw 값을 그대로 사용한다.
        const nw = r.width;
        const nh = r.height;
        if (Math.abs(prev.w - nw) < 0.01 && Math.abs(prev.h - nh) < 0.01) return prev;
        return { w: nw, h: nh };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 알약 링은 SVG path로 직접 그려 시작점을 버튼의 12시 방향(상단 중앙)에 고정한다.
  // rect stroke는 브라우저마다 stroke 시작점이 코너 쪽으로 잡힐 수 있어 위치보기 버튼에서는 사용하지 않는다.
  const rectGeom = useMemo(() => {
    if (size.w === 0) return null;
    const pad = RING_PADDING;
    const w = size.w - pad * 2;
    const h = size.h - pad * 2;
    const r = h / 2;
    const startX = pad + w / 2;
    const topY = pad;
    const bottomY = pad + h;
    const leftX = pad;
    const rightX = pad + w;
    const leftCenterX = pad + r;
    const rightCenterX = pad + w - r;
    // 알약 둘레 = 상·하 직선 + 좌·우 반원(= 원 1개)
    const peri = 2 * (w - 2 * r) + 2 * Math.PI * r;
    const pathD = [
      `M ${startX} ${topY}`,
      `H ${rightCenterX}`,
      `A ${r} ${r} 0 0 1 ${rightCenterX} ${bottomY}`,
      `H ${leftCenterX}`,
      `A ${r} ${r} 0 0 1 ${leftCenterX} ${topY}`,
      `H ${startX}`,
    ].join(' ');

    return { x: pad, y: pad, w, h, r, startX, topY, bottomY, leftX, rightX, leftCenterX, rightCenterX, perimeter: peri, pathD };
  }, [size]);

  const perimeter = rectGeom?.perimeter ?? 0;

  const dashOffset = perimeter * (1 - remainingRatio);

  // 남은 stroke의 끝점 좌표. 이 위치에 작은 반짝임을 표시해
  // 타이머가 줄어드는 지점을 직관적으로 보여준다.
  const sparkPoint = useMemo(() => {
    if (!rectGeom || perimeter <= 0) return null;

    const topRightLine = rectGeom.rightCenterX - rectGeom.startX;
    const bottomLine = rectGeom.w - 2 * rectGeom.r;
    const topLeftLine = rectGeom.startX - rectGeom.leftCenterX;
    const arc = Math.PI * rectGeom.r;
    let d = (perimeter * remainingRatio) % perimeter;

    // 12시 상단 중앙 → 우상단 접점
    if (d <= topRightLine) {
      return { x: rectGeom.startX + d, y: rectGeom.topY };
    }
    d -= topRightLine;

    // 우측 반원: 위 → 아래
    if (d <= arc) {
      const t = d / arc;
      const angle = -Math.PI / 2 + Math.PI * t;
      const cx = rectGeom.rightCenterX;
      const cy = rectGeom.y + rectGeom.r;
      return {
        x: cx + rectGeom.r * Math.cos(angle),
        y: cy + rectGeom.r * Math.sin(angle),
      };
    }
    d -= arc;

    // 하단 직선: 우하단 접점 → 좌하단 접점
    if (d <= bottomLine) {
      return { x: rectGeom.rightCenterX - d, y: rectGeom.bottomY };
    }
    d -= bottomLine;

    // 좌측 반원: 아래 → 위
    if (d <= arc) {
      const t = d / arc;
      const angle = Math.PI / 2 + Math.PI * t;
      const cx = rectGeom.leftCenterX;
      const cy = rectGeom.y + rectGeom.r;
      return {
        x: cx + rectGeom.r * Math.cos(angle),
        y: cy + rectGeom.r * Math.sin(angle),
      };
    }
    d -= arc;

    // 좌상단 접점 → 12시 상단 중앙
    return { x: rectGeom.leftCenterX + Math.min(d, topLeftLine), y: rectGeom.topY };
  }, [rectGeom, perimeter, remainingRatio]);

  // 스타일 분기
  // - 만료: 회색 + disabled
  // - 활성: 인디고 배경 + 흰색 텍스트(라이트) / 흰색-반투명(다크)
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
        // dark variant도 타이머 stroke가 유일한 외곽선이 되도록 border 제거
        // → 실시간 인기/플릭스의 어두운 배경 버튼에서도 ring이 바깥으로 튀어나와 보이지 않음
        backgroundColor: 'rgba(255,255,255,0.10)',
        color: '#ffffff',
        border: '0 solid transparent',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        isolation: 'isolate',
      }
    : {
        // 활성화된 위치 버튼처럼 보이도록 아주 연한 초록 배경 사용
        // 타이머 stroke가 유일한 외곽선 역할을 하므로 별도 border는 제거
        backgroundColor: '#dcfce7',          // green-100 — 초록 기운이 더 잘 보이는 연한 배경
        color: '#4b5563',                    // gray-600
        border: '0 solid transparent',
        boxShadow: '0 1px 3px rgba(34,197,94,0.18)',
        isolation: 'isolate',
      };

  const iconColor = isExpired
    ? (variant === 'dark' ? 'rgba(255,255,255,0.45)' : '#9ca3af')
    : (variant === 'dark' ? '#ffffff' : '#4b5563');

  const textColor = iconColor;
  const label = isExpired ? '위치없음' : '위치보기';

  // 링은 광고/만료/createdAt 없음에서는 표시하지 않음
  const showRing = isExpirable && !isExpired && rectGeom !== null;

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
          - 트랙(지난 시간): 진한 초록 stroke로 전체 둘레를 깔아둠
          - 진행(남은 시간): 그 위에 형광 네온 stroke를 dashoffset으로 보여줌
          - stroke의 바깥 경계가 버튼 외곽선과 정확히 align되도록 padding = stroke/2 */}
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
          {/* 트랙 (지난 시간 — 진한 초록) */}
          {rectGeom && (
            <path
              d={rectGeom.pathD}
              fill="none"
              stroke={RING_TRACK_COLOR}
              strokeWidth={RING_TRACK_STROKE}
            />
          )}
          {/* 진행 (남은 시간 — 형광 네온 그린): path 시작점이 항상 12시 방향 */}
          {rectGeom && (
            <path
              d={rectGeom.pathD}
              fill="none"
              stroke={RING_PROGRESS_COLOR}
              strokeWidth={RING_STROKE}
              strokeLinecap="butt"
              strokeDasharray={perimeter.toFixed(2)}
              strokeDashoffset={dashOffset.toFixed(2)}
              style={{ filter: `drop-shadow(${RING_GLOW})` }}
            />
          )}

          {/* 남은 시간 경계점 반짝임 */}
          {sparkPoint && remainingRatio > 0.01 && remainingRatio < 0.995 && (
            <g style={{ filter: 'drop-shadow(0 0 5px rgba(57,255,20,0.95))' }}>
              <circle
                cx={sparkPoint.x}
                cy={sparkPoint.y}
                r="5"
                fill="rgba(57,255,20,0.22)"
              >
                <animate attributeName="r" values="3;6;3" dur="1.15s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.75;0.25" dur="1.15s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={sparkPoint.x}
                cy={sparkPoint.y}
                r="2.1"
                fill="#ecfccb"
                stroke="#39FF14"
                strokeWidth="1"
              >
                <animate attributeName="opacity" values="1;0.45;1" dur="0.75s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
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
