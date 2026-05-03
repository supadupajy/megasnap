import { useImperativeHandle, forwardRef, useRef } from 'react';

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

      const FLASH = 40;      // 팍 켜지는 시간
      const FADE_OUT = 600;  // 스르륵 사라지는 시간
      const STAGGER = 15;

      // 모든 마커에 플래시 적용
      markerEls.forEach((el, i) => {
        const delay = i * STAGGER;
        setTimeout(() => {
          el.style.transition = `filter ${FLASH}ms ease-in`;
          el.style.filter = 'brightness(10) saturate(0)';
        }, delay);
      });

      // 플래시가 다 켜진 직후 onDone 호출 → 페이지 전환 시작
      const flashPeak = markerEls.length * STAGGER + FLASH;
      setTimeout(() => {
        isActiveRef.current = false;
        onDone();
      }, flashPeak);

      // fade-out은 onDone과 무관하게 계속 진행
      markerEls.forEach((el, i) => {
        const delay = i * STAGGER + FLASH;
        setTimeout(() => {
          el.style.transition = `filter ${FADE_OUT}ms cubic-bezier(0.0, 0.0, 0.2, 1)`;
          el.style.filter = '';
          setTimeout(() => {
            el.style.transition = '';
            el.style.filter = '';
          }, FADE_OUT);
        }, delay);
      });
    }
  }));

  return null;
});

export default ShutterOverlay;
