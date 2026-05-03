import React, { useImperativeHandle, forwardRef, useRef } from 'react';

export interface ShutterOverlayHandle {
  trigger: (onDone: () => void) => void;
}

const ShutterOverlay = forwardRef<ShutterOverlayHandle>((_, ref) => {
  const isActiveRef = useRef(false);

  useImperativeHandle(ref, () => ({
    trigger(onDone: () => void) {
      if (isActiveRef.current) { onDone(); return; }
      isActiveRef.current = true;

      const markerEls = Array.from(
        document.querySelectorAll<HTMLElement>('.marker-content-wrapper')
      );

      if (markerEls.length === 0) {
        isActiveRef.current = false;
        onDone();
        return;
      }

      const FADE_IN = 180;   // 흰색으로 서서히 변하는 시간
      const HOLD = 60;       // 흰색 유지 시간
      const FADE_OUT = 300;  // 원래 색으로 돌아오는 시간
      const STAGGER = 15;    // 마커 간 딜레이

      markerEls.forEach((el, i) => {
        const delay = i * STAGGER;
        setTimeout(() => {
          // 서서히 흰색으로
          el.style.transition = `filter ${FADE_IN}ms ease-in`;
          el.style.filter = 'brightness(8) saturate(0)';

          // 잠깐 유지 후 서서히 원래대로
          setTimeout(() => {
            el.style.transition = `filter ${FADE_OUT}ms ease-out`;
            el.style.filter = '';

            setTimeout(() => {
              el.style.transition = '';
              el.style.filter = '';
            }, FADE_OUT);
          }, FADE_IN + HOLD);
        }, delay);
      });

      const totalDuration = markerEls.length * STAGGER + FADE_IN + HOLD + FADE_OUT + 80;

      setTimeout(() => {
        isActiveRef.current = false;
        onDone();
      }, totalDuration);
    }
  }));

  return null;
});

export default ShutterOverlay;
