import React, { useImperativeHandle, forwardRef, useRef } from 'react';

export interface ShutterOverlayHandle {
  trigger: (onDone: () => void, markerPositions?: Array<{ x: number; y: number }>) => void;
}

const ShutterOverlay = forwardRef<ShutterOverlayHandle>((_, ref) => {
  const isActiveRef = useRef(false);

  useImperativeHandle(ref, () => ({
    trigger(onDone: () => void) {
      if (isActiveRef.current) { onDone(); return; }
      isActiveRef.current = true;

      // 지도 마커 DOM 요소들을 직접 찾아서 흰색으로 깜빡임
      const markerEls = Array.from(
        document.querySelectorAll<HTMLElement>('.marker-content-wrapper')
      );

      if (markerEls.length === 0) {
        isActiveRef.current = false;
        onDone();
        return;
      }

      // 각 마커에 순차적으로 흰색 flash 적용
      const FLASH_DURATION = 280; // ms
      const STAGGER = 20; // 마커 간 딜레이

      markerEls.forEach((el, i) => {
        const delay = i * STAGGER;
        setTimeout(() => {
          el.style.transition = `filter ${FLASH_DURATION * 0.3}ms ease-out`;
          el.style.filter = 'brightness(10) saturate(0)';
          setTimeout(() => {
            el.style.transition = `filter ${FLASH_DURATION * 0.7}ms ease-in`;
            el.style.filter = '';
            setTimeout(() => {
              el.style.transition = '';
              el.style.filter = '';
            }, FLASH_DURATION * 0.7);
          }, FLASH_DURATION * 0.3);
        }, delay);
      });

      const totalDuration = markerEls.length * STAGGER + FLASH_DURATION + 60;

      setTimeout(() => {
        isActiveRef.current = false;
        onDone();
      }, totalDuration);
    }
  }));

  // 렌더링 없음 - DOM 직접 조작만 함
  return null;
});

export default ShutterOverlay;
