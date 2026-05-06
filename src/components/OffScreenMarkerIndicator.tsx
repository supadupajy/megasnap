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

// 화면 크기를 실시간으로 읽는 훅
function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

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

  // ── safe zone 정의 (UI 겹침 방지) ──────────────────────────
  // topOffset: 트렌딩 패널 하단 (뱃지가 이 위로 올라가지 않음)
  const topSafeY = topOffset !== undefined
    ? (typeof topOffset === 'number' ? topOffset : 140)
    : 140;

  // 하단: 바텀 네비(64px) + safe-area + 여백
  const bottomSafeY = bottomOffset + 8; // px from bottom of viewport

  // 좌측 버튼 영역: left=16px, 버튼 3개(48px each) + gap(8px)*2 = 160px 높이
  // 버튼 bottom 기준: bottomSafeY + 160px ~ bottomSafeY
  const leftBtnBottom = bottomSafeY + 168; // 버튼 영역 상단 (화면 하단 기준)
  const leftBtnTop = bottomSafeY;          // 버튼 영역 하단 (화면 하단 기준)

  // 우측 버튼 영역: right=16px, 새로고침(56px) + gap(16px) + 여기보기(64px) = 136px 높이
  const rightBtnBottom = bottomSafeY + 144;
  const rightBtnTop = bottomSafeY;

  // 뱃지 크기 (대략)
  const BADGE_W = 72;
  const BADGE_H = 32;
  const EDGE_MARGIN = 16; // 화면 테두리에서 뱃지까지 여백

  // ── 경도/위도 → 화면 비율(0~1) 변환 ──────────────────────────
  // bounds 기준으로 화면 내 상대 위치를 계산
  const lngToRatioX = (lng: number) => (lng - sw.lng) / lngRange;
  const latToRatioY = (lat: number) => 1 - (lat - sw.lat) / latRange; // 위도는 위가 크므로 반전

  // ── 방향별 뱃지 위치 계산 ──────────────────────────────────
  const calcBtnStyle = (dir: Direction): React.CSSProperties => {
    const posStyle: React.CSSProperties = {
      position: 'fixed',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px',
      height: `${BADGE_H}px`,
      paddingLeft: '14px',
      paddingRight: '14px',
      background: 'rgba(255, 255, 255, 0.55)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      color: '#374151',
      borderRadius: '999px',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      cursor: 'pointer',
      zIndex: 9000,
      lineHeight: 1,
      pointerEvents: 'auto',
      whiteSpace: 'nowrap',
      transition: 'top 0.3s ease, bottom 0.3s ease, left 0.3s ease, right 0.3s ease',
    };

    if (dir === 'top' || dir === 'bottom') {
      // 평균 경도 → 화면 X 비율 → 픽셀
      const avgLng = dir === 'top' ? (counts.topAvgLng ?? centerLng) : (counts.bottomAvgLng ?? centerLng);
      const ratioX = lngToRatioX(avgLng);
      // 화면 픽셀 X (뱃지 중심)
      let centerX = ratioX * screenW;
      // 좌우 여백 클램프 (뱃지가 화면 밖으로 나가지 않도록)
      centerX = Math.max(BADGE_W / 2 + EDGE_MARGIN, Math.min(screenW - BADGE_W / 2 - EDGE_MARGIN, centerX));

      posStyle.left = `${centerX - BADGE_W / 2}px`;

      if (dir === 'top') {
        posStyle.top = `${topSafeY}px`;
      } else {
        posStyle.bottom = `${bottomSafeY}px`;
        // 하단 중앙 영역만 허용 (좌측 버튼 영역, 우측 버튼 영역 제외)
        // 좌측 버튼: left 0~80px, 우측 버튼: right 0~80px
        const leftExcludeRight = 80 + BADGE_W / 2 + EDGE_MARGIN;
        const rightExcludeLeft = screenW - 80 - BADGE_W / 2 - EDGE_MARGIN;
        centerX = Math.max(leftExcludeRight, Math.min(rightExcludeLeft, centerX));
        posStyle.left = `${centerX - BADGE_W / 2}px`;
      }
    } else {
      // 평균 위도 → 화면 Y 비율 → 픽셀
      const avgLat = dir === 'left' ? (counts.leftAvgLat ?? centerLat) : (counts.rightAvgLat ?? centerLat);
      const ratioY = latToRatioY(avgLat);
      // 화면 픽셀 Y (뱃지 중심)
      let centerY = ratioY * screenH;

      if (dir === 'left') {
        posStyle.left = `${EDGE_MARGIN}px`;
        // 좌측 버튼 영역 회피: 버튼이 화면 하단 leftBtnTop ~ leftBtnBottom 구간에 있음
        const btnTopY = screenH - leftBtnBottom;
        const btnBottomY = screenH - leftBtnTop;
        // 뱃지가 버튼 영역과 겹치면 버튼 위로 밀어올림
        if (centerY + BADGE_H / 2 > btnTopY && centerY - BADGE_H / 2 < btnBottomY) {
          centerY = btnTopY - BADGE_H / 2 - 8;
        }
        // 상하 클램프
        centerY = Math.max(topSafeY + BADGE_H / 2, Math.min(screenH - bottomSafeY - BADGE_H / 2, centerY));
        posStyle.top = `${centerY - BADGE_H / 2}px`;
      } else {
        posStyle.right = `${EDGE_MARGIN}px`;
        // 우측 버튼 영역 회피
        const btnTopY = screenH - rightBtnBottom;
        const btnBottomY = screenH - rightBtnTop;
        if (centerY + BADGE_H / 2 > btnTopY && centerY - BADGE_H / 2 < btnBottomY) {
          centerY = btnTopY - BADGE_H / 2 - 8;
        }
        // 상하 클램프
        centerY = Math.max(topSafeY + BADGE_H / 2, Math.min(screenH - bottomSafeY - BADGE_H / 2, centerY));
        posStyle.top = `${centerY - BADGE_H / 2}px`;
      }
    }

    return posStyle;
  };

  // ── 삼각형 아이콘 ──────────────────────────────────────────
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

    return (
      <button
        onClick={() => onClickDirection(dir)}
        style={calcBtnStyle(dir)}
        onMouseDown={e => e.stopPropagation()}
      >
        {dir !== 'right' && <Triangle dir={dir} />}
        <span style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1, color: '#374151' }}>
          {count > 999 ? '999+' : count}
        </span>
        {dir === 'right' && <Triangle dir={dir} />}
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
