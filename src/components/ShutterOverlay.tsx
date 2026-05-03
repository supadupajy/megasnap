import React, { memo, useImperativeHandle, forwardRef, useRef } from 'react';

export interface ShutterOverlayHandle {
  trigger: (onDone: () => void, markerPositions?: Array<{ x: number; y: number }>) => void;
}

const ShutterOverlay = forwardRef<ShutterOverlayHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isActiveRef = useRef(false);

  useImperativeHandle(ref, () => ({
    trigger(onDone: () => void, markerPositions?: Array<{ x: number; y: number }>) {
      if (isActiveRef.current) { onDone(); return; }
      isActiveRef.current = true;

      const container = containerRef.current;
      if (!container || !markerPositions || markerPositions.length === 0) {
        isActiveRef.current = false;
        onDone();
        return;
      }

      // 기존 플래시 제거
      container.innerHTML = '';

      const MAX_FLASHES = 30;
      const positions = markerPositions.slice(0, MAX_FLASHES);

      positions.forEach((pos, i) => {
        const flash = document.createElement('div');
        const size = 56 + Math.random() * 24; // 56~80px
        const delay = i * 18; // 각 마커마다 18ms 딜레이

        flash.style.cssText = `
          position: absolute;
          left: ${pos.x}px;
          top: ${pos.y}px;
          width: ${size}px;
          height: ${size}px;
          transform: translate(-50%, -50%) scale(0);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%);
          pointer-events: none;
          animation: marker-flash ${320}ms ease-out ${delay}ms forwards;
        `;
        container.appendChild(flash);
      });

      const totalDuration = positions.length * 18 + 320 + 60;

      const timer = setTimeout(() => {
        if (container) container.innerHTML = '';
        isActiveRef.current = false;
        onDone();
      }, totalDuration);

      return () => clearTimeout(timer);
    }
  }));

  return (
    <>
      <style>{`
        @keyframes marker-flash {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          40%  { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 25,
          overflow: 'hidden',
        }}
      />
    </>
  );
});

export default ShutterOverlay;
