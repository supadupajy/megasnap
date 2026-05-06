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

// 삼각형 크기
const TRI_BASE = 56;
const TRI_H    = 48;
const EDGE_MARGIN = 16;
const MIN_GAP = 12; // 인디케이터 간 최소 간격 (px)

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

  const lngToRatioX = (lng: number) => (lng - sw.lng) / lngRange;
  const latToRatioY = (lat: number) => 1 - (lat - sw.lat) / latRange;

  // 각 인디케이터의 실제 픽셀 위치(절대 top/left)를 계산
  interface IndicatorInfo {
    dir: Direction;
    // 실제 화면 절대 좌표 (top-left 기준)
    absX: number; // left edge
    absY: number; // top edge
    svgW: number;
    svgH: number;
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

    const isVertical = dir === 'top' || dir === 'bottom';
    const svgW = isVertical ? TRI_BASE : TRI_H;
    const svgH = isVertical ? TRI_H    : TRI_BASE;

    let absX = 0;
    let absY = 0;

    if (dir === 'top' || dir === 'bottom') {
      const avgLng = dir === 'top' ? (counts.topAvgLng ?? centerLng) : (counts.bottomAvgLng ?? centerLng);
      let cx = lngToRatioX(avgLng) * screenW;

      if (dir === 'bottom') {
        const leftExclude = 80 + svgW / 2 + EDGE_MARGIN;
        const rightExclude = screenW - 80 - svgW / 2 - EDGE_MARGIN;
        cx = Math.max(leftExclude, Math.min(rightExclude, cx));
      } else {
        cx = Math.max(svgW / 2 + EDGE_MARGIN, Math.min(screenW - svgW / 2 - EDGE_MARGIN, cx));
      }

      absX = cx - svgW / 2;
      absY = dir === 'top'
        ? topSafeY
        : screenH - bottomSafeY - svgH; // bottom을 절대 top 좌표로 변환
    } else {
      const avgLat = dir === 'left' ? (counts.leftAvgLat ?? centerLat) : (counts.rightAvgLat ?? centerLat);
      let cy = latToRatioY(avgLat) * screenH;

      if (dir === 'left') {
        const btnTopY = screenH - leftBtnBottom;
        if (cy + svgH / 2 > btnTopY) cy = btnTopY - svgH / 2 - 8;
        cy = Math.max(topSafeY + svgH / 2, Math.min(screenH - bottomSafeY - svgH / 2, cy));
        absX = EDGE_MARGIN;
        absY = cy - svgH / 2;
      } else {
        const btnTopY = screenH - rightBtnBottom;
        if (cy + svgH / 2 > btnTopY) cy = btnTopY - svgH / 2 - 8;
        cy = Math.max(topSafeY + svgH / 2, Math.min(screenH - bottomSafeY - svgH / 2, cy));
        absX = screenW - EDGE_MARGIN - svgW; // right를 절대 left 좌표로 변환
        absY = cy - svgH / 2;
      }
    }

    indicators.push({ dir, absX, absY, svgW, svgH, count });
  }

  // ── 겹침 방지: 모든 쌍에 대해 실제 픽셀 겹침 체크 후 분리 ──────────
  // 최대 10회 반복하여 수렴
  for (let iter = 0; iter < 10; iter++) {
    let anyOverlap = false;

    for (let i = 0; i < indicators.length; i++) {
      for (let j = i + 1; j < indicators.length; j++) {
        const a = indicators[i];
        const b = indicators[j];

        // AABB 겹침 체크 (MIN_GAP 포함)
        const overlapX = a.absX < b.absX + b.svgW + MIN_GAP && a.absX + a.svgW + MIN_GAP > b.absX;
        const overlapY = a.absY < b.absY + b.svgH + MIN_GAP && a.absY + a.svgH + MIN_GAP > b.absY;

        if (!overlapX || !overlapY) continue;

        anyOverlap = true;

        // 두 인디케이터의 중심점
        const aCx = a.absX + a.svgW / 2;
        const aCy = a.absY + a.svgH / 2;
        const bCx = b.absX + b.svgW / 2;
        const bCy = b.absY + b.svgH / 2;

        // 분리 방향 결정: 각 인디케이터의 고정 축을 유지하면서 자유 축으로만 이동
        // top/bottom → X축으로만 이동 가능
        // left/right → Y축으로만 이동 가능
        const aIsHoriz = a.dir === 'top' || a.dir === 'bottom';
        const bIsHoriz = b.dir === 'top' || b.dir === 'bottom';

        if (aIsHoriz && bIsHoriz) {
          // 둘 다 수평 → X축으로 분리
          const dx = aCx - bCx;
          const needed = (a.svgW / 2 + b.svgW / 2 + MIN_GAP);
          const current = Math.abs(dx);
          const push = (needed - current) / 2 + 1;
          const dir = dx >= 0 ? 1 : -1;

          a.absX += push * dir;
          b.absX -= push * dir;

          // 화면 경계 클램핑
          a.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - a.svgW, a.absX));
          b.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - b.svgW, b.absX));
        } else if (!aIsHoriz && !bIsHoriz) {
          // 둘 다 수직 → Y축으로 분리
          const dy = aCy - bCy;
          const needed = (a.svgH / 2 + b.svgH / 2 + MIN_GAP);
          const current = Math.abs(dy);
          const push = (needed - current) / 2 + 1;
          const dir = dy >= 0 ? 1 : -1;

          a.absY += push * dir;
          b.absY -= push * dir;

          // 화면 경계 클램핑
          a.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - a.svgH, a.absY));
          b.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - b.svgH, b.absY));
        } else {
          // 수평+수직 혼합 (top+left, top+right, bottom+left, bottom+right)
          // 수평(top/bottom)은 X축으로만 이동, 수직(left/right)은 Y축으로만 이동
          const horiz = aIsHoriz ? a : b;
          const vert  = aIsHoriz ? b : a;

          // X축: horiz를 vert로부터 멀어지는 방향으로 밀기
          const xOverlap = Math.min(horiz.absX + horiz.svgW, vert.absX + vert.svgW)
                         - Math.max(horiz.absX, vert.absX);
          if (xOverlap > 0) {
            // vert가 left면 horiz 오른쪽으로, vert가 right면 horiz 왼쪽으로
            const pushX = vert.dir === 'left' ? xOverlap + MIN_GAP : -(xOverlap + MIN_GAP);
            horiz.absX += pushX;
            horiz.absX = Math.max(EDGE_MARGIN, Math.min(screenW - EDGE_MARGIN - horiz.svgW, horiz.absX));
          }

          // Y축: vert를 horiz로부터 멀어지는 방향으로 밀기
          const yOverlap = Math.min(horiz.absY + horiz.svgH, vert.absY + vert.svgH)
                         - Math.max(horiz.absY, vert.absY);
          if (yOverlap > 0) {
            // horiz가 top이면 vert 아래로, horiz가 bottom이면 vert 위로
            const pushY = horiz.dir === 'top' ? yOverlap + MIN_GAP : -(yOverlap + MIN_GAP);
            vert.absY += pushY;
            vert.absY = Math.max(topSafeY, Math.min(screenH - bottomSafeY - vert.svgH, vert.absY));
          }
        }
      }
    }

    if (!anyOverlap) break;
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────
  const Btn = ({ info }: { info: IndicatorInfo }) => {
    const { dir, absX, absY, svgW, svgH, count } = info;

    const points = {
      top:    `${TRI_BASE / 2},0 0,${TRI_H} ${TRI_BASE},${TRI_H}`,
      bottom: `0,0 ${TRI_BASE},0 ${TRI_BASE / 2},${TRI_H}`,
      left:   `0,${TRI_BASE / 2} ${TRI_H},0 ${TRI_H},${TRI_BASE}`,
      right:  `0,0 0,${TRI_BASE} ${TRI_H},${TRI_BASE / 2}`,
    }[dir];

    const textPos = {
      top:    { x: TRI_BASE / 2, y: TRI_H * 0.68 },
      bottom: { x: TRI_BASE / 2, y: TRI_H * 0.42 },
      left:   { x: TRI_H * 0.62, y: TRI_BASE / 2 },
      right:  { x: TRI_H * 0.38, y: TRI_BASE / 2 },
    }[dir];

    const label = count > 999 ? '999+' : String(count);
    const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : 13;

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
          width: `${svgW}px`,
          height: `${svgH}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          left: `${absX}px`,
          top: `${absY}px`,
        }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}
        >
          <polygon
            points={points}
            fill="rgba(255,255,255,0.82)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.5"
          />
          <text
            x={textPos.x}
            y={textPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight="800"
            fill="rgb(79,70,229)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
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