import React, { useEffect, useRef, useState } from 'react';
import { DirectionCounts } from '@/hooks/use-supabase-posts';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

export type Direction = 'top' | 'bottom' | 'left' | 'right';

interface OffScreenMarkerIndicatorProps {
  bounds: Bounds | null;
  onClickDirection: (dir: Direction, pts: { lat: number; lng: number }[]) => void;
  topOffset?: string | number;
  bottomOffset: number;
  dbCounts?: DirectionCounts | null;
}

interface IndicatorState {
  dir: Direction;
  angleDeg: number;
  count: number;
  pts: { lat: number; lng: number }[];
  left: number;
  top: number;
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

const S = 52;
const EDGE_MARGIN = 14;

const avg = (pts: { lat: number; lng: number }[], axis: 'lat' | 'lng', fallback: number) =>
  pts.length > 0 ? pts.reduce((s, p) => s + p[axis], 0) / pts.length : fallback;

// 계산 로직만 분리 (순수 함수)
function computeIndicators(
  allPoints: { lat: number; lng: number }[],
  centerLat: number, centerLng: number,
  latRange: number, lngRange: number,
  screenW: number, screenH: number,
  topSafeY: number, bottomSafeY: number,
): IndicatorState[] {
  const midX = screenW / 2;
  const midY = (topSafeY + (screenH - bottomSafeY)) / 2;

  const toScreenX = (lng: number) => ((lng - centerLng) / lngRange) * screenW + midX;
  const toScreenY = (lat: number) => (-(lat - centerLat) / latRange) * screenH + screenH / 2;

  const positions: Record<Direction, { left: number; top: number }> = {
    top:    { left: midX - S / 2, top: topSafeY },
    bottom: { left: midX - S / 2, top: screenH - bottomSafeY - S },
    left:   { left: EDGE_MARGIN,  top: midY - S / 2 },
    right:  { left: screenW - EDGE_MARGIN - S, top: midY - S / 2 },
  };

  const indCenter: Record<Direction, { x: number; y: number }> = {
    top:    { x: midX, y: topSafeY + S / 2 },
    bottom: { x: midX, y: screenH - bottomSafeY - S / 2 },
    left:   { x: EDGE_MARGIN + S / 2, y: midY },
    right:  { x: screenW - EDGE_MARGIN - S / 2, y: midY },
  };

  const classified: Record<Direction, { lat: number; lng: number }[]> = {
    top: [], bottom: [], left: [], right: [],
  };

  const angleFromFront = (px: number, py: number, indX: number, indY: number, dir: Direction): number => {
    const dx = px - indX;
    const dy = py - indY;
    const frontVec = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const dot = dx * frontVec[0] + dy * frontVec[1];
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
  };

  for (const p of allPoints) {
    const px = toScreenX(p.lng);
    const py = toScreenY(p.lat);
    const scores: Record<Direction, number> = {
      top:    angleFromFront(px, py, indCenter.top.x,    indCenter.top.y,    'top'),
      bottom: angleFromFront(px, py, indCenter.bottom.x, indCenter.bottom.y, 'bottom'),
      left:   angleFromFront(px, py, indCenter.left.x,   indCenter.left.y,   'left'),
      right:  angleFromFront(px, py, indCenter.right.x,  indCenter.right.y,  'right'),
    };
    const candidates = (Object.keys(scores) as Direction[]).filter(d => scores[d] <= 45);
    const bestDir = candidates.length > 0
      ? candidates.reduce((a, b) => scores[a] < scores[b] ? a : b)
      : (Object.keys(scores) as Direction[]).reduce((a, b) => scores[a] < scores[b] ? a : b);
    classified[bestDir].push(p);
  }

  // 병합: 물방울 각도 차이 < 45도인 인디케이터끼리 합침
  const getAngleDeg = (dir: Direction, pts: { lat: number; lng: number }[]): number | null => {
    if (pts.length === 0) return null;
    const ind = indCenter[dir];
    const mX = toScreenX(avg(pts, 'lng', centerLng));
    const mY = toScreenY(avg(pts, 'lat', centerLat));
    return (Math.atan2(mX - ind.x, -(mY - ind.y)) * 180) / Math.PI;
  };
  const angleDiff = (a: number, b: number) => {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  const merged = { ...classified };
  for (let iter = 0; iter < 3; iter++) {
    let didMerge = false;
    const active = (['top', 'bottom', 'left', 'right'] as Direction[]).filter(d => merged[d].length > 0);
    for (let i = 0; i < active.length && !didMerge; i++) {
      for (let j = i + 1; j < active.length && !didMerge; j++) {
        const [dA, dB] = [active[i], active[j]];
        const angA = getAngleDeg(dA, merged[dA]);
        const angB = getAngleDeg(dB, merged[dB]);
        if (angA === null || angB === null) continue;
        if (angleDiff(angA, angB) < 45) {
          const winner = merged[dA].length >= merged[dB].length ? dA : dB;
          const loser  = winner === dA ? dB : dA;
          merged[winner] = [...merged[winner], ...merged[loser]];
          merged[loser] = [];
          didMerge = true;
        }
      }
    }
    if (!didMerge) break;
  }

  return (['top', 'bottom', 'left', 'right'] as Direction[])
    .filter(dir => merged[dir].length > 0)
    .map(dir => {
      const pts = merged[dir];
      const ind = indCenter[dir];
      const mX = toScreenX(avg(pts, 'lng', centerLng));
      const mY = toScreenY(avg(pts, 'lat', centerLat));
      const angleDeg = (Math.atan2(mX - ind.x, -(mY - ind.y)) * 180) / Math.PI;
      return {
        dir,
        angleDeg,
        count: pts.length,
        pts,
        left: positions[dir].left,
        top: positions[dir].top,
      };
    });
}

// 개별 인디케이터 — 마운트/언마운트/각도 변경 애니메이션
const DropIndicator: React.FC<{
  state: IndicatorState;
  onClickDirection: (dir: Direction, pts: { lat: number; lng: number }[]) => void;
}> = ({ state, onClickDirection }) => {
  const { dir, angleDeg, count, pts, left, top } = state;

  // 등장/사라짐: opacity + scale
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // 각도 변화: CSS transition으로 부드럽게
  const prevAngleRef = useRef(angleDeg);
  const [displayAngle, setDisplayAngle] = useState(angleDeg);
  useEffect(() => {
    // 최단 경로 회전 (예: 350° → 10° = +20°, not -340°)
    let delta = angleDeg - prevAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    prevAngleRef.current = prevAngleRef.current + delta;
    setDisplayAngle(prevAngleRef.current);
  }, [angleDeg]);

  const cx = S / 2;
  const circleCy = S / 2 + 6;
  const r = 15;
  const tipY = 3;
  const dropPath = [
    `M ${cx} ${tipY}`,
    `C ${cx - 9} ${tipY + 12}, ${cx - r} ${circleCy - r * 0.55}, ${cx - r} ${circleCy}`,
    `A ${r} ${r} 0 1 0 ${cx + r} ${circleCy}`,
    `C ${cx + r} ${circleCy - r * 0.55}, ${cx + 9} ${tipY + 12}, ${cx} ${tipY}`,
    'Z',
  ].join(' ');

  const label = count > 999 ? '999+' : String(count);
  const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

  return (
    <button
      onClick={() => onClickDirection(dir, pts)}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        zIndex: 9000,
        pointerEvents: 'auto',
        width: `${S}px`,
        height: `${S}px`,
        left: `${left}px`,
        top: `${top}px`,
        // 등장/사라짐: opacity + scale
        opacity: visible ? 1 : 0,
        transform: `scale(${visible ? 1 : 0.5}) rotate(${displayAngle}deg)`,
        transformOrigin: `${cx}px ${S / 2}px`,
        // 각도 변화는 transform transition으로
        transition: 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.20)) drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
      }}
    >
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <clipPath id={`drop-clip-${dir}`}>
            <path d={dropPath} />
          </clipPath>
        </defs>
        <foreignObject x="0" y="0" width={S} height={S} clipPath={`url(#drop-clip-${dir})`}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          />
        </foreignObject>
        <path
          d={dropPath}
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <text
          x={cx}
          y={circleCy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="900"
          fill="rgb(79,70,229)"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          transform={`rotate(${-displayAngle}, ${cx}, ${circleCy})`}
          style={{ transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          {label}
        </text>
      </svg>
    </button>
  );
};

// 사라지는 인디케이터를 잠깐 유지하는 래퍼
const FadingIndicator: React.FC<{
  state: IndicatorState;
  onClickDirection: (dir: Direction, pts: { lat: number; lng: number }[]) => void;
}> = ({ state, onClickDirection }) => {
  const [alive, setAlive] = useState(true);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // 사라질 때: opacity → 0 후 DOM 제거
    const t1 = setTimeout(() => setOpacity(0), 10);
    const t2 = setTimeout(() => setAlive(false), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!alive) return null;

  const cx = S / 2;
  const circleCy = S / 2 + 6;
  const r = 15;
  const tipY = 3;
  const dropPath = [
    `M ${cx} ${tipY}`,
    `C ${cx - 9} ${tipY + 12}, ${cx - r} ${circleCy - r * 0.55}, ${cx - r} ${circleCy}`,
    `A ${r} ${r} 0 1 0 ${cx + r} ${circleCy}`,
    `C ${cx + r} ${circleCy - r * 0.55}, ${cx + 9} ${tipY + 12}, ${cx} ${tipY}`,
    'Z',
  ].join(' ');

  const label = state.count > 999 ? '999+' : String(state.count);
  const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

  return (
    <button
      style={{
        position: 'fixed',
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'default',
        pointerEvents: 'none',
        zIndex: 8999,
        width: `${S}px`,
        height: `${S}px`,
        left: `${state.left}px`,
        top: `${state.top}px`,
        opacity,
        transform: `scale(${opacity === 0 ? 0.5 : 1}) rotate(${state.angleDeg}deg)`,
        transformOrigin: `${cx}px ${S / 2}px`,
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.20))',
      }}
    >
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <clipPath id={`drop-clip-fading-${state.dir}`}>
            <path d={dropPath} />
          </clipPath>
        </defs>
        <foreignObject x="0" y="0" width={S} height={S} clipPath={`url(#drop-clip-fading-${state.dir})`}>
          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
        </foreignObject>
        <path d={dropPath} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" />
        <text x={cx} y={circleCy} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight="900" fill="rgb(79,70,229)" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" transform={`rotate(${-state.angleDeg}, ${cx}, ${circleCy})`}>{label}</text>
      </svg>
    </button>
  );
};

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds,
  onClickDirection,
  topOffset,
  bottomOffset,
  dbCounts,
}) => {
  const { w: screenW, h: screenH } = useWindowSize();

  const topSafeY = typeof topOffset === 'number' ? topOffset : 160;
  const bottomSafeY = bottomOffset;

  // 현재 계산된 인디케이터 목록
  const indicators = React.useMemo(() => {
    if (!dbCounts || !bounds) return [];
    const allPoints = [
      ...(dbCounts.topPoints || []),
      ...(dbCounts.bottomPoints || []),
      ...(dbCounts.leftPoints || []),
      ...(dbCounts.rightPoints || []),
    ];
    if (allPoints.length === 0) return [];
    const { sw, ne } = bounds;
    return computeIndicators(
      allPoints,
      (sw.lat + ne.lat) / 2, (sw.lng + ne.lng) / 2,
      ne.lat - sw.lat, ne.lng - sw.lng,
      screenW, screenH, topSafeY, bottomSafeY,
    );
  }, [dbCounts, bounds, screenW, screenH, topSafeY, bottomSafeY]);

  // 이전 프레임 인디케이터 추적 (사라지는 것 감지)
  const prevRef = useRef<IndicatorState[]>([]);
  const [fadingItems, setFadingItems] = useState<{ id: number; state: IndicatorState }[]>([]);
  const fadingIdRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    const currentDirs = new Set(indicators.map(i => i.dir));
    const disappeared = prev.filter(p => !currentDirs.has(p.dir));
    if (disappeared.length > 0) {
      setFadingItems(f => [
        ...f,
        ...disappeared.map(s => ({ id: fadingIdRef.current++, state: s })),
      ]);
      // 400ms 후 정리
      setTimeout(() => {
        setFadingItems(f => f.slice(disappeared.length));
      }, 450);
    }
    prevRef.current = indicators;
  }, [indicators]);

  return (
    <>
      {/* 사라지는 인디케이터 */}
      {fadingItems.map(({ id, state }) => (
        <FadingIndicator key={`fading-${id}`} state={state} onClickDirection={onClickDirection} />
      ))}
      {/* 현재 인디케이터 */}
      {indicators.map(state => (
        <DropIndicator key={state.dir} state={state} onClickDirection={onClickDirection} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;
