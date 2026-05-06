import React, { useEffect, useState } from 'react';
import { DirectionCounts } from '@/hooks/use-supabase-posts';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface OffScreenMarkerIndicatorProps {
  bounds: Bounds | null;
  onClickDirection: (dir: Direction) => void;
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

// 삼각형은 정사각형 뷰박스 안에서 위쪽을 향하는 기본 모양 → rotate로 방향 조정
const TRI_SIZE = 56; // 버튼 크기 (px)
const EDGE_MARGIN = 16;
const MIN_GAP = 12;

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds,
  onClickDirection,
  topOffset,
  bottomOffset,
  dbCounts,
}) => {
  const { w: screenW, h: screenH } = useWindowSize();

  if (!dbCounts || !bounds) return null;

  const counts = dbCounts;
  const hasAny = counts.hasTop || counts.hasBottom || counts.hasLeft || counts.hasRight;
  if (!hasAny) return null;

  const { sw, ne } = bounds;
  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

  const topSafeY = topOffset !== undefined
    ? (typeof topOffset === 'number' ? topOffset : 140)
    : 140;
  const bottomSafeY = bottomOffset + 8;

  const leftBtnBottom = bottomSafeY + 168;
  const rightBtnBottom = bottomSafeY + 144;

  // 위도/경도 → 화면 픽셀 비율
  const lngToX = (lng: number) => ((lng - sw.lng) / lngRange) * screenW;
  const latToY = (lat: number) => (1 - (lat - sw.lat) / latRange) * screenH;

  interface IndicatorInfo {
    dir: Direction;
    absX: number; // 버튼 left edge
    absY: number; // 버튼 top edge
    angleDeg: number; // 삼각형 꼭지점이 향하는 각도 (0 = 위, 시계방향)
    count: number;
  }

  const indicators: IndicatorInfo[] = [];

  const dirs: Direction[] = ['top', 'bottom', 'left', 'right'];

  for (const dir of dirs) {
    const count = counts[dir];
    const hasMarker = {
      top: counts.hasTop,
      bottom: counts.hasBottom,
      left: counts.hasLeft,
      right: counts.hasRight,
    }[dir];

    if (!hasMarker || count === 0) continue;

    // 마커 평균 위치의 화면 픽셀 좌표
    const avgLng = dir === 'top'    ? (counts.topAvgLng    ?? centerLng)
                 : dir === 'bottom' ? (counts.bottomAvgLng ?? centerLng)
                 : dir === 'left'   ? (counts.leftAvgLng   ?? centerLng)
                 :                    (counts.rightAvgLng  ?? centerLng);
    const avgLat = dir === 'top'    ? (counts.topAvgLat    ?? centerLat)
                 : dir === 'bottom' ? (counts.bottomAvgLat ?? centerLat)
                 : dir === 'left'   ? (counts.leftAvgLat   ?? centerLat)
                 :                    (counts.rightAvgLat  ?? centerLat);

    const markerScreenX = lngToX(avgLng);
    const markerScreenY = latToY(avgLat);

    // 인디케이터 초기 위치 (화면 가장자리에 고정)
    let absX = 0;
    let absY = 0;

    if (dir === 'top') {
      // 상단 가장자리: X는 마커 평균 경도 기준, Y는 topSafeY
      let cx = markerScreenX;
      cx = Math.max(TRI_SIZE / 2 + EDGE_MARGIN, Math.min(screenW - TRI_SIZE / 2 - EDGE_MARGIN, cx));
      absX = cx - TRI_SIZE / 2;
      absY = topSafeY;
    } else if (dir === 'bottom') {
      // 하단 가장자리
      const leftExclude = 80 + TRI_SIZE / 2 + EDGE_MARGIN;
      const rightExclude = screenW - 80 - TRI_SIZE / 2 - EDGE_MARGIN;
      let cx = markerScreenX;
      cx = Math.max(leftExclude, Math.min(rightExclude, cx));
      absX = cx - TRI_SIZE / 2;
      absY = screenH - bottomSafeY - TRI_SIZE;
    } else if (dir === 'left') {
      // 좌측 가장자리
      const btnTopY = screenH - leftBtnBottom;
      let cy = markerScreenY;
      if (cy + TRI_SIZE / 2 > btnTopY) cy = btnTopY - TRI_SIZE / 2 - 8;
      cy = Math.max(topSafeY + TRI_SIZE / 2, Math.min(screenH - bottomSafeY - TRI_SIZE / 2, cy));
      absX = EDGE_MARGIN;
      absY = cy - TRI_SIZE / 2;
    } else {
      // 우측 가장자리
      const btnTopY = screenH - rightBtnBottom;
      let cy = markerScreenY;
      if (cy + TRI_SIZE / 2 > btnTopY) cy = btnTopY - TRI_SIZE / 2 - 8;
      cy = Math.max(topSafeY + TRI_SIZE / 2, Math.min(screenH - bottomSafeY - TRI_SIZE / 2, cy));
      absX = screenW - EDGE_MARGIN - TRI_SIZE;
      absY = cy - TRI_SIZE / 2;
    }

    // 인디케이터 중심에서 마커 화면 좌표까지의 각도 계산
    const indicatorCx = absX + TRI_SIZE / 2;
    const indicatorCy = absY + TRI_SIZE / 2;
    const dx = markerScreenX - indicatorCx;
    const dy = markerScreenY - indicatorCy;
    // atan2: 오른쪽=0, 아래=90, 왼쪽=180, 위=-90 (라디안)
    // SVG 삼각형 기본 방향이 "위쪽"이므로 -90도 오프셋
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI + 90; // +90 = 위쪽 기준으로 변환

    indicators.push({ dir, absX, absY, angleDeg, count });
  }

  // ── 겹침 방지: 모든 쌍에 대해 실제 픽셀 겹침 체크 후 분리 ──────────
  for (let iter = 0; iter < 10; iter++) {
    let anyOverlap = false;

    for (let i = 0; i < indicators.length; i++) {
      for (let j = i + 1; j < indicators.length; j++) {
        const a = indicators[i];
        const b = indicators[j];

        const overlapX = a.absX < b.absX + TRI_SIZE + MIN_GAP && a.absX + TRI_SIZE + MIN_GAP > b.absX;
        const overlapY = a.absY < b.absY + TRI_SIZE + MIN_GAP && a.absY + TRI_SIZE + MIN_GAP > b.absY;

        if (!overlapX || !overlapY) continue;

        anyOverlap = true;

        const aIsHoriz = a.dir === 'top' || a.dir === 'bottom';
        const bIsHoriz = b.dir === 'top' || b.dir === 'bottom';

        if (aIsHoriz && bIsHoriz) {
          // 둘 다 top/bottom → X축으로 분리
          const aCx = a.absX + TRI_SIZE / 2;
          const bCx = b.absX + TRI_SIZE / 2;
          const dx = aCx - bCx;
          const needed = TRI_SIZE + MIN_GAP;
          const push = (needed - Math.abs(dx)) / 2 + 1;
          const pushDir = dx >= 0 ? 1 : -1;
          a.absX += push * pushDir;
          b.absX -= push * pushDir;
          a.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, a.absX));
          b.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, b.absX));
        } else if (!aIsHoriz && !bIsHoriz) {
          // 둘 다 left/right → Y축으로 분리
          const aCy = a.absY + TRI_SIZE / 2;
          const bCy = b.absY + TRI_SIZE / 2;
          const dy = aCy - bCy;
          const needed = TRI_SIZE + MIN_GAP;
          const push = (needed - Math.abs(dy)) / 2 + 1;
          const pushDir = dy >= 0 ? 1 : -1;
          a.absY += push * pushDir;
          b.absY -= push * pushDir;
          a.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, a.absY));
          b.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, b.absY));
        } else {
          // 혼합 (top+left, top+right, bottom+left, bottom+right)
          const horiz = aIsHoriz ? a : b;
          const vert  = aIsHoriz ? b : a;

          // X축: horiz를 vert 반대 방향으로 밀기
          const xOverlap = Math.min(horiz.absX + TRI_SIZE, vert.absX + TRI_SIZE)
                         - Math.max(horiz.absX, vert.absX);
          if (xOverlap > 0) {
            const pushX = vert.dir === 'left' ? xOverlap + MIN_GAP : -(xOverlap + MIN_GAP);
            horiz.absX += pushX;
            horiz.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - TRI_SIZE, horiz.absX));
          }

          // Y축: vert를 horiz 반대 방향으로 밀기
          const yOverlap = Math.min(horiz.absY + TRI_SIZE, vert.absY + TRI_SIZE)
                         - Math.max(horiz.absY, vert.absY);
          if (yOverlap > 0) {
            const pushY = horiz.dir === 'top' ? yOverlap + MIN_GAP : -(yOverlap + MIN_GAP);
            vert.absY += pushY;
            vert.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - TRI_SIZE, vert.absY));
          }
        }

        // 위치가 바뀌었으므로 각도 재계산
        for (const ind of [a, b]) {
          const mLng = ind.dir === 'top'    ? (counts.topAvgLng    ?? centerLng)
                     : ind.dir === 'bottom' ? (counts.bottomAvgLng ?? centerLng)
                     : ind.dir === 'left'   ? (counts.leftAvgLng   ?? centerLng)
                     :                        (counts.rightAvgLng  ?? centerLng);
          const mLat = ind.dir === 'top'    ? (counts.topAvgLat    ?? centerLat)
                     : ind.dir === 'bottom' ? (counts.bottomAvgLat ?? centerLat)
                     : ind.dir === 'left'   ? (counts.leftAvgLat   ?? centerLat)
                     :                        (counts.rightAvgLat  ?? centerLat);
          const mX = lngToX(mLng);
          const mY = latToY(mLat);
          const cx = ind.absX + TRI_SIZE / 2;
          const cy = ind.absY + TRI_SIZE / 2;
          const angleRad = Math.atan2(mY - cy, mX - cx);
          ind.angleDeg = (angleRad * 180) / Math.PI + 90;
        }
      }
    }

    if (!anyOverlap) break;
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────
  const Btn = ({ info }: { info: IndicatorInfo }) => {
    const { dir, absX, absY, angleDeg, count } = info;

    const label = count > 999 ? '999+' : String(count);
    const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 10 : 12;

    // 삼각형: 위쪽을 향하는 기본 모양, rotate로 방향 조정
    // 뷰박스 56x56, 꼭지점이 위(중앙 상단)를 향함
    const cx = TRI_SIZE / 2;
    const cy = TRI_SIZE / 2;
    const tipY = 4;           // 꼭지점 Y (위쪽)
    const baseY = TRI_SIZE - 4; // 밑변 Y (아래쪽)
    const halfBase = 22;      // 밑변 반폭

    const triPoints = `${cx},${tipY} ${cx - halfBase},${baseY} ${cx + halfBase},${baseY}`;

    // 숫자는 삼각형 무게중심 근처 (위쪽 꼭지점 기준으로 아래 2/3 지점)
    const textY = tipY + (baseY - tipY) * 0.62;

    return (
      <button
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
          width: `${TRI_SIZE}px`,
          height: `${TRI_SIZE}px`,
          left: `${absX}px`,
          top: `${absY}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          clipPath: `polygon(50% ${4 / TRI_SIZE * 100}%, ${(TRI_SIZE / 2 - 22) / TRI_SIZE * 100}% ${(TRI_SIZE - 4) / TRI_SIZE * 100}%, ${(TRI_SIZE / 2 + 22) / TRI_SIZE * 100}% ${(TRI_SIZE - 4) / TRI_SIZE * 100}%)`,
          transform: `rotate(${angleDeg}deg)`,
        }}
      >
        <svg
          width={TRI_SIZE}
          height={TRI_SIZE}
          viewBox={`0 0 ${TRI_SIZE} ${TRI_SIZE}`}
          style={{
            display: 'block',
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.10))',
            transform: `rotate(0deg)`,
          }}
        >
          <polygon
            points={triPoints}
            fill="rgba(255,255,255,0.30)"
            stroke="rgba(255,255,255,0.50)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 숫자는 회전 반대 방향으로 보정해서 항상 읽기 쉽게 */}
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
      {indicators.map(info => (
        <Btn key={info.dir} info={info} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;