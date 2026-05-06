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
const TRI_BASE = 56;  // 밑변 길이 (px)
const TRI_H    = 48;  // 높이 (px)
const EDGE_MARGIN = 16;
// 같은 축 인디케이터 간 최소 간격 (px)
const MIN_GAP = 8;

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

  // safe zone
  const topSafeY = topOffset !== undefined
    ? (typeof topOffset === 'number' ? topOffset : 140)
    : 140;
  const bottomSafeY = bottomOffset + 8;

  // 좌측 버튼 영역 (필터+검색+위치 3개, 각 48px + gap 8px*2 = 160px)
  const leftBtnBottom = bottomSafeY + 168;
  // 우측 버튼 영역 (새로고침 56px + gap 16px + 여기보기 64px = 136px)
  const rightBtnBottom = bottomSafeY + 144;

  const lngToRatioX = (lng: number) => (lng - sw.lng) / lngRange;
  const latToRatioY = (lat: number) => 1 - (lat - sw.lat) / latRange;

  // ── 위치 계산 (방향별) ──────────────────────────────────────────────
  interface IndicatorPos {
    dir: Direction;
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
    svgW: number;
    svgH: number;
    count: number;
  }

  const positions: IndicatorPos[] = [];

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

    let styleLeft: number | undefined;
    let styleTop: number | undefined;
    let styleRight: number | undefined;
    let styleBottom: number | undefined;

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

      styleLeft = cx - svgW / 2;
      if (dir === 'top') {
        styleTop = topSafeY;
      } else {
        styleBottom = bottomSafeY;
      }
    } else {
      const avgLat = dir === 'left' ? (counts.leftAvgLat ?? centerLat) : (counts.rightAvgLat ?? centerLat);
      let cy = latToRatioY(avgLat) * screenH;

      if (dir === 'left') {
        const btnTopY = screenH - leftBtnBottom;
        if (cy + svgH / 2 > btnTopY) {
          cy = btnTopY - svgH / 2 - 8;
        }
        cy = Math.max(topSafeY + svgH / 2, Math.min(screenH - bottomSafeY - svgH / 2, cy));
        styleLeft = EDGE_MARGIN;
        styleTop = cy - svgH / 2;
      } else {
        const btnTopY = screenH - rightBtnBottom;
        if (cy + svgH / 2 > btnTopY) {
          cy = btnTopY - svgH / 2 - 8;
        }
        cy = Math.max(topSafeY + svgH / 2, Math.min(screenH - bottomSafeY - svgH / 2, cy));
        styleRight = EDGE_MARGIN;
        styleTop = cy - svgH / 2;
      }
    }

    positions.push({ dir, left: styleLeft, top: styleTop, right: styleRight, bottom: styleBottom, svgW, svgH, count });
  }

  // ── 겹침 방지: 같은 축(수평/수직) 인디케이터끼리 간격 보장 ──────────
  // top/bottom은 X축(left)으로 겹침 체크
  // left/right는 Y축(top)으로 겹침 체크

  // top과 bottom이 모두 있을 때 X축 겹침 방지
  const topPos = positions.find(p => p.dir === 'top');
  const bottomPos = positions.find(p => p.dir === 'bottom');

  if (topPos && bottomPos && topPos.left !== undefined && bottomPos.left !== undefined) {
    const topL = topPos.left;
    const botL = bottomPos.left;
    const topR = topL + topPos.svgW;
    const botR = botL + bottomPos.svgW;

    // X축 겹침 여부 확인
    const overlapX = topL < botR + MIN_GAP && topR + MIN_GAP > botL;
    if (overlapX) {
      // 두 인디케이터를 겹치지 않도록 좌우로 분리
      const centerX = (topL + topPos.svgW / 2 + botL + bottomPos.svgW / 2) / 2;
      const halfGap = (topPos.svgW / 2 + bottomPos.svgW / 2 + MIN_GAP) / 2;

      let newTopCx = centerX - halfGap;
      let newBotCx = centerX + halfGap;

      // 화면 경계 클램핑
      const minX = EDGE_MARGIN;
      const maxX = screenW - EDGE_MARGIN;
      newTopCx = Math.max(minX + topPos.svgW / 2, Math.min(maxX - topPos.svgW / 2, newTopCx));
      newBotCx = Math.max(minX + bottomPos.svgW / 2, Math.min(maxX - bottomPos.svgW / 2, newBotCx));

      topPos.left = newTopCx - topPos.svgW / 2;
      bottomPos.left = newBotCx - bottomPos.svgW / 2;
    }
  }

  // left와 right가 모두 있을 때 Y축 겹침 방지
  const leftPos = positions.find(p => p.dir === 'left');
  const rightPos = positions.find(p => p.dir === 'right');

  if (leftPos && rightPos && leftPos.top !== undefined && rightPos.top !== undefined) {
    const leftT = leftPos.top;
    const rightT = rightPos.top;
    const leftB = leftT + leftPos.svgH;
    const rightB = rightT + rightPos.svgH;

    const overlapY = leftT < rightB + MIN_GAP && leftB + MIN_GAP > rightT;
    if (overlapY) {
      const centerY = (leftT + leftPos.svgH / 2 + rightT + rightPos.svgH / 2) / 2;
      const halfGap = (leftPos.svgH / 2 + rightPos.svgH / 2 + MIN_GAP) / 2;

      let newLeftCy = centerY - halfGap;
      let newRightCy = centerY + halfGap;

      const minY = topSafeY;
      const maxY = screenH - bottomSafeY;
      newLeftCy = Math.max(minY + leftPos.svgH / 2, Math.min(maxY - leftPos.svgH / 2, newLeftCy));
      newRightCy = Math.max(minY + rightPos.svgH / 2, Math.min(maxY - rightPos.svgH / 2, newRightCy));

      leftPos.top = newLeftCy - leftPos.svgH / 2;
      rightPos.top = newRightCy - rightPos.svgH / 2;
    }
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────
  const Btn = ({ pos }: { pos: IndicatorPos }) => {
    const { dir, svgW, svgH, count } = pos;
    const isVertical = dir === 'top' || dir === 'bottom';

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
          transition: 'top 0.3s ease, bottom 0.3s ease, left 0.3s ease, right 0.3s ease',
          ...(pos.left   !== undefined && { left:   `${pos.left}px`   }),
          ...(pos.top    !== undefined && { top:    `${pos.top}px`    }),
          ...(pos.right  !== undefined && { right:  `${pos.right}px`  }),
          ...(pos.bottom !== undefined && { bottom: `${pos.bottom}px` }),
        }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}
        >
          {/* 삼각형 배경 */}
          <polygon
            points={points}
            fill="rgba(255,255,255,0.82)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.5"
          />
          {/* 숫자 */}
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
      {positions.map(pos => (
        <Btn key={pos.dir} pos={pos} />
      ))}
    </>
  );
};

export default OffScreenMarkerIndicator;
