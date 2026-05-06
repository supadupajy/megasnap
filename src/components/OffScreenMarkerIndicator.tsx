import React, { useEffect, useState } from 'react';
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

// 화면 중심 기준으로 각 마커 포인트를 4방향 + 코너 재분류
// 각도가 45도 이내면 해당 방향, 초과하면 인접 방향으로 재분류
function reclassifyPoints(
  points: { lat: number; lng: number }[],
  centerLat: number,
  centerLng: number,
  latRange: number,
  lngRange: number,
  screenW: number,
  screenH: number,
  topSafeY: number,
  bottomSafeY: number,
): Record<Direction, { lat: number; lng: number }[]> {
  const result: Record<Direction, { lat: number; lng: number }[]> = {
    top: [], bottom: [], left: [], right: [],
  };

  // 화면 가용 영역 중앙 (인디케이터가 놓일 위치의 중심)
  const midX = screenW / 2;
  const midY = (topSafeY + (screenH - bottomSafeY)) / 2;

  const toScreenX = (lng: number) => ((lng - centerLng) / lngRange) * screenW + screenW / 2;
  const toScreenY = (lat: number) => (-(lat - centerLat) / latRange) * screenH + screenH / 2;

  // 각 방향 인디케이터 중심 좌표
  const indCenter: Record<Direction, { x: number; y: number }> = {
    top:    { x: midX, y: topSafeY + S / 2 },
    bottom: { x: midX, y: screenH - bottomSafeY - S / 2 },
    left:   { x: EDGE_MARGIN + S / 2, y: midY },
    right:  { x: screenW - EDGE_MARGIN - S / 2, y: midY },
  };

  for (const p of points) {
    const px = toScreenX(p.lng);
    const py = toScreenY(p.lat);

    // 화면 중심 기준 dx, dy
    const dx = px - screenW / 2;
    const dy = py - screenH / 2;

    // 1차 분류: 45도 섹터 (기존과 동일)
    let primary: Direction;
    if (Math.abs(dy) >= Math.abs(dx)) {
      primary = dy < 0 ? 'top' : 'bottom';
    } else {
      primary = dx < 0 ? 'left' : 'right';
    }

    // 2차 검증: 해당 방향 인디케이터 중심 → 마커까지의 각도가 45도 초과인지 확인
    const ind = indCenter[primary];
    const adx = px - ind.x;
    const ady = py - ind.y;

    let finalDir = primary;

    if (primary === 'top' || primary === 'bottom') {
      // top/bottom: 좌우 각도 확인 (수직 기준 ±45도)
      const angleFromVertical = Math.abs(Math.atan2(adx, Math.abs(ady)) * 180 / Math.PI);
      if (angleFromVertical > 45) {
        // 좌우로 치우침 → left 또는 right로 재분류
        finalDir = adx < 0 ? 'left' : 'right';
      }
    } else {
      // left/right: 상하 각도 확인 (수평 기준 ±45도)
      const angleFromHorizontal = Math.abs(Math.atan2(ady, Math.abs(adx)) * 180 / Math.PI);
      if (angleFromHorizontal > 45) {
        // 상하로 치우침 → top 또는 bottom으로 재분류
        finalDir = ady < 0 ? 'top' : 'bottom';
      }
    }

    result[finalDir].push(p);
  }

  return result;
}

const avg = (pts: { lat: number; lng: number }[], axis: 'lat' | 'lng', fallback: number) =>
  pts.length > 0 ? pts.reduce((s, p) => s + p[axis], 0) / pts.length : fallback;

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds,
  onClickDirection,
  topOffset,
  bottomOffset,
  dbCounts,
}) => {
  const { w: screenW, h: screenH } = useWindowSize();

  if (!dbCounts || !bounds) return null;

  const allPoints = [
    ...(dbCounts.topPoints || []),
    ...(dbCounts.bottomPoints || []),
    ...(dbCounts.leftPoints || []),
    ...(dbCounts.rightPoints || []),
  ];
  if (allPoints.length === 0) return null;

  const { sw, ne } = bounds;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;
  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;

  const topSafeY = typeof topOffset === 'number' ? topOffset : 140;
  const bottomSafeY = bottomOffset + 8;

  // 모든 화면 밖 마커를 재분류
  const reclassified = reclassifyPoints(
    allPoints, centerLat, centerLng, latRange, lngRange,
    screenW, screenH, topSafeY, bottomSafeY,
  );

  const midX = screenW / 2;
  const midY = (topSafeY + (screenH - bottomSafeY)) / 2;

  // 인디케이터 고정 위치 (항상 가장자리 정중앙)
  const positions: Record<Direction, { left: number; top: number }> = {
    top:    { left: midX - S / 2, top: topSafeY },
    bottom: { left: midX - S / 2, top: screenH - bottomSafeY - S },
    left:   { left: EDGE_MARGIN,  top: midY - S / 2 },
    right:  { left: screenW - EDGE_MARGIN - S, top: midY - S / 2 },
  };

  const toScreenX = (lng: number) => ((lng - centerLng) / lngRange) * screenW + screenW / 2;
  const toScreenY = (lat: number) => (-(lat - centerLat) / latRange) * screenH + screenH / 2;

  // 물방울 SVG (뾰족한 끝이 위↑ 기본)
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

  const dirs: Direction[] = ['top', 'bottom', 'left', 'right'];

  return (
    <>
      {dirs.map(dir => {
        const pts = reclassified[dir];
        if (pts.length === 0) return null;

        const pos = positions[dir];
        const indCx = pos.left + S / 2;
        const indCy = pos.top + S / 2;

        // 재분류된 마커들의 평균 위치 → 물방울 각도
        const avgLat = avg(pts, 'lat', centerLat);
        const avgLng = avg(pts, 'lng', centerLng);
        const mX = toScreenX(avgLng);
        const mY = toScreenY(avgLat);
        const rad = Math.atan2(mX - indCx, -(mY - indCy));
        const angleDeg = (rad * 180) / Math.PI;

        const count = pts.length;
        const label = count > 999 ? '999+' : String(count);
        const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

        return (
          <button
            key={dir}
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
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              transform: `rotate(${angleDeg}deg)`,
              transformOrigin: `${cx}px ${S / 2}px`,
            }}
          >
            <svg
              width={S}
              height={S}
              viewBox={`0 0 ${S} ${S}`}
              style={{ display: 'block', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.22))' }}
            >
              <path
                d={dropPath}
                fill="rgba(255,255,255,0.35)"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
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
      })}
    </>
  );
};

export default OffScreenMarkerIndicator;