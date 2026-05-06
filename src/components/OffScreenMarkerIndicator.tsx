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

// 화살표 버튼 크기
const BTN = 44;
const EDGE_MARGIN = 12;
const MIN_GAP = 8;

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

  const lngToX = (lng: number) => ((lng - sw.lng) / lngRange) * screenW;
  const latToY = (lat: number) => (1 - (lat - sw.lat) / latRange) * screenH;

  // 화면 중심
  const screenCx = screenW / 2;
  const screenCy = (topSafeY + (screenH - bottomSafeY)) / 2;

  interface IndicatorInfo {
    cluster: MarkerCluster;
    edge: Direction;
    // 버튼 중심 좌표 (절대 픽셀)
    cx: number;
    cy: number;
    angleDeg: number;
  }

  // 마커가 화면 중심 기준 어느 방향인지 → 해당 가장자리에 배치
  const assignEdge = (avgLat: number, avgLng: number): Direction => {
    const dx = lngToX(avgLng) - screenCx;
    const dy = latToY(avgLat) - screenCy;
    if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'bottom' : 'top';
    return dx > 0 ? 'right' : 'left';
  };

  // 각도 계산: 버튼 중심 → 마커 방향 (위=0, 시계방향)
  const calcAngle = (btnCx: number, btnCy: number, avgLat: number, avgLng: number) => {
    const mX = lngToX(avgLng);
    const mY = latToY(avgLat);
    return (Math.atan2(mX - btnCx, -(mY - btnCy)) * 180) / Math.PI;
  };

  // 가장자리별 버튼 중심 위치 (상하는 X만 마커 기준, 좌우는 Y 고정 중앙)
  const edgePosition = (edge: Direction, markerX: number): { cx: number; cy: number } => {
    const half = BTN / 2;
    if (edge === 'top') {
      const cx = Math.max(half + EDGE_MARGIN, Math.min(screenW - half - EDGE_MARGIN, markerX));
      return { cx, cy: topSafeY + half };
    }
    if (edge === 'bottom') {
      const cx = Math.max(80 + half + EDGE_MARGIN, Math.min(screenW - 80 - half - EDGE_MARGIN, markerX));
      return { cx, cy: screenH - bottomSafeY - half };
    }
    if (edge === 'left') {
      return { cx: EDGE_MARGIN + half, cy: screenCy };
    }
    // right
    return { cx: screenW - EDGE_MARGIN - half, cy: screenCy };
  };

  // 가장자리별 그룹 구성
  const edgeGroups: Record<Direction, IndicatorInfo[]> = { top: [], bottom: [], left: [], right: [] };

  for (const cluster of clusters) {
    const edge = assignEdge(cluster.avgLat, cluster.avgLng);
    const markerX = lngToX(cluster.avgLng);
    const { cx, cy } = edgePosition(edge, markerX);
    const angleDeg = calcAngle(cx, cy, cluster.avgLat, cluster.avgLng);
    edgeGroups[edge].push({ cluster, edge, cx, cy, angleDeg });
  }

  // 같은 가장자리 내 겹침 방지 (자유 축으로 분리)
  const allIndicators: IndicatorInfo[] = [];

  for (const edge of ['top', 'bottom', 'left', 'right'] as Direction[]) {
    const group = edgeGroups[edge];
    if (group.length === 0) continue;

    for (let iter = 0; iter < 10; iter++) {
      let anyOverlap = false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const dx = a.cx - b.cx;
          const dy = a.cy - b.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const needed = BTN + MIN_GAP;
          if (dist >= needed) continue;

          anyOverlap = true;
          const push = (needed - dist) / 2 + 1;

          if (edge === 'top' || edge === 'bottom') {
            // X축으로만 분리
            const dir = dx >= 0 ? 1 : -1;
            a.cx = Math.max(BTN / 2 + EDGE_MARGIN, Math.min(screenW - BTN / 2 - EDGE_MARGIN, a.cx + push * dir));
            b.cx = Math.max(BTN / 2 + EDGE_MARGIN, Math.min(screenW - BTN / 2 - EDGE_MARGIN, b.cx - push * dir));
          } else {
            // Y축으로만 분리
            const dir = dy >= 0 ? 1 : -1;
            a.cy = Math.max(topSafeY + BTN / 2, Math.min(screenH - bottomSafeY - BTN / 2, a.cy + push * dir));
            b.cy = Math.max(topSafeY + BTN / 2, Math.min(screenH - bottomSafeY - BTN / 2, b.cy - push * dir));
          }

          // 각도 재계산
          a.angleDeg = calcAngle(a.cx, a.cy, a.cluster.avgLat, a.cluster.avgLng);
          b.angleDeg = calcAngle(b.cx, b.cy, b.cluster.avgLat, b.cluster.avgLng);
        }
      }
      if (!anyOverlap) break;
    }

    allIndicators.push(...group);
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────
  const Btn = ({ info }: { info: IndicatorInfo }) => {
    const { cluster, cx, cy, angleDeg } = info;
    const count = cluster.count;
    const label = count > 999 ? '999+' : String(count);
    const fontSize = label.length >= 4 ? 8 : label.length === 3 ? 10 : 12;

    // 화살표(chevron): 위쪽을 향하는 기본 모양 → rotate로 방향 조정
    // 뷰박스 44×44, 중심 22,22
    const S = BTN;
    const vcx = S / 2;
    const vcy = S / 2;
    // chevron 꼭지점 (위쪽)
    const tipX = vcx;
    const tipY = 6;
    const leftX = vcx - 13;
    const leftY = vcy + 6;
    const rightX = vcx + 13;
    const rightY = vcy + 6;

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
          width: `${S}px`,
          height: `${S}px`,
          left: `${cx - S / 2}px`,
          top: `${cy - S / 2}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(${angleDeg}deg)`,
          transformOrigin: `${vcx}px ${vcy}px`,
        }}
      >
        <svg
          width={S}
          height={S}
          viewBox={`0 0 ${S} ${S}`}
          style={{ display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
        >
          {/* 화살표 몸통 (채워진 삼각형) */}
          <polygon
            points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
            fill="rgba(255,255,255,0.85)"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 숫자 — 삼각형 무게중심, 회전 역방향 보정 */}
          <text
            x={vcx}
            y={(tipY + leftY + rightY) / 3 + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight="900"
            fill="rgb(79,70,229)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            transform={`rotate(${-angleDeg}, ${vcx}, ${(tipY + leftY + rightY) / 3 + 1})`}
          >
            {label}
          </text>
        </svg>
      </button>
    );
  };

  return (
    <>
      {allIndicators.map((info, i) => (
        <Btn key={i} info={info} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;
