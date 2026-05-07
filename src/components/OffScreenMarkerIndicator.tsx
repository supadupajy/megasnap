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
  originX: number;
  originY: number;
}

// FadingIndicator에 넘기는 스냅샷 — displayAngle이 포함됨
interface FadingState extends IndicatorState {
  displayAngle: number;
  displayCount: number;
}

function useWindowSize() {
  const getSize = () => ({
    w: window.visualViewport?.width ?? window.innerWidth,
    h: window.visualViewport?.height ?? window.innerHeight,
  });
  const [size, setSize] = useState(getSize);
  useEffect(() => {
    const handler = () => setSize(getSize());
    window.addEventListener('resize', handler);
    window.visualViewport?.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.visualViewport?.removeEventListener('resize', handler);
    };
  }, []);
  return size;
}

// SVG 치수
const S = 52;
const CX = S / 2;             // 26
const R = 15;
const TIP_Y = 3;             // 꼭짓점 위치 (높을수록 꼬리 짧아짐)
const CIRCLE_CY = S / 2 + 2; // 28 — 원(숫자) 중심, 회전 기준점
const EDGE = 10;

const DROP_PATH = [
  `M ${CX} ${TIP_Y}`,
  `C ${CX - 9} ${TIP_Y + 12}, ${CX - R} ${CIRCLE_CY - R * 0.55}, ${CX - R} ${CIRCLE_CY}`,
  `A ${R} ${R} 0 1 0 ${CX + R} ${CIRCLE_CY}`,
  `C ${CX + R} ${CIRCLE_CY - R * 0.55}, ${CX + 9} ${TIP_Y + 12}, ${CX} ${TIP_Y}`,
  'Z',
].join(' ');

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

  const btnPos: Record<Direction, { left: number; top: number }> = {
    top:    { left: midX - CX,          top: topSafeY },
    bottom: { left: midX - CX,          top: screenH - bottomSafeY - S },
    left:   { left: EDGE,               top: midY - CIRCLE_CY },
    right:  { left: screenW - EDGE - S, top: midY - CIRCLE_CY },
  };

  const indCenter: Record<Direction, { x: number; y: number }> = {
    top:    { x: midX,                      y: topSafeY + CIRCLE_CY },
    bottom: { x: midX,                      y: screenH - bottomSafeY - S + CIRCLE_CY },
    left:   { x: EDGE + CX,                 y: midY },
    right:  { x: screenW - EDGE - S + CX,   y: midY },
  };

  // 분류: 화면 중앙(midX, midY) 기준 픽셀 좌표로 4사분면 분류 (45° 섹터)
  // → 사용자의 직관(지도 중앙에서 본 마커 방향)과 일치
  const classified: Record<Direction, { lat: number; lng: number }[]> = {
    top: [], bottom: [], left: [], right: [],
  };
  for (const p of allPoints) {
    const px = toScreenX(p.lng) - midX;
    const py = toScreenY(p.lat) - midY;
    if      (py <= 0 && Math.abs(py) >= Math.abs(px))  classified.top.push(p);
    else if (py > 0  && Math.abs(py) > Math.abs(px))   classified.bottom.push(p);
    else if (px <= 0 && Math.abs(px) > Math.abs(py))   classified.left.push(p);
    else                                                classified.right.push(p);
  }

  return (['top', 'bottom', 'left', 'right'] as Direction[])
    .filter(dir => classified[dir].length > 0)
    .map(dir => {
      const pts = classified[dir];
      const pos = btnPos[dir];

      // 대표 마커: 화면 중앙(midX, midY)에서 가장 가까운 마커
      // → 분류와 화살표 모두 화면 중앙 기준으로 계산되어 일관성 확보
      let rep = pts[0];
      let bestDist = Infinity;
      for (const p of pts) {
        const dx = toScreenX(p.lng) - midX;
        const dy = toScreenY(p.lat) - midY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; rep = p; }
      }

      // 화살표 각도: 화면 중앙에서 마커를 보는 방향
      // → 분류 기준과 동일하므로 항상 ±45° 이내 → 사용자 직관과 일치
      const mX = toScreenX(rep.lng);
      const mY = toScreenY(rep.lat);
      const angleDeg = (Math.atan2(mX - midX, -(mY - midY)) * 180) / Math.PI;
      return {
        dir, angleDeg, count: pts.length, pts,
        left: pos.left, top: pos.top,
        originX: CX, originY: CIRCLE_CY,
      };
    });
}

// ── 개별 인디케이터 ───────────────────────────────────────────────
const DropIndicator: React.FC<{
  state: IndicatorState;
  onClickDirection: (dir: Direction, pts: { lat: number; lng: number }[]) => void;
  // 현재 표시 중인 displayAngle/displayCount를 부모에게 알림 (사라질 때 스냅샷용)
  onDisplayAngleChange: (dir: Direction, angle: number) => void;
  onDisplayCountChange: (dir: Direction, count: number) => void;
}> = ({ state, onClickDirection, onDisplayAngleChange, onDisplayCountChange }) => {
  const { dir, angleDeg, count, pts, left, top, originX, originY } = state;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // 각도 디바운스
  const accAngleRef = useRef<number>(angleDeg);
  const [displayAngle, setDisplayAngle] = useState(angleDeg);
  const isFirstAngle = useRef(true);
  const angleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAngleRef = useRef<number>(angleDeg);

  useEffect(() => {
    if (isFirstAngle.current) {
      isFirstAngle.current = false;
      accAngleRef.current = angleDeg;
      pendingAngleRef.current = angleDeg;
      setDisplayAngle(angleDeg);
      onDisplayAngleChange(dir, angleDeg);
      return;
    }
    pendingAngleRef.current = angleDeg;
    if (angleDebounceRef.current) clearTimeout(angleDebounceRef.current);
    angleDebounceRef.current = setTimeout(() => {
      angleDebounceRef.current = null;
      const target = pendingAngleRef.current;
      const current = accAngleRef.current;
      const curNorm = ((current % 360) + 360) % 360;
      const tgtNorm = ((target % 360) + 360) % 360;
      let delta = tgtNorm - curNorm;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      if (Math.abs(delta) < 5) return;
      accAngleRef.current = current + delta;
      setDisplayAngle(accAngleRef.current);
      onDisplayAngleChange(dir, accAngleRef.current);
    }, 300);
    return () => { if (angleDebounceRef.current) clearTimeout(angleDebounceRef.current); };
  }, [angleDeg]);

  // 숫자 디바운스
  const [displayCount, setDisplayCount] = useState(count);
  const pendingCountRef = useRef<number>(count);
  const countDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstCount = useRef(true);

  useEffect(() => {
    if (isFirstCount.current) {
      isFirstCount.current = false;
      setDisplayCount(count);
      pendingCountRef.current = count;
      onDisplayCountChange(dir, count);
      return;
    }
    pendingCountRef.current = count;
    if (countDebounceRef.current) clearTimeout(countDebounceRef.current);
    countDebounceRef.current = setTimeout(() => {
      countDebounceRef.current = null;
      setDisplayCount(pendingCountRef.current);
      onDisplayCountChange(dir, pendingCountRef.current);
    }, 300);
    return () => { if (countDebounceRef.current) clearTimeout(countDebounceRef.current); };
  }, [count]);

  const label = displayCount > 999 ? '999+' : String(displayCount);
  const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${S}px`,
    height: `${S}px`,
    zIndex: 9000,
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: mounted ? 1 : 0,
    transform: `scale(${mounted ? 1 : 0.5})`,
    transition: 'opacity 0.3s ease, transform 0.35s ease-out',
  };

  const dropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: `rotate(${displayAngle}deg)`,
    transformOrigin: `${originX}px ${originY}px`,
    transition: 'transform 0.35s ease-out',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.20)) drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
    willChange: 'transform',
    pointerEvents: 'none',
  };

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${S}px`,
    height: `${S}px`,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: `${CIRCLE_CY - fontSize / 2 - 1}px`,
    fontSize: `${fontSize}px`,
    fontWeight: 900,
    color: 'rgb(79,70,229)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    lineHeight: 1,
  };

  return (
    <div
      role="button"
      onClick={() => onClickDirection(dir, pts)}
      onMouseDown={e => e.stopPropagation()}
      style={containerStyle}
    >
      <div style={dropStyle}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <clipPath id={`drop-clip-${dir}`}><path d={DROP_PATH} /></clipPath>
          </defs>
          <foreignObject x="0" y="0" width={S} height={S} clipPath={`url(#drop-clip-${dir})`}>
            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
          </foreignObject>
          <path d={DROP_PATH} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={textStyle}>{label}</div>
    </div>
  );
};

// ── 사라지는 인디케이터 — displayAngle/displayCount 스냅샷 사용 ──
const FadingIndicator: React.FC<{ state: FadingState }> = ({ state }) => {
  const [opacity, setOpacity] = useState(1);
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setOpacity(0), 16);
    const t2 = setTimeout(() => setAlive(false), 380);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!alive) return null;

  const label = state.displayCount > 999 ? '999+' : String(state.displayCount);
  const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${state.left}px`,
    top: `${state.top}px`,
    width: `${S}px`,
    height: `${S}px`,
    zIndex: 8999,
    pointerEvents: 'none',
    opacity,
    transform: `scale(${opacity < 0.5 ? 0.7 : 1})`,
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  };

  // 사라질 때는 마지막으로 화면에 표시되던 각도(displayAngle)를 그대로 유지
  const dropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: `rotate(${state.displayAngle}deg)`,
    transformOrigin: `${state.originX}px ${state.originY}px`,
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.20))',
  };

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${S}px`,
    height: `${S}px`,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: `${CIRCLE_CY - fontSize / 2 - 1}px`,
    fontSize: `${fontSize}px`,
    fontWeight: 900,
    color: 'rgb(79,70,229)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    lineHeight: 1,
  };

  return (
    <div style={containerStyle}>
      <div style={dropStyle}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <clipPath id={`drop-clip-fading-${state.dir}`}><path d={DROP_PATH} /></clipPath>
          </defs>
          <foreignObject x="0" y="0" width={S} height={S} clipPath={`url(#drop-clip-fading-${state.dir})`}>
            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
          </foreignObject>
          <path d={DROP_PATH} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={textStyle}>{label}</div>
    </div>
  );
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds, onClickDirection, topOffset, bottomOffset, dbCounts,
}) => {
  const { w: screenW, h: screenH } = useWindowSize();

  const topSafeY = typeof topOffset === 'number' ? topOffset : 160;
  const bottomSafeY = bottomOffset + 8;

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

  // 각 방향별로 DropIndicator가 현재 표시 중인 displayAngle/displayCount를 추적
  const displayAnglesRef = useRef<Partial<Record<Direction, number>>>({});
  const displayCountsRef = useRef<Partial<Record<Direction, number>>>({});

  const handleDisplayAngleChange = (dir: Direction, angle: number) => {
    displayAnglesRef.current[dir] = angle;
  };
  const handleDisplayCountChange = (dir: Direction, count: number) => {
    displayCountsRef.current[dir] = count;
  };

  const prevRef = useRef<IndicatorState[]>([]);
  const [fadingItems, setFadingItems] = useState<{ id: number; state: FadingState }[]>([]);
  const fadingIdRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    const currentDirs = new Set(indicators.map(i => i.dir));
    const disappeared = prev.filter(p => !currentDirs.has(p.dir));

    // 1) 새로 나타난 방향과 동일한 dir의 fading 항목은 즉시 제거 (중복 표시 방지)
    if (currentDirs.size > 0) {
      setFadingItems(f => f.filter(item => !currentDirs.has(item.state.dir)));
    }

    // 2) 사라진 방향만 fading으로 추가
    if (disappeared.length > 0) {
      const newFading = disappeared.map(s => ({
        id: fadingIdRef.current++,
        state: {
          ...s,
          displayAngle: displayAnglesRef.current[s.dir] ?? s.angleDeg,
          displayCount: displayCountsRef.current[s.dir] ?? s.count,
        } as FadingState,
      }));
      setFadingItems(f => {
        // 같은 방향의 기존 fading 항목은 제거하고 새 것만 추가 (방향당 최대 1개)
        const disappearedDirs = new Set(disappeared.map(d => d.dir));
        const filtered = f.filter(item => !disappearedDirs.has(item.state.dir));
        return [...filtered, ...newFading];
      });
      const ids = newFading.map(f => f.id);
      setTimeout(() => setFadingItems(f => f.filter(item => !ids.includes(item.id))), 420);
    }
    prevRef.current = indicators;
  }, [indicators]);

  return (
    <>
      {fadingItems.map(({ id, state }) => <FadingIndicator key={`fading-${id}`} state={state} />)}
      {indicators.map(state => (
        <DropIndicator
          key={state.dir}
          state={state}
          onClickDirection={onClickDirection}
          onDisplayAngleChange={handleDisplayAngleChange}
          onDisplayCountChange={handleDisplayCountChange}
        />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;
