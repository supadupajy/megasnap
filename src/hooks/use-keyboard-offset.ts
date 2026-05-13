import { useEffect, useRef, useState } from 'react';

let globalViewportBaseHeight = 0;

const KEYBOARD_OFFSET_THRESHOLD = 120;

// 🐛 디버그: 키보드 감지 이벤트 로그 (BottomNav 디버그 패널에서 사용)
type KbDebugEvent = {
  ts: number;
  source: string;
  winH: number;
  vpH: number;
  vpTop: number;
  baseH: number;
  layoutDiff: number;
  baseDiff: number;
  rawOffset: number;
  shrunken: boolean;
  editable: boolean;
  committed: number;
};
(window as any).__kbDebug = (window as any).__kbDebug || { events: [] as KbDebugEvent[], listeners: new Set<() => void>() };
const kbDebug = (window as any).__kbDebug;
const pushKbDebugEvent = (e: KbDebugEvent) => {
  kbDebug.events.push(e);
  if (kbDebug.events.length > 12) kbDebug.events.shift();
  kbDebug.listeners.forEach((l: () => void) => l());
};

const isEditableElement = (element: Element | null) => {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
};

export const useKeyboardOffset = (active = true) => {
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const keyboardOffsetRef = useRef(0);

  useEffect(() => {
    const commitKeyboardOffset = (nextOffset: number) => {
      if (keyboardOffsetRef.current === nextOffset) return;
      keyboardOffsetRef.current = nextOffset;
      setKeyboardOffset(nextOffset);
    };

    if (!active) {
      commitKeyboardOffset(0);
      return;
    }

    const computeRawOffset = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const activeElementIsEditable = isEditableElement(document.activeElement);

      if (!activeElementIsEditable || viewportHeight > globalViewportBaseHeight) {
        globalViewportBaseHeight = Math.max(globalViewportBaseHeight, window.innerHeight, viewportHeight);
      }

      const layoutViewportDiff = Math.max(0, window.innerHeight - viewportHeight - viewportTop);
      const baseViewportDiff = Math.max(0, globalViewportBaseHeight - viewportHeight - viewportTop);
      const offset = Math.max(layoutViewportDiff, baseViewportDiff);

      return {
        activeElementIsEditable,
        rawOffset: offset,
      };
    };

    // 키보드 상태는 두 가지 시점에만 갱신한다.
    //  1) 키보드 올라옴: editable 요소가 포커스 + visualViewport가 충분히 줄어든 상태
    //     → 그 시점의 키보드 높이를 한 번만 커밋. 이후 부드럽게 줄어드는 중간값은 무시.
    //  2) 키보드 내려감: visualViewport.height가 layout viewport에 거의 도달한 시점
    //     → 0으로 한 번에 떨어뜨림.
    //
    // blur만 발생하고 키보드 OS 애니메이션은 진행 중인 상황에서 0으로 즉시 떨어뜨리지 않는다.
    // 이 시점에 sheet/BottomNav가 점프하면 키보드 내림 애니메이션과 어긋나서 깜빡임이 생긴다.
    const updateKeyboardState = (source: string = 'manual') => {
      const { activeElementIsEditable, rawOffset } = computeRawOffset();
      const viewportIsShrunken = rawOffset > KEYBOARD_OFFSET_THRESHOLD;

      const viewport = window.visualViewport;
      const winH = window.innerHeight;
      const vpH = viewport?.height ?? winH;
      const vpTop = viewport?.offsetTop ?? 0;
      const layoutDiff = Math.max(0, winH - vpH - vpTop);
      const baseDiff = Math.max(0, globalViewportBaseHeight - vpH - vpTop);

      let committed = keyboardOffsetRef.current;

      if (keyboardOffsetRef.current === 0) {
        if (activeElementIsEditable && viewportIsShrunken) {
          commitKeyboardOffset(rawOffset);
          committed = rawOffset;
        }
      } else {
        if (!viewportIsShrunken) {
          commitKeyboardOffset(0);
          committed = 0;
        }
      }

      pushKbDebugEvent({
        ts: Date.now(),
        source,
        winH,
        vpH: Math.round(vpH),
        vpTop: Math.round(vpTop),
        baseH: globalViewportBaseHeight,
        layoutDiff: Math.round(layoutDiff),
        baseDiff: Math.round(baseDiff),
        rawOffset: Math.round(rawOffset),
        shrunken: viewportIsShrunken,
        editable: activeElementIsEditable,
        committed: Math.round(committed),
      });
    };

    const scheduleUpdates = (source: string = 'manual') => {
      updateKeyboardState(`${source}:0ms`);
      window.setTimeout(() => updateKeyboardState(`${source}:80ms`), 80);
      window.setTimeout(() => updateKeyboardState(`${source}:220ms`), 220);
      window.setTimeout(() => updateKeyboardState(`${source}:420ms`), 420);
    };

    const onVpResize = () => updateKeyboardState('vp.resize');
    const onVpScroll = () => updateKeyboardState('vp.scroll');
    const onWinResize = () => updateKeyboardState('win.resize');
    const onOrient = () => scheduleUpdates('orient');
    const onFocusIn = () => scheduleUpdates('focusin');
    const onFocusOut = () => scheduleUpdates('focusout');

    scheduleUpdates('init');
    window.visualViewport?.addEventListener('resize', onVpResize);
    window.visualViewport?.addEventListener('scroll', onVpScroll);
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onOrient);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);

    return () => {
      window.visualViewport?.removeEventListener('resize', onVpResize);
      window.visualViewport?.removeEventListener('scroll', onVpScroll);
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onOrient);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, [active]);

  return keyboardOffset;
};
