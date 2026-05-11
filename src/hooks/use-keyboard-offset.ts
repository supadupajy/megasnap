import { useEffect, useRef, useState } from 'react';

let globalViewportBaseHeight = 0;

const KEYBOARD_OFFSET_THRESHOLD = 120;
const KEYBOARD_CLOSE_SETTLE_MS = 180;

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
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearResetTimer = () => {
      if (resetTimerRef.current == null) return;
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    };

    const commitKeyboardOffset = (nextOffset: number) => {
      if (Math.abs(keyboardOffsetRef.current - nextOffset) < 2) return;
      keyboardOffsetRef.current = nextOffset;
      setKeyboardOffset(nextOffset);
    };

    if (!active) {
      clearResetTimer();
      commitKeyboardOffset(0);
      return;
    }

    const updateKeyboardOffset = () => {
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
      const nextOffset = activeElementIsEditable && offset > KEYBOARD_OFFSET_THRESHOLD ? offset : 0;

      if (nextOffset > 0) {
        clearResetTimer();
        commitKeyboardOffset(nextOffset);
        return;
      }

      if (keyboardOffsetRef.current === 0 || resetTimerRef.current != null) return;

      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        commitKeyboardOffset(0);
      }, KEYBOARD_CLOSE_SETTLE_MS);
    };

    const scheduleUpdates = () => {
      updateKeyboardOffset();
      window.setTimeout(updateKeyboardOffset, 80);
      window.setTimeout(updateKeyboardOffset, 220);
      window.setTimeout(updateKeyboardOffset, 420);
    };

    scheduleUpdates();
    window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
    window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);
    window.addEventListener('resize', updateKeyboardOffset);
    window.addEventListener('orientationchange', scheduleUpdates);
    window.addEventListener('focusin', scheduleUpdates);
    window.addEventListener('focusout', scheduleUpdates);

    return () => {
      clearResetTimer();
      window.visualViewport?.removeEventListener('resize', updateKeyboardOffset);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardOffset);
      window.removeEventListener('resize', updateKeyboardOffset);
      window.removeEventListener('orientationchange', scheduleUpdates);
      window.removeEventListener('focusin', scheduleUpdates);
      window.removeEventListener('focusout', scheduleUpdates);
    };
  }, [active]);

  return keyboardOffset;
};
