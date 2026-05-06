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

const BTN = 56;        // 버튼 크기 (px)
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

  const screenCx = screenW / 2;
  const screenCy = (topSafeY + (screenH - bottomSafeY)) / 2;

  interface IndicatorInfo {
    cluster: MarkerCluster;
    edge: Direction;
    cx: number; // 버튼 중심 X
    cy: number; // 버튼 중심 Y
    angleDeg: number;
  }

  // 마커가 화면 중심 기준 어느 방향인지 → 해당 가장자리에 배치
  const assignEdge = (avgLat: number, avgLng: number): Direction => {
    const dx = lngToX(avgLng) - screenCx;
    const dy = latToY(avgLat) - screenCy;
    if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'bottom' : 'top';
    return dx > 0 ? 'right' : 'left';
  };

  // 버튼 중심 → 마커 방향 각도 (위=0, 시계방향)
  const calcAngle = (btnCx: number, btnCy: number, avgLat: number, avgLng: number) => {
    const mX = lngToX(avgLng);
    const mY = latToY(avgLat);
    return (Math.atan2(mX - btnCx, -(mY - btnCy)) * 180) / Math.PI;
  };

  // 가장자리별 버튼 중심 초기 위치
  // top/bottom: X는 마커 경도 기준, Y는 가장자리 고정
  // left/right: X는 가장자리 고정, Y는 화면 세로 중앙 고정
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

  // 같은 가장자리 내 겹침 방지
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
            const dir = dx >= 0 ? 1 : -1;
            a.cx = Math.max(BTN / 2 + EDGE_MARGIN, Math.min(screenW - BTN / 2 - EDGE_MARGIN, a.cx + push * dir));
            b.cx = Math.max(BTN / 2 + EDGE_MARGIN, Math.min(screenW - BTN / 2 - EDGE_MARGIN, b.cx - push * dir));
          } else {
            const dir = dy >= 0 ? 1 : -1;
            a.cy = Math.max(topSafeY + BTN / 2, Math.min(screenH - bottomSafeY - BTN / 2, a.cy + push * dir));
            b.cy = Math.max(topSafeY + BTN / 2, Math.min(screenH - bottomSafeY - BTN / 2, b.cy - push * dir));
          }
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
    const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

    const S = BTN;
    const vcx = S / 2;  // 28
    const vcy = S / 2;  // 28

    // 삼각형: 꼭지점이 위(↑)를 향하는 기본 모양
    const tipX = vcx;
    const tipY = 4;
    const baseY = S - 6;
    const halfBase = 22;

    // 숫자 위치: 삼각형 무게중심
    const textY = (tipY + baseY + baseY) / 3;

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
          transform: `rotate(${angleDeg}deg)`,
          transformOrigin: `${vcx}px ${vcy}px`,
        }}
      >
        <svg
          width={S}
          height={S}
          viewBox={`0 0 ${S} ${S}`}
          style={{ display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.22))' }}
        >
          {/* 기존 디자인과 동일한 반투명 흰색 삼각형 */}
          <polygon
            points={`${tipX},${tipY} ${vcx - halfBase},${baseY} ${vcx + halfBase},${baseY}`}
            fill="rgba(255,255,255,0.82)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 숫자 — 회전 역방향 보정으로 항상 읽기 쉽게 */}
          <text
            x={vcx}
            y={textY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight="800"
            fill="rgb(79,70,229)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            transform={`rotate(${-angleDeg}, ${vcx}, ${textY})`}
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
