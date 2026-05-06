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

  // 위도/경도 → 화면 픽셀 (화면 밖 포함)
  const lngToX = (lng: number) => ((lng - sw.lng) / lngRange) * screenW;
  const latToY = (lat: number) => (1 - (lat - sw.lat) / latRange) * screenH;

  // 화면 중심
  const screenCx = screenW / 2;
  const screenCy = (topSafeY + (screenH - bottomSafeY)) / 2;

  interface IndicatorInfo {
    cluster: MarkerCluster;
    edge: Direction;   // 배치될 가장자리
    absX: number;      // 버튼 left edge (절대 픽셀)
    absY: number;      // 버튼 top edge (절대 픽셀)
    angleDeg: number;  // 삼각형 꼭지점이 향하는 각도 (위=0, 시계방향)
  }

  // 각 클러스터를 어느 가장자리에 배치할지 결정
  // → 화면 중심 → 마커 방향 벡터를 4방향 중 가장 가까운 쪽으로 분류
  const assignEdge = (avgLat: number, avgLng: number): Direction => {
    const dx = (avgLng - (sw.lng + ne.lng) / 2) / lngRange;
    const dy = -((avgLat - (sw.lat + ne.lat) / 2) / latRange); // 화면 Y 반전
    // 절대값 비교로 4방향 분류
    if (Math.abs(dy) >= Math.abs(dx)) {
      return dy < 0 ? 'bottom' : 'top';
    } else {
      return dx < 0 ? 'left' : 'right';
    }
  };

  // 각 가장자리별 인디케이터 목록 구성
  const edgeGroups: Record<Direction, IndicatorInfo[]> = { top: [], bottom: [], left: [], right: [] };

  for (const cluster of clusters) {
    const edge = assignEdge(cluster.avgLat, cluster.avgLng);
    const markerX = lngToX(cluster.avgLng);
    const markerY = latToY(cluster.avgLat);

    // 가장자리별 초기 위치 계산
    let absX = 0;
    let absY = 0;

    if (edge === 'top') {
      // 상단 고정: X는 마커 경도 기준, Y는 상단 고정
      let cx = markerX;
      cx = Math.max(TRI_SIZE / 2 + EDGE_MARGIN, Math.min(screenW - TRI_SIZE / 2 - EDGE_MARGIN, cx));
      absX = cx - TRI_SIZE / 2;
      absY = topSafeY;
    } else if (edge === 'bottom') {
      // 하단 고정: X는 마커 경도 기준, Y는 하단 고정
      let cx = markerX;
      cx = Math.max(80 + TRI_SIZE / 2 + EDGE_MARGIN, Math.min(screenW - 80 - TRI_SIZE / 2 - EDGE_MARGIN, cx));
      absX = cx - TRI_SIZE / 2;
      absY = screenH - bottomSafeY - TRI_SIZE;
    } else if (edge === 'left') {
      // 좌측 고정: X는 좌측 고정, Y는 화면 세로 중앙 기준
      absX = EDGE_MARGIN;
      absY = screenCy - TRI_SIZE / 2;
      absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, absY));
    } else {
      // 우측 고정: X는 우측 고정, Y는 화면 세로 중앙 기준
      absX = screenW - EDGE_MARGIN - TRI_SIZE;
      absY = screenCy - TRI_SIZE / 2;
      absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, absY));
    }

    // 인디케이터 중심 → 마커 방향 각도 (위=0, 시계방향)
    const indCx = absX + TRI_SIZE / 2;
    const indCy = absY + TRI_SIZE / 2;
    const angleRad = Math.atan2(markerX - indCx, -(markerY - indCy));
    const angleDeg = (angleRad * 180) / Math.PI;

    edgeGroups[edge].push({ cluster, edge, absX, absY, angleDeg });
  }

  // 같은 가장자리 내 겹침 방지
  const allIndicators: IndicatorInfo[] = [];

  for (const edge of ['top', 'bottom', 'left', 'right'] as Direction[]) {
    const group = edgeGroups[edge];
    if (group.length === 0) continue;

    // 같은 가장자리 내에서 겹치면 자유 축(top/bottom→X, left/right→Y)으로 분리
    for (let iter = 0; iter < 10; iter++) {
      let anyOverlap = false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const overlapX = a.absX < b.absX + TRI_SIZE + MIN_GAP && a.absX + TRI_SIZE + MIN_GAP > b.absX;
          const overlapY = a.absY < b.absY + TRI_SIZE + MIN_GAP && a.absY + TRI_SIZE + MIN_GAP > b.absY;
          if (!overlapX || !overlapY) continue;
          anyOverlap = true;

          if (edge === 'top' || edge === 'bottom') {
            // X축으로 분리
            const aCx = a.absX + TRI_SIZE / 2;
            const bCx = b.absX + TRI_SIZE / 2;
            const dx = aCx - bCx;
            const push = (TRI_SIZE + MIN_GAP - Math.abs(dx)) / 2 + 1;
            const dir = dx >= 0 ? 1 : -1;
            a.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, a.absX + push * dir));
            b.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, b.absX - push * dir));
          } else {
            // Y축으로 분리
            const aCy = a.absY + TRI_SIZE / 2;
            const bCy = b.absY + TRI_SIZE / 2;
            const dy = aCy - bCy;
            const push = (TRI_SIZE + MIN_GAP - Math.abs(dy)) / 2 + 1;
            const dir = dy >= 0 ? 1 : -1;
            a.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, a.absY + push * dir));
            b.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, b.absY - push * dir));
          }

          // 위치 변경 후 각도 재계산
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

    allIndicators.push(...group);
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────
  const Btn = ({ info }: { info: IndicatorInfo }) => {
    const { cluster, absX, absY, angleDeg } = info;
    const count = cluster.count;
    const label = count > 999 ? '999+' : String(count);
    const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 10 : 12;

    const cx = TRI_SIZE / 2;
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
      {allIndicators.map((info, i) => (
        <Btn key={i} info={info} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;