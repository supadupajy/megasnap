import React, { useMemo } from 'react';
import { Post } from '@/types';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface OffScreenMarkerIndicatorProps {
  posts: Post[];
  bounds: Bounds | null;
  mapCenter: { lat: number; lng: number } | null;
  onNavigate: (post: Post) => void;
}

type Direction = 'top' | 'bottom' | 'left' | 'right';

interface DirectionGroup {
  count: number;
  nearest: Post | null;
}

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  posts,
  bounds,
  mapCenter,
  onNavigate,
}) => {
  const groups = useMemo<Record<Direction, DirectionGroup>>(() => {
    const empty = (): DirectionGroup => ({ count: 0, nearest: null });
    const result: Record<Direction, DirectionGroup> = {
      top: empty(), bottom: empty(), left: empty(), right: empty(),
    };

    if (!bounds || !mapCenter) return result;

    const { sw, ne } = bounds;
    const cx = mapCenter.lng;
    const cy = mapCenter.lat;

    const dist = (p: Post) =>
      Math.sqrt(Math.pow((p.lat ?? 0) - cy, 2) + Math.pow((p.lng ?? 0) - cx, 2));

    const addToDir = (dir: Direction, post: Post) => {
      result[dir].count++;
      const d = dist(post);
      const nearestDist = result[dir].nearest ? dist(result[dir].nearest!) : Infinity;
      if (d < nearestDist) result[dir].nearest = post;
    };

    posts.forEach(post => {
      if (post.lat == null || post.lng == null) return;

      const inLat = post.lat >= sw.lat && post.lat <= ne.lat;
      const inLng = post.lng >= sw.lng && post.lng <= ne.lng;
      if (inLat && inLng) return; // 화면 안

      const isAbove = post.lat > ne.lat;
      const isBelow = post.lat < sw.lat;
      const isLeft  = post.lng < sw.lng;
      const isRight = post.lng > ne.lng;

      if (isAbove && !isLeft && !isRight) { addToDir('top', post); return; }
      if (isBelow && !isLeft && !isRight) { addToDir('bottom', post); return; }
      if (isLeft  && !isAbove && !isBelow) { addToDir('left', post); return; }
      if (isRight && !isAbove && !isBelow) { addToDir('right', post); return; }

      // 대각선: 위도/경도 차이 비교로 주방향 결정
      if (isAbove && isLeft) {
        (post.lat - ne.lat) >= (sw.lng - post.lng) ? addToDir('top', post) : addToDir('left', post);
      } else if (isAbove && isRight) {
        (post.lat - ne.lat) >= (post.lng - ne.lng) ? addToDir('top', post) : addToDir('right', post);
      } else if (isBelow && isLeft) {
        (sw.lat - post.lat) >= (sw.lng - post.lng) ? addToDir('bottom', post) : addToDir('left', post);
      } else if (isBelow && isRight) {
        (sw.lat - post.lat) >= (post.lng - ne.lng) ? addToDir('bottom', post) : addToDir('right', post);
      }
    });

    return result;
  }, [posts, bounds, mapCenter]);

  const hasAny = (Object.values(groups) as DirectionGroup[]).some(g => g.count > 0);
  if (!hasAny) return null;

  // 화살표 SVG (위쪽 기준, rotate로 방향 전환)
  const Arrow = ({ dir }: { dir: Direction }) => {
    const deg = { top: 0, right: 90, bottom: 180, left: 270 }[dir];
    return (
      <svg
        width="14" height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: `rotate(${deg}deg)`, flexShrink: 0 }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  };

  const Btn = ({
    dir,
    group,
    style,
  }: {
    dir: Direction;
    group: DirectionGroup;
    style: React.CSSProperties;
  }) => {
    if (group.count === 0) return null;

    const isVertical = dir === 'top' || dir === 'bottom';

    return (
      <button
        onClick={() => group.nearest && onNavigate(group.nearest)}
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          background: 'rgba(79, 70, 229, 0.90)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: 'white',
          borderRadius: '20px',
          border: '1.5px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.02em',
          zIndex: 30,
          padding: isVertical ? '5px 14px' : '6px 12px',
          minWidth: isVertical ? '44px' : undefined,
          ...style,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {dir === 'top' && <Arrow dir="top" />}
        {dir === 'left' && <Arrow dir="left" />}
        <span style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1.2 }}>
          {group.count}
        </span>
        {dir === 'bottom' && <Arrow dir="bottom" />}
        {dir === 'right' && <Arrow dir="right" />}
      </button>
    );
  };

  return (
    <>
      {/* 상단 - 화면 중앙 상단 */}
      <Btn
        dir="top"
        group={groups.top}
        style={{ top: 16, left: '50%', transform: 'translateX(-50%)' }}
      />
      {/* 하단 - 화면 중앙 하단 */}
      <Btn
        dir="bottom"
        group={groups.bottom}
        style={{ bottom: 16, left: '50%', transform: 'translateX(-50%)' }}
      />
      {/* 좌측 - 화면 중앙 좌측 */}
      <Btn
        dir="left"
        group={groups.left}
        style={{ left: 16, top: '50%', transform: 'translateY(-50%)' }}
      />
      {/* 우측 - 화면 중앙 우측 */}
      <Btn
        dir="right"
        group={groups.right}
        style={{ right: 16, top: '50%', transform: 'translateY(-50%)' }}
      />
    </>
  );
};

export default OffScreenMarkerIndicator;
