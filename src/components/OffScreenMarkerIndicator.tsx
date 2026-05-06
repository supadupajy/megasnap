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

const TRI_SIZE = 56;  // 겹침 방지용 충돌 크기
const DROP_W = 56;    // 물방울 뷰박스 크기 (정사각형)
const DROP_H = 56;
const EDGE_MARGIN = 16;
const MIN_GAP = 10;

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
  // → 마커 방향 각도를 기준으로 4방향 분류
  // → 삼각형이 향하는 방향 = 배치되는 가장자리
  const assignEdge = (avgLat: number, avgLng: number): Direction => {
    const markerX = lngToX(avgLng);
    const markerY = latToY(avgLat);
    // 화면 중심 → 마커 방향 벡터
    const dx = markerX - screenCx;
    const dy = markerY - screenCy; // 화면 Y: 아래가 양수
    // |dy| vs |dx| 비교로 상하/좌우 결정
    if (Math.abs(dy) >= Math.abs(dx)) {
      return dy > 0 ? 'bottom' : 'top';
    } else {
      return dx > 0 ? 'right' : 'left';
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
      let cx = markerX;
      cx = Math.max(DROP_W / 2 + EDGE_MARGIN, Math.min(screenW - DROP_W / 2 - EDGE_MARGIN, cx));
      absX = cx - DROP_W / 2;
      absY = topSafeY;
    } else if (edge === 'bottom') {
      let cx = markerX;
      cx = Math.max(80 + DROP_W / 2 + EDGE_MARGIN, Math.min(screenW - 80 - DROP_W / 2 - EDGE_MARGIN, cx));
      absX = cx - DROP_W / 2;
      absY = screenH - bottomSafeY - DROP_H;
    } else if (edge === 'left') {
      absX = EDGE_MARGIN;
      absY = screenCy - DROP_H / 2;
      absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - DROP_H, absY));
    } else {
      absX = screenW - EDGE_MARGIN - DROP_W;
      absY = screenCy - DROP_H / 2;
      absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - DROP_H, absY));
    }

    // 인디케이터 원 중심 → 마커 방향 각도 (위=0, 시계방향)
    // 물방울 원 중심: absX + DROP_W/2, absY + DROP_H/2 + 6
    const indCx = absX + DROP_W / 2;
    const indCy = absY + DROP_H / 2 + 6;
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
            const aCx = a.absX + DROP_W / 2;
            const bCx = b.absX + DROP_W / 2;
            const dx = aCx - bCx;
            const push = (DROP_W + MIN_GAP - Math.abs(dx)) / 2 + 1;
            const dir = dx >= 0 ? 1 : -1;
            a.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - DROP_W, a.absX + push * dir));
            b.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - DROP_W, b.absX - push * dir));
          } else {
            // Y축으로 분리
            const aCy = a.absY + DROP_H / 2;
            const bCy = b.absY + DROP_H / 2;
            const dy = aCy - bCy;
            const push = (DROP_H + MIN_GAP - Math.abs(dy)) / 2 + 1;
            const dir = dy >= 0 ? 1 : -1;
            a.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - DROP_H, a.absY + push * dir));
            b.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - DROP_H, b.absY - push * dir));
          }

          // 위치 변경 후 각도 재계산
          for (const ind of [a, b]) {
            const cx = ind.absX + DROP_W / 2;
            const cy = ind.absY + DROP_H / 2 + 6;
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
    const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

    // 물방울: 원 지름 36px + 꼬리 길이 20px → 전체 56x56 뷰박스
    // 기본 방향: 뾰족한 끝이 위(↑) → angleDeg 회전으로 실제 마커 방향을 가리킴
    const S = 56;          // 뷰박스 크기
    const cx = S / 2;      // 28
    const cy = S / 2;      // 28
    const r = 16;          // 원 반지름
    // 원 중심: 뷰박스 하단 쪽에 배치 (꼬리가 위로 나옴)
    const circleCy = cy + 6;   // 34
    const tipY = 4;            // 뾰족한 끝 (위쪽)

    // 물방울 path: 꼬리(tip)가 위, 원이 아래
    const dropPath = [
      `M ${cx} ${tipY}`,
      `C ${cx - 10} ${tipY + 14}, ${cx - r} ${circleCy - r * 0.6}, ${cx - r} ${circleCy}`,
      `A ${r} ${r} 0 1 0 ${cx + r} ${circleCy}`,
      `C ${cx + r} ${circleCy - r * 0.6}, ${cx + 10} ${tipY + 14}, ${cx} ${tipY}`,
      'Z'
    ].join(' ');

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
          left: `${absX}px`,
          top: `${absY}px`,
          transform: `rotate(${angleDeg}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        <svg
          width={S}
          height={S}
          viewBox={`0 0 ${S} ${S}`}
          style={{ display: 'block', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.20))' }}
        >
          {/* 물방울 배경 */}
          <path
            d={dropPath}
            fill="rgba(255,255,255,0.35)"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 숫자 — 원 중심에 배치, 회전 역방향 보정 */}
          <text
            x={cx}
            y={circleCy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight="800"
            fill="rgb(79,70,229)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            transform={`rotate(${-angleDeg}, ${cx}, ${circleCy})`}
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