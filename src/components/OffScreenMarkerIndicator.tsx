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
  // 화면 가장자리에서의 상대 위치 (0~1), 상하는 좌우 비율, 좌우는 상하 비율
  edgeRatio: number;
}

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({
  posts,
  bounds,
  mapCenter,
  onNavigate,
}) => {
  const groups = useMemo<Record<Direction, DirectionGroup>>(() => {
    const empty = (): DirectionGroup => ({ count: 0, nearest: null, edgeRatio: 0.5 });
    const result: Record<Direction, DirectionGroup> = {
      top: empty(), bottom: empty(), left: empty(), right: empty(),
    };

    if (!bounds || !mapCenter) return result;

    const { sw, ne } = bounds;
    const cx = mapCenter.lng;
    const cy = mapCenter.lat;

    // 위도/경도 범위
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;

    const dist = (p: Post) =>
      Math.sqrt(Math.pow((p.lat ?? 0) - cy, 2) + Math.pow((p.lng ?? 0) - cx, 2));

    // 방향별 마커 경도/위도 합산 (평균 위치 계산용)
    const sums: Record<Direction, { lngSum: number; latSum: number; count: number }> = {
      top: { lngSum: 0, latSum: 0, count: 0 },
      bottom: { lngSum: 0, latSum: 0, count: 0 },
      left: { lngSum: 0, latSum: 0, count: 0 },
      right: { lngSum: 0, latSum: 0, count: 0 },
    };

    const addToDir = (dir: Direction, post: Post) => {
      result[dir].count++;
      sums[dir].lngSum += post.lng!;
      sums[dir].latSum += post.lat!;
      sums[dir].count++;

      const d = dist(post);
      const nearestDist = result[dir].nearest ? dist(result[dir].nearest!) : Infinity;
      if (d < nearestDist) result[dir].nearest = post;
    };

    posts.forEach(post => {
      if (post.lat == null || post.lng == null) return;

      const inLat = post.lat >= sw.lat && post.lat <= ne.lat;
      const inLng = post.lng >= sw.lng && post.lng <= ne.lng;
      if (inLat && inLng) return; // 화면 안

      // 카카오맵: ne = 북동(우상단), sw = 남서(좌하단)
      // 위도: ne.lat > sw.lat (북쪽이 큰 값 = 화면 위쪽)
      // 경도: ne.lng > sw.lng (동쪽이 큰 값 = 화면 오른쪽)
      const isAbove = post.lat > ne.lat;  // 화면 위쪽 밖 (북쪽)
      const isBelow = post.lat < sw.lat;  // 화면 아래쪽 밖 (남쪽)
      const isLeft  = post.lng < sw.lng;  // 화면 왼쪽 밖 (서쪽)
      const isRight = post.lng > ne.lng;  // 화면 오른쪽 밖 (동쪽)

      if (isAbove && !isLeft && !isRight) { addToDir('top', post); return; }
      if (isBelow && !isLeft && !isRight) { addToDir('bottom', post); return; }
      if (isLeft  && !isAbove && !isBelow) { addToDir('left', post); return; }
      if (isRight && !isAbove && !isBelow) { addToDir('right', post); return; }

      // 대각선: 위도/경도 차이 비교로 주방향 결정
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

    // 각 방향별 평균 위치로 edgeRatio 계산
    // top/bottom: 마커들의 평균 경도 → 화면 좌우 비율 (0=왼쪽, 1=오른쪽)
    // left/right: 마커들의 평균 위도 → 화면 상하 비율 (0=위쪽, 1=아래쪽) — 위도는 반전
    (['top', 'bottom', 'left', 'right'] as Direction[]).forEach(dir => {
      const s = sums[dir];
      if (s.count === 0) return;
      if (dir === 'top' || dir === 'bottom') {
        const avgLng = s.lngSum / s.count;
        // 경도 → 화면 좌우 비율 (클램프 0.1~0.9)
        result[dir].edgeRatio = Math.min(0.9, Math.max(0.1, (avgLng - sw.lng) / lngRange));
      } else {
        const avgLat = s.latSum / s.count;
        // 위도 → 화면 상하 비율 (위도가 클수록 위쪽 = 비율 작음, 반전)
        result[dir].edgeRatio = Math.min(0.9, Math.max(0.1, 1 - (avgLat - sw.lat) / latRange));
      }
    });

    return result;
  }, [posts, bounds, mapCenter]);

  const hasAny = (Object.values(groups) as DirectionGroup[]).some(g => g.count > 0);
  if (!hasAny) return null;

  // 화살표 SVG
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
        style={{ transform: `rotate(${deg}deg)`, flexShrink: 0 }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  };

  const Btn = ({ dir, group }: { dir: Direction; group: DirectionGroup }) => {
    if (group.count === 0) return null;

    const isVertical = dir === 'top' || dir === 'bottom';
    const ratio = group.edgeRatio; // 0~1

    // 위치 계산
    const posStyle: React.CSSProperties = {};
    if (dir === 'top') {
      posStyle.top = 'calc(env(safe-area-inset-top, 0px) + 160px)';
      posStyle.left = `calc(${ratio * 100}% - 28px)`;
    } else if (dir === 'bottom') {
      posStyle.bottom = 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 90px)';
      posStyle.left = `calc(${ratio * 100}% - 28px)`;
    } else if (dir === 'left') {
      posStyle.left = '12px';
      posStyle.top = `calc(${ratio * 100}% - 16px)`;
    } else {
      posStyle.right = '12px';
      posStyle.top = `calc(${ratio * 100}% - 16px)`;
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
          padding: isVertical ? '5px 12px' : '6px 10px',
          pointerEvents: 'auto',
          ...posStyle,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {dir === 'top' && <Arrow dir="top" />}
        {dir === 'left' && <Arrow dir="left" />}
        <span style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1.3 }}>
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
