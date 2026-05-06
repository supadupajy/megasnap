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

  const Btn = ({ dir }: { dir: Direction }) => {
    const count = counts[dir];
    const hasMarker = {
      top: counts.hasTop,
      bottom: counts.hasBottom,
      left: counts.hasLeft,
      right: counts.hasRight,
    }[dir];

    if (!hasMarker || count === 0) return null;

    const isVertical = dir === 'top' || dir === 'bottom';
    // 삼각형 SVG viewBox: 가로 TRI_BASE, 세로 TRI_H (top/bottom) 또는 반전 (left/right)
    const svgW = isVertical ? TRI_BASE : TRI_H;
    const svgH = isVertical ? TRI_H    : TRI_BASE;

    // 뾰족한 끝이 마커 방향을 향하도록 polygon points 정의
    // top:    뾰족한 끝 → 위 (0,0 꼭짓점)
    // bottom: 뾰족한 끝 → 아래 (밑변이 위)
    // left:   뾰족한 끝 → 왼쪽
    // right:  뾰족한 끝 → 오른쪽
    const points = {
      top:    `${TRI_BASE / 2},0 0,${TRI_H} ${TRI_BASE},${TRI_H}`,
      bottom: `0,0 ${TRI_BASE},0 ${TRI_BASE / 2},${TRI_H}`,
      left:   `0,${TRI_BASE / 2} ${TRI_H},0 ${TRI_H},${TRI_BASE}`,
      right:  `0,0 0,${TRI_BASE} ${TRI_H},${TRI_BASE / 2}`,
    }[dir];

    // 숫자 텍스트 위치 (삼각형 무게중심 근처)
    const textPos = {
      top:    { x: TRI_BASE / 2, y: TRI_H * 0.68 },
      bottom: { x: TRI_BASE / 2, y: TRI_H * 0.42 },
      left:   { x: TRI_H * 0.62, y: TRI_BASE / 2 },
      right:  { x: TRI_H * 0.38, y: TRI_BASE / 2 },
    }[dir];

    // ── 위치 계산 ──────────────────────────────────────────
    let styleLeft: number | undefined;
    let styleTop: number | undefined;
    let styleRight: number | undefined;
    let styleBottom: number | undefined;

    if (dir === 'top' || dir === 'bottom') {
      const avgLng = dir === 'top' ? (counts.topAvgLng ?? centerLng) : (counts.bottomAvgLng ?? centerLng);
      let cx = lngToRatioX(avgLng) * screenW;

      if (dir === 'bottom') {
        // 하단: 좌측 버튼(0~80px), 우측 버튼(screenW-80~screenW) 영역 회피
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
        // 좌측 버튼 영역 회피
        const btnTopY = screenH - leftBtnBottom;
        if (cy + svgH / 2 > btnTopY) {
          cy = btnTopY - svgH / 2 - 8;
        }
        cy = Math.max(topSafeY + svgH / 2, Math.min(screenH - bottomSafeY - svgH / 2, cy));
        styleLeft = EDGE_MARGIN;
        styleTop = cy - svgH / 2;
      } else {
        // 우측 버튼 영역 회피
        const btnTopY = screenH - rightBtnBottom;
        if (cy + svgH / 2 > btnTopY) {
          cy = btnTopY - svgH / 2 - 8;
        }
        cy = Math.max(topSafeY + svgH / 2, Math.min(screenH - bottomSafeY - svgH / 2, cy));
        styleRight = EDGE_MARGIN;
        styleTop = cy - svgH / 2;
      }
    }

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
          ...(styleLeft   !== undefined && { left:   `${styleLeft}px`   }),
          ...(styleTop    !== undefined && { top:    `${styleTop}px`    }),
          ...(styleRight  !== undefined && { right:  `${styleRight}px`  }),
          ...(styleBottom !== undefined && { bottom: `${styleBottom}px` }),
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
      <Btn dir="top" />
      <Btn dir="bottom" />
      <Btn dir="left" />
      <Btn dir="right" />
    </>
  );
};

export default OffScreenMarkerIndicator;
