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

      const FLASH = 40;      // 흰색으로 팍 켜지는 시간
      const FADE_OUT = 500;  // 스르륵 사라지는 시간
      const STAGGER = 15;    // 마커 간 딜레이

      markerEls.forEach((el, i) => {
        const delay = i * STAGGER;
        setTimeout(() => {
          // 팍 흰색으로
          el.style.transition = `filter ${FLASH}ms ease-in`;
          el.style.filter = 'brightness(10) saturate(0)';

          // 스르륵 원래대로
          setTimeout(() => {
            el.style.transition = `filter ${FADE_OUT}ms cubic-bezier(0.1, 0, 0.3, 1)`;
            el.style.filter = '';

            setTimeout(() => {
              el.style.transition = '';
              el.style.filter = '';
            }, FADE_OUT);
          }, FLASH);
        }, delay);
      });

      const totalDuration = markerEls.length * STAGGER + FLASH + FADE_OUT + 80;

      setTimeout(() => {
        isActiveRef.current = false;
        onDone();
      }, totalDuration);
    }
  }));

  return null;
});

export default ShutterOverlay;
