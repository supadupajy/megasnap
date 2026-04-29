import React, { memo, useImperativeHandle, forwardRef, useRef } from 'react';

export interface ShutterOverlayHandle {
  trigger: (onDone: () => void) => void;
}

const ShutterOverlay = forwardRef<ShutterOverlayHandle>((_, ref) => {
  const flashRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    trigger(onDone: () => void) {
      const el = flashRef.current;
      if (!el) { onDone(); return; }

      // 이미 진행 중이면 스킵
      if (el.classList.contains('shutter-flash-active')) { onDone(); return; }

      el.classList.add('shutter-flash-active');
      const timer = setTimeout(() => {
        el.classList.remove('shutter-flash-active');
        onDone();
      }, 420);

      // 혹시 animationend가 먼저 오면 타이머 정리
      const onEnd = () => {
        clearTimeout(timer);
        el.classList.remove('shutter-flash-active');
        el.removeEventListener('animationend', onEnd);
        onDone();
      };
      el.addEventListener('animationend', onEnd, { once: true });
    }
  }));

  return (
    <div
      ref={flashRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'white',
        pointerEvents: 'none',
        opacity: 0,
        zIndex: 25,
      }}
    />
  );
});

export default ShutterOverlay;
