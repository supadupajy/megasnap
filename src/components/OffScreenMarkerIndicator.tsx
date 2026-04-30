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
  const hasAny = Object.values(counts).some(c => c > 0);
  if (!hasAny) return null;

  // 트렌딩 패널 접힌 높이(56px) + 패널 top(safe-area+74px) + 여백(8px)
  const topCss = topOffset !== undefined
    ? (typeof topOffset === 'number' ? `${topOffset}px` : topOffset)
    : 'calc(env(safe-area-inset-top, 0px) + 74px + 56px + 8px)';

  const Arrow = ({ dir }: { dir: Direction }) => {
    const deg = { top: 0, right: 90, bottom: 180, left: 270 }[dir];
    return (
      <svg
        width="10" height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: `rotate(${deg}deg)`, flexShrink: 0, display: 'block' }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  };

  const Btn = ({ dir }: { dir: Direction }) => {
    const count = counts[dir];
    if (count === 0) return null;

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
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          minWidth: '48px',
          height: '48px',
          paddingLeft: '10px',
          paddingRight: '10px',
          background: 'rgb(79, 70, 229)',
          color: 'white',
          borderRadius: '16px',
          border: '2px solid white',
          boxShadow: '0 4px 14px rgba(79,70,229,0.4)',
          cursor: 'pointer',
          zIndex: 9000,
          lineHeight: 1,
          pointerEvents: 'auto',
          ...posStyle,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {dir === 'top' && <Arrow dir="top" />}
        {dir === 'left' && <Arrow dir="left" />}
        <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1, color: 'white' }}>
          {count > 999 ? '999+' : count}
        </span>
        {dir === 'bottom' && <Arrow dir="bottom" />}
        {dir === 'right' && <Arrow dir="right" />}
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
