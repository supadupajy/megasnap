"use client";

import { useState, useEffect } from "react";

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      // 키보드가 올라오면 visualViewport의 높이가 줄어듭니다.
      const heightDiff = window.innerHeight - viewport.height;
      
      // 일반적인 스크롤이나 툴바 변화와 구분하기 위해 150px 이상일 때만 키보드로 간주
      if (heightDiff > 150) {
        setKeyboardHeight(heightDiff);
        setIsKeyboardOpen(true);
      } else {
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
      }
    };

    window.visualViewport.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}