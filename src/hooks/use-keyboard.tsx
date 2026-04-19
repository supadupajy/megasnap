"use client";

import { useState, useEffect, useCallback } from "react";

let globalIsKeyboardOpen = false;
const listeners = new Set<(isOpen: boolean) => void>();

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(globalIsKeyboardOpen);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const updateState = useCallback((isOpen: boolean, height: number = 280) => {
    globalIsKeyboardOpen = isOpen;
    setIsKeyboardOpen(isOpen);
    setKeyboardHeight(isOpen ? height : 0);
    listeners.forEach(l => l(isOpen));
  }, []);

  useEffect(() => {
    const handleChange = (isOpen: boolean) => {
      setIsKeyboardOpen(isOpen);
    };
    listeners.add(handleChange);
    
    // 실제 스마트폰 브라우저에서 키보드가 올라올 때의 뷰포트 변화 감지
    if (window.visualViewport) {
      const handleResize = () => {
        const viewport = window.visualViewport!;
        const heightDiff = window.innerHeight - viewport.height;
        
        // 높이 차이가 150px 이상이면 키보드가 올라온 것으로 간주
        if (heightDiff > 150) {
          updateState(true, heightDiff);
        } else if (globalIsKeyboardOpen && heightDiff < 50) {
          // 수동으로 연 게 아니라면 닫힌 것으로 처리
          updateState(false, 0);
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
    updateState(isOpen, 280);
  };

  return { 
    keyboardHeight, 
    isKeyboardOpen, 
    setIsKeyboardOpenManual 
  };
}