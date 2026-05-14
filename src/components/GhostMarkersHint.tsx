"use client";

import React, { useEffect, useMemo, useState } from 'react';

interface GhostMarkersHintProps {
  /**
   * true로 바뀌는 순간 한 번 재생되고 자동으로 사라진다.
   * 같은 bounds 키에서 다시 트리거되지 않도록 부모에서 키 단위로 관리한다.
   */
  active: boolean;
  /**
   * 힌트가 떠오르는 영역의 상단 padding (지도 영역 안에 그리기 위함).
   * Index.tsx에서 indicatorTopOffset 등을 넘긴다.
   */
  topOffset?: number;
  /** 하단 padding (지금 여기 버튼 주변까지만 분포). */
  bottomOffset?: number;
  /**
   * 재생이 끝났을 때 콜백. 부모에서 active=false로 내릴 수 있다.
   */
  onComplete?: () => void;
}

interface GhostMarker {
  id: number;
  leftPct: number;   // 0~100
  topPct: number;    // 0~100
  delay: number;     // s
  scale: number;
  rotate: number;    // deg
}

const TOTAL_DURATION_MS = 2800;

/**
 * 회색 점선 외곽선의 유령 마커 4개가 화면 안에 흩뿌려져
 * stagger delay로 fade in → 살짝 부유 → fade out 되는 힌트 이펙트.
 *
 * "이 영역엔 시간이 지난 추억이 있어요" 라는 무드를 강요하지 않고 차분하게 전달한다.
 */
const GhostMarkersHint: React.FC<GhostMarkersHintProps> = ({
  active,
  topOffset = 120,
  bottomOffset = 200,
  onComplete,
}) => {
  const [visible, setVisible] = useState(false);

  // active=true 가 들어오는 순간에만 새 마커 배치를 생성한다.
  // 같은 batch 내에서는 매 렌더마다 위치가 바뀌지 않도록 useState로 고정.
  const [markers, setMarkers] = useState<GhostMarker[]>([]);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    // 4개의 마커를 화면에 비대칭으로 흩뿌린다 (좌상/우상/좌하/우하 사분면에 하나씩).
    const quadrants: Array<{ lx: [number, number]; ty: [number, number] }> = [
      { lx: [15, 35], ty: [10, 30] },
      { lx: [60, 82], ty: [12, 32] },
      { lx: [12, 32], ty: [55, 75] },
      { lx: [60, 80], ty: [58, 78] },
    ];

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const nextMarkers: GhostMarker[] = quadrants.map((q, i) => ({
      id: i,
      leftPct: rand(q.lx[0], q.lx[1]),
      topPct: rand(q.ty[0], q.ty[1]),
      delay: i * 0.12,
      scale: rand(0.85, 1.1),
      rotate: rand(-8, 8),
    }));

    setMarkers(nextMarkers);
    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, TOTAL_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [active, onComplete]);

  // 마커가 그려질 수직 영역 (top/bottom offset 사이)
  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: topOffset,
    left: 0,
    right: 0,
    bottom: bottomOffset,
    pointerEvents: 'none',
    zIndex: 22, // 카테고리 버튼(z-20)보다 위, 트렌딩 패널(z-12000)보다 아래
    overflow: 'hidden',
  }), [topOffset, bottomOffset]);

  if (!visible || markers.length === 0) return null;

  return (
    <div style={containerStyle} aria-hidden>
      <style>{`
        @keyframes ghost-marker-float {
          0%   { opacity: 0; transform: translate(-50%, -40%) scale(0.6); }
          25%  { opacity: 0.55; transform: translate(-50%, -55%) scale(1); }
          70%  { opacity: 0.5; transform: translate(-50%, -62%) scale(1.02); }
          100% { opacity: 0; transform: translate(-50%, -75%) scale(0.95); }
        }
        @keyframes ghost-hint-caption {
          0%   { opacity: 0; transform: translate(-50%, 10px); }
          22%  { opacity: 1; transform: translate(-50%, 0); }
          78%  { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -6px); }
        }
        .ghost-marker {
          position: absolute;
          will-change: transform, opacity;
          animation: ghost-marker-float 2.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .ghost-hint-caption {
          position: absolute;
          left: 50%;
          bottom: 8px;
          transform: translate(-50%, 10px);
          opacity: 0;
          animation: ghost-hint-caption 2.6s ease-out forwards;
          animation-delay: 0.15s;
          background: rgba(15, 23, 42, 0.78);
          color: #f8fafc;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
          padding: 8px 14px;
          border-radius: 999px;
          backdrop-filter: blur(8px);
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ghost-hint-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #fbbf24;
          box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.25);
        }
      `}</style>

      {markers.map((m) => (
        <div
          key={m.id}
          className="ghost-marker"
          style={{
            left: `${m.leftPct}%`,
            top: `${m.topPct}%`,
            animationDelay: `${m.delay}s`,
          }}
        >
          <GhostMarkerSvg scale={m.scale} rotate={m.rotate} />
        </div>
      ))}

      <div className="ghost-hint-caption">
        <span className="ghost-hint-dot" />
        <span>이 영역엔 시간이 지난 추억이 있어요</span>
      </div>
    </div>
  );
};

const GhostMarkerSvg: React.FC<{ scale: number; rotate: number }> = ({ scale, rotate }) => {
  // 지도 마커와 닮은 둥근 사각형 + 작은 꼭지점, 점선 외곽선의 회색 톤
  const size = 54 * scale;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      style={{
        transform: `rotate(${rotate}deg)`,
        transformOrigin: 'center',
        filter: 'drop-shadow(0 6px 14px rgba(15, 23, 42, 0.18))',
      }}
    >
      {/* 본체: 둥근 사각형, 점선 외곽선 */}
      <rect
        x="6"
        y="6"
        width="48"
        height="48"
        rx="16"
        fill="rgba(148, 163, 184, 0.18)"
        stroke="rgba(100, 116, 139, 0.75)"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      {/* 안쪽 작은 도트 (지도 마커 느낌) */}
      <circle cx="30" cy="30" r="5" fill="rgba(71, 85, 105, 0.45)" />
    </svg>
  );
};

export default GhostMarkersHint;
