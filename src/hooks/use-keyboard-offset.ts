import { useEffect, useState } from 'react';

let globalViewportBaseHeight = 0;

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

  useEffect(() => {
    if (!active) {
      setKeyboardOffset(0);
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

      setKeyboardOffset(activeElementIsEditable && offset > 120 ? offset : 0);
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
