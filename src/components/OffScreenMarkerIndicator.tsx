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

// 지도 중심(lat/lng)에서 가장 가까운 마커를 반환
// → 클릭 시 이동하는 마커(Index.tsx의 onClickDirection 로직)와 동일한 기준
function nearestToMapCenter(
  pts: { lat: number; lng: number }[],
  centerLat: number,
  centerLng: number,
): { lat: number; lng: number } {
  let best = pts[0];
  let bestDist = Infinity;
  for (const p of pts) {
    const dlat = p.lat - centerLat;
    const dlng = p.lng - centerLng;
    const d = dlat * dlat + dlng * dlng;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

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

  // 45도 섹터 기반 분류 (화면 중심 기준 dLat/dLng 비율)
  const classified: Record<Direction, { lat: number; lng: number }[]> = {
    top: [], bottom: [], left: [], right: [],
  };

  for (const p of allPoints) {
    const dLat = (p.lat - centerLat) / latRange;
    const dLng = (p.lng - centerLng) / lngRange;
    if      (dLat >= 0 && dLat >= Math.abs(dLng))           classified.top.push(p);
    else if (dLat < 0  && Math.abs(dLat) > Math.abs(dLng))  classified.bottom.push(p);
    else if (dLng < 0  && Math.abs(dLng) >= Math.abs(dLat)) classified.left.push(p);
    else                                                      classified.right.push(p);
  }

  return (['top', 'bottom', 'left', 'right'] as Direction[])
    .filter(dir => classified[dir].length > 0)
    .map(dir => {
      const pts = classified[dir];
      const ind = indCenter[dir];
      // 클릭 시 이동할 마커(지도 중심에서 가장 가까운 것)를 인디케이터도 가리킴
      const rep = nearestToMapCenter(pts, centerLat, centerLng);
      const mX = toScreenX(rep.lng);
      const mY = toScreenY(rep.lat);
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

// ── 개별 인디케이터 컴포넌트 ──────────────────────────────────────
const DropIndicator: React.FC<{
  state: IndicatorState;
  onClickDirection: (dir: Direction, pts: { lat: number; lng: number }[]) => void;
}> = ({ state, onClickDirection }) => {
  const { dir, angleDeg, count, pts, left, top } = state;

  // 등장 애니메이션 (마운트 시 1회)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // 각도: 패닝 중 중간값은 무시하고 멈춘 후 최종값으로만 애니메이션
  // accAngleRef: 실제 CSS에 적용되는 누적 각도 (최단경로 회전 보장)
  const accAngleRef = useRef<number>(angleDeg);
  const [displayAngle, setDisplayAngle] = useState(angleDeg);
  const isFirstRender = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAngleRef = useRef<number>(angleDeg);

  useEffect(() => {
    if (isFirstRender.current) {
      // 최초 마운트: transition 없이 즉시 세팅
      isFirstRender.current = false;
      accAngleRef.current = angleDeg;
      pendingAngleRef.current = angleDeg;
      setDisplayAngle(angleDeg);
      return;
    }

    // 최신 목표 각도를 저장해두고
    pendingAngleRef.current = angleDeg;

    // 이전 디바운스 취소
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // 300ms 후 패닝이 멈추면 그때 최종값으로 애니메이션
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const target = pendingAngleRef.current;
      const current = accAngleRef.current;
      const currentNorm = ((current % 360) + 360) % 360;
      const targetNorm = ((target % 360) + 360) % 360;
      let delta = targetNorm - currentNorm;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      // 변화가 5도 미만이면 애니메이션 생략 (미세 떨림 방지)
      if (Math.abs(delta) < 5) return;
      accAngleRef.current = current + delta;
      setDisplayAngle(accAngleRef.current);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
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
        opacity: mounted ? 1 : 0,
        // 등장 시: scale + rotate 동시 적용
        // 이후: rotate만 transition (scale은 고정 1)
        transform: `scale(${mounted ? 1 : 0.5}) rotate(${displayAngle}deg)`,
        transformOrigin: `${cx}px ${S / 2}px`,
        transition: mounted
          ? 'opacity 0.3s ease, transform 0.35s ease-out'
          : 'none',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.20)) drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
        willChange: 'transform',
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
              background: 'rgba(255,255,255,0.8)',
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
          style={{ transition: 'transform 0.35s ease-out' }}
        >
          {label}
        </text>
      </svg>
    </button>
  );
};

// ── 사라지는 인디케이터 ────────────────────────────────────────────
const FadingIndicator: React.FC<{
  state: IndicatorState;
}> = ({ state }) => {
  const [opacity, setOpacity] = useState(1);
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setOpacity(0), 16);
    const t2 = setTimeout(() => setAlive(false), 380);
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
        transform: `scale(${opacity < 0.5 ? 0.7 : 1}) rotate(${state.angleDeg}deg)`,
        transformOrigin: `${cx}px ${S / 2}px`,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
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

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
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

  // 사라지는 인디케이터 추적
  const prevRef = useRef<IndicatorState[]>([]);
  const [fadingItems, setFadingItems] = useState<{ id: number; state: IndicatorState }[]>([]);
  const fadingIdRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    const currentDirs = new Set(indicators.map(i => i.dir));
    const disappeared = prev.filter(p => !currentDirs.has(p.dir));
    if (disappeared.length > 0) {
      const newFading = disappeared.map(s => ({ id: fadingIdRef.current++, state: s }));
      setFadingItems(f => [...f, ...newFading]);
      const ids = newFading.map(f => f.id);
      setTimeout(() => {
        setFadingItems(f => f.filter(item => !ids.includes(item.id)));
      }, 420);
    }
    prevRef.current = indicators;
  }, [indicators]);

  return (
    <>
      {fadingItems.map(({ id, state }) => (
        <FadingIndicator key={`fading-${id}`} state={state} />
      ))}
      {indicators.map(state => (
        <DropIndicator key={state.dir} state={state} onClickDirection={onClickDirection} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;