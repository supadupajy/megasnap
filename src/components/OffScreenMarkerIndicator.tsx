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

  const topSafeY = typeof topOffset === 'number' ? topOffset : 160;
  // bottomSafeY: 화면 하단에서 이 픽셀만큼 위에 인디케이터 하단이 위치
  const bottomSafeY = bottomOffset;

  const midX = screenW / 2;
  const midY = (topSafeY + (screenH - bottomSafeY)) / 2;

  // 위도/경도 → 화면 픽셀
  const toScreenX = (lng: number) => ((lng - centerLng) / lngRange) * screenW + midX;
  const toScreenY = (lat: number) => (-(lat - centerLat) / latRange) * screenH + screenH / 2;

  // 인디케이터 고정 위치 (항상 가장자리 정중앙)
  const positions: Record<Direction, { left: number; top: number }> = {
    top:    { left: midX - S / 2, top: topSafeY },
    bottom: { left: midX - S / 2, top: screenH - bottomSafeY - S },
    left:   { left: EDGE_MARGIN,  top: midY - S / 2 },
    right:  { left: screenW - EDGE_MARGIN - S, top: midY - S / 2 },
  };

  // 인디케이터 중심 좌표
  const indCenter: Record<Direction, { x: number; y: number }> = {
    top:    { x: midX, y: topSafeY + S / 2 },
    bottom: { x: midX, y: screenH - bottomSafeY - S / 2 },
    left:   { x: EDGE_MARGIN + S / 2, y: midY },
    right:  { x: screenW - EDGE_MARGIN - S / 2, y: midY },
  };

  // 각 마커를 인디케이터 위치 기준으로 분류
  // - 인디케이터에서 마커까지의 각도가 45도 이내인 방향으로 배정
  // - 각 방향 인디케이터의 "정면" 방향: top=위, bottom=아래, left=왼쪽, right=오른쪽
  // - 정면 기준 ±45도 이내면 해당 방향, 초과하면 인접 방향으로 재배정
  const classified: Record<Direction, { lat: number; lng: number }[]> = {
    top: [], bottom: [], left: [], right: [],
  };

  for (const p of allPoints) {
    const px = toScreenX(p.lng);
    const py = toScreenY(p.lat);

    // 각 방향 인디케이터에서 마커까지의 각도 계산 (정면 방향 기준)
    // top 인디케이터: 정면=위(↑), 각도=0이면 정면
    // bottom 인디케이터: 정면=아래(↓)
    // left 인디케이터: 정면=왼쪽(←)
    // right 인디케이터: 정면=오른쪽(→)

    const scores: Record<Direction, number> = {
      top:    0,
      bottom: 0,
      left:   0,
      right:  0,
    };

    // top: 인디케이터에서 마커까지 벡터의 "위쪽 정렬도" = -dy (위쪽이 음수 y)
    const topInd = indCenter.top;
    const botInd = indCenter.bottom;
    const leftInd = indCenter.left;
    const rightInd = indCenter.right;

    // 각 인디케이터에서 마커까지의 각도 (정면 방향 기준 절대값)
    const angleFromFront = (indX: number, indY: number, dir: Direction): number => {
      const dx = px - indX;
      const dy = py - indY;
      // 정면 방향 벡터
      const frontVec = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      // 내적으로 각도 계산
      const dot = dx * frontVec[0] + dy * frontVec[1];
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) return 0;
      const cosA = Math.max(-1, Math.min(1, dot / mag));
      return Math.acos(cosA) * 180 / Math.PI; // 0~180도
    };

    scores.top    = angleFromFront(topInd.x,   topInd.y,   'top');
    scores.bottom = angleFromFront(botInd.x,   botInd.y,   'bottom');
    scores.left   = angleFromFront(leftInd.x,  leftInd.y,  'left');
    scores.right  = angleFromFront(rightInd.x, rightInd.y, 'right');

    // 각도가 가장 작은 방향 = 해당 인디케이터의 정면에 가장 가까운 방향
    // 단, 45도 이내인 방향만 후보로 삼음
    const candidates = (Object.keys(scores) as Direction[]).filter(d => scores[d] <= 45);

    let bestDir: Direction;
    if (candidates.length > 0) {
      bestDir = candidates.reduce((a, b) => scores[a] < scores[b] ? a : b);
    } else {
      // 45도 이내인 방향이 없으면 가장 각도가 작은 방향
      bestDir = (Object.keys(scores) as Direction[]).reduce((a, b) => scores[a] < scores[b] ? a : b);
    }

    classified[bestDir].push(p);
  }

  // ── 병합 로직: 물방울 각도가 비슷한 인디케이터끼리 합치기 ──
  // 각 방향의 물방울 각도 계산
  const getAngleDeg = (dir: Direction, pts: { lat: number; lng: number }[]): number | null => {
    if (pts.length === 0) return null;
    const ind = indCenter[dir];
    const avgLat = avg(pts, 'lat', centerLat);
    const avgLng = avg(pts, 'lng', centerLng);
    const mX = toScreenX(avgLng);
    const mY = toScreenY(avgLat);
    const rad = Math.atan2(mX - ind.x, -(mY - ind.y));
    return (rad * 180) / Math.PI;
  };

  // 각도 차이 계산 (0~180)
  const angleDiff = (a: number, b: number): number => {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  };

  // 병합: 각도 차이 < 45도인 인디케이터 쌍을 합침
  // 더 많은 마커를 가진 방향이 대표, 나머지는 흡수
  const MERGE_ANGLE_THRESHOLD = 45;
  const merged = { ...classified }; // 복사본

  const dirsToCheck: Direction[] = ['top', 'bottom', 'left', 'right'];
  // 반복적으로 병합 (최대 3회)
  for (let iter = 0; iter < 3; iter++) {
    let didMerge = false;
    const active = dirsToCheck.filter(d => merged[d].length > 0);
    for (let i = 0; i < active.length && !didMerge; i++) {
      for (let j = i + 1; j < active.length && !didMerge; j++) {
        const dA = active[i];
        const dB = active[j];
        const angA = getAngleDeg(dA, merged[dA]);
        const angB = getAngleDeg(dB, merged[dB]);
        if (angA === null || angB === null) continue;
        if (angleDiff(angA, angB) < MERGE_ANGLE_THRESHOLD) {
          // 더 많은 마커를 가진 방향이 대표
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
        const pts = merged[dir];
        if (pts.length === 0) return null;

        const pos = positions[dir];
        const ind = indCenter[dir];

        // 재분류된 마커들의 평균 위치 → 물방울 각도
        const avgLat = avg(pts, 'lat', centerLat);
        const avgLng = avg(pts, 'lng', centerLng);
        const mX = toScreenX(avgLng);
        const mY = toScreenY(avgLat);
        // 인디케이터 중심 → 마커 방향 (위쪽=0, 시계방향)
        const rad = Math.atan2(mX - ind.x, -(mY - ind.y));
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
              filter: 'drop-shadow(0 4px 12px rgba(79,70,229,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.18))',
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

              {/* glass 배경: blur는 SVG foreignObject로 */}
              <foreignObject
                x="0" y="0"
                width={S} height={S}
                clipPath={`url(#drop-clip-${dir})`}
              >
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

              {/* 테두리 */}
              <path
                d={dropPath}
                fill="none"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* 숫자 */}
              <text
                x={cx}
                y={circleCy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight="900"
                fill="rgb(20,20,20)"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                style={{ textShadow: 'none' }}
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