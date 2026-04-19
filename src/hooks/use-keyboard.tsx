"use client";

import { useState, useEffect, useCallback } from "react";

// 전역 상태 관리를 위한 간단한 변수 (시뮬레이터 연동용)
let globalIsKeyboardOpen = false;
const listeners = new Set<(isOpen: boolean) => void>();

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(globalIsKeyboardOpen);

  const updateState = useCallback((isOpen: boolean) => {
    globalIsKeyboardOpen = isOpen;
    setIsKeyboardOpen(isOpen);
    setKeyboardHeight(isOpen ? 280 : 0); // 안드로이드 평균 키보드 높이 시뮬레이션
  }, []);

  useEffect(() => {
    const listener = (isOpen: boolean) => {
      setIsKeyboardOpen(isOpen);
      setKeyboardHeight(isOpen ? 280 : 0);
    };
    listeners.add(listener);

    // 실제 브라우저/OS의 키보드 변화 감지 (모바일 브라우저용)
    if (window.visualViewport) {
      const handleResize = () => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const heightDiff = window.innerHeight - viewport.height;
        if (heightDiff > 150) {
          updateState(true);
        } else if (!globalIsKeyboardOpen) {
          updateState(false);
        }
      };
      window.visualViewport.addEventListener("resize", handleResize);
      return () => {
        window.visualViewport?.removeEventListener("resize", handleResize);
        listeners.delete(listener);
      };
    }
    return () => listeners.delete(listener);
  }, [updateState]);

  const setIsKeyboardOpenManual = (isOpen: boolean) => {
    updateState(isOpen);
    listeners.forEach(l => l(isOpen));
  };

  return { 
    keyboardHeight, 
    isKeyboardOpen, 
    setIsKeyboardOpenManual 
  };
}

export const triggerVirtualKeyboard = (isOpen: boolean) => {
  globalIsKeyboardOpen = isOpen;
  listeners.forEach(l => l(isOpen));
};