"use client";

import { useState, useEffect, useCallback } from "react";

// 전역 상태 및 리스너 관리
let globalIsKeyboardOpen = false;
const listeners = new Set<(isOpen: boolean) => void>();

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(globalIsKeyboardOpen);
  const [keyboardHeight, setKeyboardHeight] = useState(globalIsKeyboardOpen ? 280 : 0);

  const updateState = useCallback((isOpen: boolean) => {
    globalIsKeyboardOpen = isOpen;
    setIsKeyboardOpen(isOpen);
    setKeyboardHeight(isOpen ? 280 : 0);
    // 모든 리스너에게 알림
    listeners.forEach(l => l(isOpen));
  }, []);

  useEffect(() => {
    const handleChange = (isOpen: boolean) => {
      setIsKeyboardOpen(isOpen);
      setKeyboardHeight(isOpen ? 280 : 0);
    };

    listeners.add(handleChange);
    
    // 실제 기기 브라우저 대응
    if (window.visualViewport) {
      const handleResize = () => {
        const heightDiff = window.innerHeight - window.visualViewport!.height;
        if (heightDiff > 150) {
          updateState(true);
        }
      };
      window.visualViewport.addEventListener("resize", handleResize);
      return () => {
        window.visualViewport?.removeEventListener("resize", handleResize);
        listeners.delete(handleChange);
      };
    }

    return () => {
      listeners.delete(handleChange);
    };
  }, [updateState]);

  const setIsKeyboardOpenManual = (isOpen: boolean) => {
    updateState(isOpen);
  };

  return { 
    keyboardHeight, 
    isKeyboardOpen, 
    setIsKeyboardOpenManual 
  };
}