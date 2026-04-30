import React, { useMemo } from 'react';
import { Post } from '@/types';
import { DirectionCounts } from '@/hooks/use-supabase-posts';

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
  // DB에서 가져온 방향별 카운트 (없으면 로컬 posts로 계산)
  dbCounts?: DirectionCounts | null;
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
  dbCounts,
}) => {
  // 로컬 posts에서 방향별 nearest 포스트 계산 (클릭 시 이동 대상)
  const nearestByDir = useMemo<Record<Direction, Post | null>>(() => {
    const result: Record<Direction, Post | null> = {
      top: null, bottom: null, left: null, right: null,
    };

    if (!bounds || !mapCenter) return result;

    const { sw, ne } = bounds;
    const cx = mapCenter.lng;
    const cy = mapCenter.lat;

    const dist = (p: Post) =>
      Math.sqrt(Math.pow((p.lat ?? 0) - cy, 2) + Math.pow((p.lng ?? 0) - cx, 2));

    const updateNearest = (dir: Direction, post: Post) => {
      const d = dist(post);
      const nearestDist = result[dir] ? dist(result[dir]!) : Infinity;
      if (d < nearestDist) result[dir] = post;
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

      if (isAbove) updateNearest('top', post);
      if (isBelow) updateNearest('bottom', post);
      if (isLeft)  updateNearest('left', post);
      if (isRight) updateNearest('right', post);
    });

    return result;
  }, [posts, bounds, mapCenter]);

  // 표시할 카운트: DB 카운트 우선, 없으면 로컬 posts로 계산
  const counts = useMemo<Record<Direction, number>>(() => {
    if (dbCounts) {
      return {
        top: dbCounts.top,
        bottom: dbCounts.bottom,
        left: dbCounts.left,
        right: dbCounts.right,
      };
    }

    // fallback: 로컬 posts 기반 카운트
    if (!bounds) return { top: 0, bottom: 0, left: 0, right: 0 };
    const { sw, ne } = bounds;
    const result = { top: 0, bottom: 0, left: 0, right: 0 };

    posts.forEach(post => {
      if (post.lat == null || post.lng == null) return;
      const inLat = post.lat >= sw.lat && post.lat <= ne.lat;
      const inLng = post.lng >= sw.lng && post.lng <= ne.lng;
      if (inLat && inLng) return;

      if (post.lat > ne.lat) result.top++;
      if (post.lat < sw.lat) result.bottom++;
      if (post.lng < sw.lng && post.lat >= sw.lat && post.lat <= ne.lat) result.left++;
      if (post.lng > ne.lng && post.lat >= sw.lat && post.lat <= ne.lat) result.right++;
    });

    return result;
  }, [dbCounts, posts, bounds]);

  const hasAny = Object.values(counts).some(c => c > 0);
  if (!hasAny) return null;

  const Arrow = ({ dir }: { dir: Direction }) => {
    const deg = { top: 0, right: 90, bottom: 180, left: 270 }[dir];
    return (
      <svg
        width="12" height="12"
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

    const nearest = nearestByDir[dir];
    const isVertical = dir === 'top' || dir === 'bottom';

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
        onClick={() => nearest && onNavigate(nearest)}
        style={{
          position: 'fixed',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          width: '44px',
          height: '44px',
          background: 'rgba(79, 70, 229, 0.92)',
          color: 'white',
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          cursor: nearest ? 'pointer' : 'default',
          zIndex: 9000,
          padding: 0,
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
