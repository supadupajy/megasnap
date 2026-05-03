import React from 'react';
import { DirectionCounts } from '@/hooks/use-supabase-posts';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface OffScreenMarkerIndicatorProps {
  bounds: Bounds | null;
  onClickDirection: (dir: Direction) => void;
  // topOffset: 상단 버튼의 top CSS 값 (문자열 또는 숫자px)
  topOffset?: string | number;
  bottomOffset: number;
  dbCounts?: DirectionCounts | null;
}

export type Direction = 'top' | 'bottom' | 'left' | 'right';

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  bounds,
  onClickDirection,
  topOffset,
  bottomOffset,
  dbCounts,
}) => {
  if (!dbCounts) return null;

  const counts = dbCounts;
  const hasAny = counts.hasTop || counts.hasBottom || counts.hasLeft || counts.hasRight;
  if (!hasAny) return null;

  // 트렌딩 패널 접힌 높이(56px) + 패널 top(safe-area+74px) + 여백(8px)
  const topCss = topOffset !== undefined
    ? (typeof topOffset === 'number' ? `${topOffset}px` : topOffset)
    : 'calc(env(safe-area-inset-top, 0px) + 74px + 56px + 8px)';

  // 삼각형 아이콘 (채워진 작은 삼각형)
  const Triangle = ({ dir }: { dir: Direction }) => {
    const deg = { top: 0, right: 90, bottom: 180, left: 270 }[dir];
    return (
      <svg
        width="8" height="8"
        viewBox="0 0 10 10"
        style={{ transform: `rotate(${deg}deg)`, flexShrink: 0, display: 'block' }}
      >
        <polygon points="5,1 9,9 1,9" fill="rgb(79, 70, 229)" />
      </svg>
    );
  };

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

    const posStyle: React.CSSProperties = {};
    if (dir === 'top') {
      posStyle.top = topCss;
      posStyle.left = '50%';
      posStyle.transform = 'translateX(-50%)';
    } else if (dir === 'bottom') {
      posStyle.bottom = `calc(${bottomOffset}px + max(env(safe-area-inset-bottom, 0px), 8px) + 8px)`;
      posStyle.left = '50%';
      posStyle.transform = 'translateX(-50%)';
    } else if (dir === 'left') {
      posStyle.left = '16px';
      posStyle.top = '50%';
      posStyle.transform = 'translateY(-50%)';
    } else {
      posStyle.right = '16px';
      posStyle.top = '50%';
      posStyle.transform = 'translateY(-50%)';
    }

    return (
      <button
        onClick={() => onClickDirection(dir)}
        style={{
          position: 'fixed',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          height: '32px',
          paddingLeft: '14px',
          paddingRight: '14px',
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: 'rgb(79, 70, 229)',
          borderRadius: '999px',
          border: '1px solid rgba(200, 200, 210, 0.7)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          cursor: 'pointer',
          zIndex: 9000,
          lineHeight: 1,
          pointerEvents: 'auto',
          whiteSpace: 'nowrap',
          ...posStyle,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <Triangle dir={dir} />
        <span style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1, color: 'rgb(79, 70, 229)' }}>
          {count > 999 ? '999+' : count}
        </span>
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
