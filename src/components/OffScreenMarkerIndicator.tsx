import React, { useMemo } from 'react';
import { Post } from '@/types';

interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface OffScreenMarkerIndicatorProps {
  posts: Post[];
  bounds: Bounds | null;
}

interface DirectionCounts {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const OffScreenMarkerIndicator: React.FC<OffScreenMarkerIndicatorProps> = ({ posts, bounds }) => {
  const counts = useMemo<DirectionCounts>(() => {
    if (!bounds) return { top: 0, bottom: 0, left: 0, right: 0 };

    const { sw, ne } = bounds;
    const result = { top: 0, bottom: 0, left: 0, right: 0 };

    posts.forEach(post => {
      if (post.lat == null || post.lng == null) return;

      const inLat = post.lat >= sw.lat && post.lat <= ne.lat;
      const inLng = post.lng >= sw.lng && post.lng <= ne.lng;

      // 화면 안에 있으면 스킵
      if (inLat && inLng) return;

      // 위/아래 판별 (위도: ne.lat = 북쪽 상단, sw.lat = 남쪽 하단)
      const isAbove = post.lat > ne.lat;
      const isBelow = post.lat < sw.lat;
      // 좌/우 판별 (경도: sw.lng = 서쪽 왼쪽, ne.lng = 동쪽 오른쪽)
      const isLeft = post.lng < sw.lng;
      const isRight = post.lng > ne.lng;

      // 대각선 마커는 가장 벗어난 방향으로 분류
      if (isAbove && !isLeft && !isRight) {
        result.top++;
      } else if (isBelow && !isLeft && !isRight) {
        result.bottom++;
      } else if (isLeft && !isAbove && !isBelow) {
        result.left++;
      } else if (isRight && !isAbove && !isBelow) {
        result.right++;
      } else if (isAbove && isLeft) {
        // 위-왼쪽 대각선: 위도 차이 vs 경도 차이로 주방향 결정
        const latDiff = post.lat - ne.lat;
        const lngDiff = sw.lng - post.lng;
        if (latDiff >= lngDiff) result.top++;
        else result.left++;
      } else if (isAbove && isRight) {
        const latDiff = post.lat - ne.lat;
        const lngDiff = post.lng - ne.lng;
        if (latDiff >= lngDiff) result.top++;
        else result.right++;
      } else if (isBelow && isLeft) {
        const latDiff = sw.lat - post.lat;
        const lngDiff = sw.lng - post.lng;
        if (latDiff >= lngDiff) result.bottom++;
        else result.left++;
      } else if (isBelow && isRight) {
        const latDiff = sw.lat - post.lat;
        const lngDiff = post.lng - ne.lng;
        if (latDiff >= lngDiff) result.bottom++;
        else result.right++;
      }
    });

    return result;
  }, [posts, bounds]);

  const hasAny = counts.top > 0 || counts.bottom > 0 || counts.left > 0 || counts.right > 0;
  if (!hasAny) return null;

  const btnBase: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    background: 'rgba(79, 70, 229, 0.88)',
    backdropFilter: 'blur(6px)',
    color: 'white',
    borderRadius: '20px',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: 800,
    boxShadow: '0 2px 12px rgba(79,70,229,0.35)',
    border: '1.5px solid rgba(255,255,255,0.25)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.02em',
    zIndex: 100,
  };

  // 화살표 SVG
  const Arrow = ({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) => {
    const rotations = { up: 0, right: 90, down: 180, left: 270 };
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: `rotate(${rotations[dir]}deg)`, flexShrink: 0 }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  };

  return (
    <>
      {/* 상단 */}
      {counts.top > 0 && (
        <div
          style={{
            ...btnBase,
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            flexDirection: 'column',
            gap: '1px',
            padding: '6px 12px 4px',
          }}
        >
          <Arrow dir="up" />
          <span>{counts.top}</span>
        </div>
      )}

      {/* 하단 */}
      {counts.bottom > 0 && (
        <div
          style={{
            ...btnBase,
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            flexDirection: 'column',
            gap: '1px',
            padding: '4px 12px 6px',
          }}
        >
          <span>{counts.bottom}</span>
          <Arrow dir="down" />
        </div>
      )}

      {/* 좌측 */}
      {counts.left > 0 && (
        <div
          style={{
            ...btnBase,
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            flexDirection: 'row',
            padding: '5px 10px 5px 7px',
          }}
        >
          <Arrow dir="left" />
          <span>{counts.left}</span>
        </div>
      )}

      {/* 우측 */}
      {counts.right > 0 && (
        <div
          style={{
            ...btnBase,
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            flexDirection: 'row',
            padding: '5px 7px 5px 10px',
          }}
        >
          <span>{counts.right}</span>
          <Arrow dir="right" />
        </div>
      )}
    </>
  );
};

export default OffScreenMarkerIndicator;
