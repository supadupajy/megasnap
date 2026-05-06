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

  // 방향별 인디케이터 위치 (가장자리 중앙 고정)
  const positions: Record<Direction, { left: number; top: number }> = {
    top:    { left: midX - S / 2, top: topSafeY },
    bottom: { left: midX - S / 2, top: screenH - bottomSafeY - S },
    left:   { left: EDGE_MARGIN,  top: midY - S / 2 },
    right:  { left: screenW - EDGE_MARGIN - S, top: midY - S / 2 },
  };

  // 각 방향의 평균 마커 위치 → 물방울 뾰족한 부분이 향할 각도 계산
  const getAngle = (dir: Direction): number => {
    const avgLat = dbCounts[`${dir}AvgLat` as keyof DirectionCounts] as number;
    const avgLng = dbCounts[`${dir}AvgLng` as keyof DirectionCounts] as number;
    if (avgLat == null || avgLng == null) {
      // fallback: 방향별 기본 각도
      return { top: 0, bottom: 180, left: 270, right: 90 }[dir];
    }
    const pos = positions[dir];
    const indCx = pos.left + S / 2;
    const indCy = pos.top + S / 2;
    const mX = toScreenX(avgLng);
    const mY = toScreenY(avgLat);
    // atan2: 위쪽=0, 시계방향
    const rad = Math.atan2(mX - indCx, -(mY - indCy));
    return (rad * 180) / Math.PI;
  };

  const dirs: Direction[] = ['top', 'bottom', 'left', 'right'];

  return (
    <>
      {dirs.map(dir => {
        const count = dbCounts[dir] as number;
        if (!count) return null;

        const pos = positions[dir];
        const angleDeg = getAngle(dir);
        const label = count > 999 ? '999+' : String(count);
        const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

        // 물방울: 뾰족한 끝이 위(↑) 기본, rotate로 방향 조정
        const cx = S / 2;
        const circleCy = S / 2 + 6; // 원 중심 (아래쪽)
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
