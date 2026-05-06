import React, { useEffect, useState } from 'react';
import { DirectionCounts } from '@/hooks/use-supabase-posts';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

export type Direction = 'top' | 'bottom' | 'left' | 'right';

interface OffScreenMarkerIndicatorProps {
  bounds: Bounds | null;
  onClickDirection: (dir: Direction) => void;
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

const S = 52;           // 버튼 크기
const EDGE_MARGIN = 14; // 가장자리 여백
const MAX_ANGLE = 45;   // 이 각도를 초과하면 인디케이터 위치를 이동

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds,
  onClickDirection,
  topOffset,
  bottomOffset,
  dbCounts,
}) => {
  const { w: screenW, h: screenH } = useWindowSize();

  if (!dbCounts || !bounds) return null;
  if (!dbCounts.top && !dbCounts.bottom && !dbCounts.left && !dbCounts.right) return null;

  const { sw, ne } = bounds;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

  const topSafeY = typeof topOffset === 'number' ? topOffset : 140;
  const bottomSafeY = bottomOffset + 8;

  // 화면 가용 영역 중앙
  const midX = screenW / 2;
  const midY = (topSafeY + (screenH - bottomSafeY)) / 2;

  // 위도/경도 → 화면 픽셀 (화면 밖도 포함)
  const toScreenX = (lng: number) => ((lng - sw.lng) / lngRange) * screenW;
  const toScreenY = (lat: number) => (1 - (lat - sw.lat) / latRange) * screenH;

  // 각 방향의 평균 마커 화면 좌표
  const avgScreenPos = (dir: Direction) => {
    const avgLat = dbCounts[`${dir}AvgLat` as keyof DirectionCounts] as number;
    const avgLng = dbCounts[`${dir}AvgLng` as keyof DirectionCounts] as number;
    return { x: toScreenX(avgLng), y: toScreenY(avgLat) };
  };

  // 방향별 인디케이터 위치 계산
  // - 기본은 가장자리 정중앙
  // - 마커 평균 위치가 45도를 초과하면 해당 축으로 인디케이터를 이동
  const getPosition = (dir: Direction): { left: number; top: number } => {
    const avg = avgScreenPos(dir);

    if (dir === 'top') {
      // 기본 X = midX, 마커가 좌우로 치우치면 X를 이동
      const baseX = midX - S / 2;
      const baseY = topSafeY;
      // 인디케이터 중심 → 마커까지의 각도
      const dx = avg.x - midX;
      const dy = avg.y - (topSafeY + S / 2);
      const angle = Math.abs(Math.atan2(dx, -dy) * 180 / Math.PI); // 위쪽=0
      if (angle > MAX_ANGLE) {
        // X를 마커 평균 위치로 이동 (화면 안쪽으로 클램프)
        const newX = clamp(avg.x - S / 2, EDGE_MARGIN, screenW - EDGE_MARGIN - S);
        return { left: newX, top: baseY };
      }
      return { left: baseX, top: baseY };
    }

    if (dir === 'bottom') {
      const baseX = midX - S / 2;
      const baseY = screenH - bottomSafeY - S;
      const dx = avg.x - midX;
      const dy = avg.y - (screenH - bottomSafeY - S / 2);
      const angle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI); // 아래쪽=0
      if (angle > MAX_ANGLE) {
        const newX = clamp(avg.x - S / 2, EDGE_MARGIN, screenW - EDGE_MARGIN - S);
        return { left: newX, top: baseY };
      }
      return { left: baseX, top: baseY };
    }

    if (dir === 'left') {
      const baseX = EDGE_MARGIN;
      const baseY = midY - S / 2;
      const dx = avg.x - (EDGE_MARGIN + S / 2);
      const dy = avg.y - midY;
      const angle = Math.abs(Math.atan2(dy, -dx) * 180 / Math.PI); // 왼쪽=0
      if (angle > MAX_ANGLE) {
        const newY = clamp(avg.y - S / 2, topSafeY, screenH - bottomSafeY - S);
        return { left: baseX, top: newY };
      }
      return { left: baseX, top: baseY };
    }

    // right
    const baseX = screenW - EDGE_MARGIN - S;
    const baseY = midY - S / 2;
    const dx = avg.x - (screenW - EDGE_MARGIN - S / 2);
    const dy = avg.y - midY;
    const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI); // 오른쪽=0
    if (angle > MAX_ANGLE) {
      const newY = clamp(avg.y - S / 2, topSafeY, screenH - bottomSafeY - S);
      return { left: baseX, top: newY };
    }
    return { left: baseX, top: baseY };
  };

  // 인디케이터 중심 → 마커 평균 위치 각도 (물방울 뾰족한 끝 방향)
  const getAngle = (dir: Direction, pos: { left: number; top: number }): number => {
    const avgLat = dbCounts[`${dir}AvgLat` as keyof DirectionCounts] as number;
    const avgLng = dbCounts[`${dir}AvgLng` as keyof DirectionCounts] as number;
    if (avgLat == null || avgLng == null) {
      return { top: 0, bottom: 180, left: 270, right: 90 }[dir];
    }
    const indCx = pos.left + S / 2;
    const indCy = pos.top + S / 2;
    const mX = toScreenX(avgLng);
    const mY = toScreenY(avgLat);
    const rad = Math.atan2(mX - indCx, -(mY - indCy));
    return (rad * 180) / Math.PI;
  };

  const dirs: Direction[] = ['top', 'bottom', 'left', 'right'];

  // 물방울 SVG 경로 (뾰족한 끝이 위↑ 기본)
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

  return (
    <>
      {dirs.map(dir => {
        const count = dbCounts[dir] as number;
        if (!count) return null;

        const pos = getPosition(dir);
        const angleDeg = getAngle(dir, pos);
        const label = count > 999 ? '999+' : String(count);
        const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

        return (
          <button
            key={dir}
            onClick={() => onClickDirection(dir)}
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
