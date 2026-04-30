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
  topOffset: number;
  bottomOffset: number;
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
  topOffset,
  bottomOffset,
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
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;

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
      if (inLat && inLng) return;

      const isAbove = post.lat > ne.lat;
      const isBelow = post.lat < sw.lat;
      const isLeft  = post.lng < sw.lng;
      const isRight = post.lng > ne.lng;

      if (isAbove && !isLeft && !isRight) { addToDir('top', post); return; }
      if (isBelow && !isLeft && !isRight) { addToDir('bottom', post); return; }
      if (isLeft  && !isAbove && !isBelow) { addToDir('left', post); return; }
      if (isRight && !isAbove && !isBelow) { addToDir('right', post); return; }

      if (isAbove && isLeft) {
        (post.lat - ne.lat) / latRange >= (sw.lng - post.lng) / lngRange
          ? addToDir('top', post) : addToDir('left', post);
      } else if (isAbove && isRight) {
        (post.lat - ne.lat) / latRange >= (post.lng - ne.lng) / lngRange
          ? addToDir('top', post) : addToDir('right', post);
      } else if (isBelow && isLeft) {
        (sw.lat - post.lat) / latRange >= (sw.lng - post.lng) / lngRange
          ? addToDir('bottom', post) : addToDir('left', post);
      } else if (isBelow && isRight) {
        (sw.lat - post.lat) / latRange >= (post.lng - ne.lng) / lngRange
          ? addToDir('bottom', post) : addToDir('right', post);
      }
    });

    return result;
  }, [posts, bounds, mapCenter]);

  const hasAny = (Object.values(groups) as DirectionGroup[]).some(g => g.count > 0);
  if (!hasAny) return null;

  const Arrow = ({ dir }: { dir: Direction }) => {
    const deg = { top: 0, right: 90, bottom: 180, left: 270 }[dir];
    return (
      <svg
        width="13" height="13"
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

  const Btn = ({ dir, group }: { dir: Direction; group: DirectionGroup }) => {
    if (group.count === 0) return null;

    const isVertical = dir === 'top' || dir === 'bottom';

    // 항상 해당 가장자리 정중앙에 고정
    const posStyle: React.CSSProperties = {};
    if (dir === 'top') {
      posStyle.top = `${topOffset + 12}px`;
      posStyle.left = '50%';
      posStyle.transform = 'translateX(-50%)';
    } else if (dir === 'bottom') {
      posStyle.bottom = `${bottomOffset + 12}px`;
      posStyle.left = '50%';
      posStyle.transform = 'translateX(-50%)';
    } else if (dir === 'left') {
      posStyle.left = '12px';
      posStyle.top = '50%';
      posStyle.transform = 'translateY(-50%)';
    } else {
      posStyle.right = '12px';
      posStyle.top = '50%';
      posStyle.transform = 'translateY(-50%)';
    }

    return (
      <button
        onClick={() => group.nearest && onNavigate(group.nearest)}
        style={{
          position: 'fixed',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          background: 'rgba(79, 70, 229, 0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: 'white',
          borderRadius: '18px',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 4px 16px rgba(79,70,229,0.45)',
          cursor: 'pointer',
          letterSpacing: '-0.02em',
          zIndex: 9000,
          // 상하좌우 모두 동일한 패딩/크기
          padding: '5px 12px',
          lineHeight: 1,
          pointerEvents: 'auto',
          ...posStyle,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {dir === 'top' && <Arrow dir="top" />}
        {dir === 'left' && <Arrow dir="left" />}
        <span style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1, verticalAlign: 'middle' }}>
          {group.count}
        </span>
        {dir === 'bottom' && <Arrow dir="bottom" />}
        {dir === 'right' && <Arrow dir="right" />}
      </button>
    );
  };

  return (
    <>
      <Btn dir="top"    group={groups.top} />
      <Btn dir="bottom" group={groups.bottom} />
      <Btn dir="left"   group={groups.left} />
      <Btn dir="right"  group={groups.right} />
    </>
  );
};

export default OffScreenMarkerIndicator;