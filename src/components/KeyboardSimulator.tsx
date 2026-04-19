"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerVirtualKeyboard } from '@/hooks/use-keyboard';

const KeyboardSimulator = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT';
      const isTextArea = target.tagName === 'TEXTAREA';
      
      // 슬라이더(range) 타입은 키보드를 띄우지 않음
      const isRange = isInput && (target as HTMLInputElement).type === 'range';

      if ((isInput && !isRange) || isTextArea) {
        setIsVisible(true);
        triggerVirtualKeyboard(true);
      }
    };

    const handleBlur = (e: FocusEvent) => {
      // 다음 포커스가 다른 입력창이 아닐 때만 닫기
      setTimeout(() => {
        const active = document.activeElement;
        const isInput = active?.tagName === 'INPUT';
        const isTextArea = active?.tagName === 'TEXTAREA';
        const isRange = isInput && (active as HTMLInputElement).type === 'range';

        if (!active || (!(isInput && !isRange) && !isTextArea)) {
          setIsVisible(false);
          triggerVirtualKeyboard(false);
        }
      }, 50);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  // 실제 모바일 기기에서는 시뮬레이터를 표시하지 않음
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 300 }}
          animate={{ y: 0 }}
          exit={{ y: 300 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 h-[300px] bg-gray-200 border-t border-gray-300 z-[9999] flex flex-col items-center justify-center shadow-[0_-10px_30px_rgba(0,0,0,0.1)]"
        >
          <div className="text-gray-400 font-black text-sm uppercase tracking-widest mb-4">Virtual Keyboard</div>
          <div className="grid grid-cols-10 gap-1 px-2 w-full max-w-md">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="h-10 bg-white rounded-md shadow-sm border border-gray-100" />
            ))}
          </div>
          <button 
            onClick={() => {
              (document.activeElement as HTMLElement)?.blur();
              setIsVisible(false);
              triggerVirtualKeyboard(false);
            }}
            className="mt-6 px-6 py-2 bg-gray-400 text-white rounded-full text-xs font-bold uppercase"
          >
            Close Keyboard
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardSimulator;