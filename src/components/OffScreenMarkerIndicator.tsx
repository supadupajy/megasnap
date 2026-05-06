import React, { useEffect, useState } from 'react';
import { DirectionCounts, MarkerCluster } from '@/hooks/use-supabase-posts';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface OffScreenMarkerIndicatorProps {
  bounds: Bounds | null;
  onClickCluster: (cluster: MarkerCluster) => void;
  topOffset?: string | number;
  bottomOffset: number;
  dbCounts?: DirectionCounts | null;
}

// 하위 호환용 (Index.tsx에서 dir 기반 클릭 핸들러를 위해 export 유지)
export type Direction = 'top' | 'bottom' | 'left' | 'right';

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

const TRI_SIZE = 56;
const EDGE_MARGIN = 16;
const MIN_GAP = 12;

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds,
  onClickCluster,
  topOffset,
  bottomOffset,
  dbCounts,
}) => {
  const { w: screenW, h: screenH } = useWindowSize();

  if (!dbCounts || !bounds) return null;

  const clusters = dbCounts.clusters;
  if (!clusters || clusters.length === 0) return null;

  const { sw, ne } = bounds;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

  const topSafeY = topOffset !== undefined
    ? (typeof topOffset === 'number' ? topOffset : 140)
    : 140;
  const bottomSafeY = bottomOffset + 8;

  // 위도/경도 → 화면 픽셀 (화면 밖도 포함한 절대 좌표)
  const lngToX = (lng: number) => ((lng - sw.lng) / lngRange) * screenW;
  const latToY = (lat: number) => (1 - (lat - sw.lat) / latRange) * screenH;

  interface IndicatorInfo {
    cluster: MarkerCluster;
    absX: number;
    absY: number;
    angleDeg: number;
  }

  // 각 클러스터의 인디케이터 위치를 화면 가장자리에 배치
  const indicators: IndicatorInfo[] = clusters.map(cluster => {
    const markerX = lngToX(cluster.avgLng);
    const markerY = latToY(cluster.avgLat);

    // 화면 중심
    const screenCx = screenW / 2;
    const screenCy = (topSafeY + (screenH - bottomSafeY)) / 2;

    // 중심 → 마커 방향 벡터
    const dx = markerX - screenCx;
    const dy = markerY - screenCy;

    // 화면 가장자리와의 교점 계산 (ray casting)
    const usableTop = topSafeY + TRI_SIZE / 2;
    const usableBottom = screenH - bottomSafeY - TRI_SIZE / 2;
    const usableLeft = EDGE_MARGIN + TRI_SIZE / 2;
    const usableRight = screenW - EDGE_MARGIN - TRI_SIZE / 2;

    let edgeCx = screenCx;
    let edgeCy = screenCy;

    if (dx === 0 && dy === 0) {
      edgeCx = screenCx;
      edgeCy = usableTop;
    } else {
      // 각 가장자리까지의 t값 계산 (parametric: pos = center + t * dir)
      const candidates: number[] = [];
      if (dy < 0) candidates.push((usableTop - screenCy) / dy);
      if (dy > 0) candidates.push((usableBottom - screenCy) / dy);
      if (dx < 0) candidates.push((usableLeft - screenCx) / dx);
      if (dx > 0) candidates.push((usableRight - screenCx) / dx);

      // 양수 t 중 가장 작은 값 (가장 가까운 가장자리)
      const t = Math.min(...candidates.filter(v => v > 0));
      edgeCx = screenCx + dx * t;
      edgeCy = screenCy + dy * t;
    }

    // 가장자리 클램핑
    edgeCx = Math.max(usableLeft, Math.min(usableRight, edgeCx));
    edgeCy = Math.max(usableTop, Math.min(usableBottom, edgeCy));

    const absX = edgeCx - TRI_SIZE / 2;
    const absY = edgeCy - TRI_SIZE / 2;

    // 인디케이터 중심 → 마커 방향 각도 (위쪽=0, 시계방향)
    const angleRad = Math.atan2(markerX - edgeCx, -(markerY - edgeCy));
    const angleDeg = (angleRad * 180) / Math.PI;

    return { cluster, absX, absY, angleDeg };
  });

  // ── 겹침 방지 ──────────────────────────────────────────────────────
  for (let iter = 0; iter < 15; iter++) {
    let anyOverlap = false;

    for (let i = 0; i < indicators.length; i++) {
      for (let j = i + 1; j < indicators.length; j++) {
        const a = indicators[i];
        const b = indicators[j];

        const overlapX = a.absX < b.absX + TRI_SIZE + MIN_GAP && a.absX + TRI_SIZE + MIN_GAP > b.absX;
        const overlapY = a.absY < b.absY + TRI_SIZE + MIN_GAP && a.absY + TRI_SIZE + MIN_GAP > b.absY;
        if (!overlapX || !overlapY) continue;

        anyOverlap = true;

        const aCx = a.absX + TRI_SIZE / 2;
        const aCy = a.absY + TRI_SIZE / 2;
        const bCx = b.absX + TRI_SIZE / 2;
        const bCy = b.absY + TRI_SIZE / 2;
        const dx = aCx - bCx;
        const dy = aCy - bCy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const needed = TRI_SIZE + MIN_GAP;
        const push = (needed - dist) / 2 + 1;

        // 각 인디케이터가 어느 가장자리에 붙어있는지 판단해서 허용 이동 방향 결정
        const moveA = (ddx: number, ddy: number) => {
          a.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, a.absX + ddx));
          a.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, a.absY + ddy));
        };
        const moveB = (ddx: number, ddy: number) => {
          b.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, b.absX + ddx));
          b.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, b.absY + ddy));
        };

        const nx = dx / dist;
        const ny = dy / dist;
        moveA(nx * push, ny * push);
        moveB(-nx * push, -ny * push);

        // 각도 재계산
        for (const ind of [a, b]) {
          const cx = ind.absX + TRI_SIZE / 2;
          const cy = ind.absY + TRI_SIZE / 2;
          const mX = lngToX(ind.cluster.avgLng);
          const mY = latToY(ind.cluster.avgLat);
          const ar = Math.atan2(mX - cx, -(mY - cy));
          ind.angleDeg = (ar * 180) / Math.PI;
        }
      }
    }

    if (!anyOverlap) break;
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────
  const Btn = ({ info }: { info: IndicatorInfo }) => {
    const { cluster, absX, absY, angleDeg } = info;
    const count = cluster.count;

    const label = count > 999 ? '999+' : String(count);
    const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 10 : 12;

    const cx = TRI_SIZE / 2;
    const cy = TRI_SIZE / 2;
    const tipY = 4;
    const baseY = TRI_SIZE - 4;
    const halfBase = 22;
    const triPoints = `${cx},${tipY} ${cx - halfBase},${baseY} ${cx + halfBase},${baseY}`;
    const textY = tipY + (baseY - tipY) * 0.62;

    return (
      <button
        onClick={() => onClickCluster(cluster)}
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          zIndex: 9000,
          pointerEvents: 'auto',
          width: `${TRI_SIZE}px`,
          height: `${TRI_SIZE}px`,
          left: `${absX}px`,
          top: `${absY}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          clipPath: `polygon(50% ${(tipY / TRI_SIZE) * 100}%, ${((cx - halfBase) / TRI_SIZE) * 100}% ${(baseY / TRI_SIZE) * 100}%, ${((cx + halfBase) / TRI_SIZE) * 100}% ${(baseY / TRI_SIZE) * 100}%)`,
          transform: `rotate(${angleDeg}deg)`,
        }}
      >
        <svg
          width={TRI_SIZE}
          height={TRI_SIZE}
          viewBox={`0 0 ${TRI_SIZE} ${TRI_SIZE}`}
          style={{ display: 'block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.10))' }}
        >
          <polygon
            points={triPoints}
            fill="rgba(255,255,255,0.30)"
            stroke="rgba(255,255,255,0.50)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <text
            x={cx}
            y={textY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight="800"
            fill="rgb(79,70,229)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            transform={`rotate(${-angleDeg}, ${cx}, ${textY})`}
          >
            {label}
          </text>
        </svg>
      </button>
    );
  };

  return (
    <>
      {indicators.map((info, i) => (
        <Btn key={i} info={info} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;
