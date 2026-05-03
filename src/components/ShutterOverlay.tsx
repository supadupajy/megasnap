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

      // 1단계: transition 없이 즉시 흰색으로 팍
      markerEls.forEach(el => {
        el.style.transition = 'none';
        el.style.filter = 'brightness(10) saturate(0)';
      });

      // 2단계: 다음 프레임에서 fade-out transition 설정 후 원래 값으로
      // requestAnimationFrame 두 번 써서 브라우저가 흰색 상태를 확실히 렌더링하게 함
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          markerEls.forEach(el => {
            el.style.transition = 'filter 700ms cubic-bezier(0.25, 0.1, 0.25, 1)';
            el.style.filter = 'brightness(1) saturate(1)';
          });

          // transition 끝나면 스타일 정리
          setTimeout(() => {
            markerEls.forEach(el => {
              el.style.transition = '';
              el.style.filter = '';
            });
          }, 700);
        });
      });

      // 페이지 전환은 흰색 팍 뜬 직후 바로 시작
      setTimeout(() => {
        isActiveRef.current = false;
        onDone();
      }, 50);
    }
  }));

  return null;
});

export default ShutterOverlay;
