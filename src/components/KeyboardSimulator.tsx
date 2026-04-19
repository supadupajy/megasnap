"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboard } from '@/hooks/use-keyboard';

const KeyboardSimulator = () => {
  const { isKeyboardOpen, setIsKeyboardOpenManual } = useKeyboard();

  // 프리뷰 환경에서만 보이도록 설정 (실제 APK에서는 작동하지 않음)
  const isPreview = window.location.hostname === 'localhost' || window.location.hostname.includes('dyad.sh');

  if (!isPreview) return null;

  return (
    <AnimatePresence>
      {isKeyboardOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#E0E0E0] select-none pointer-events-auto"
          style={{ height: '280px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Android Keyboard Mock UI */}
          <div className="w-full h-full flex flex-col p-1 gap-1">
            {/* Top Bar */}
            <div className="h-8 flex items-center justify-between px-4 text-[#757575]">
              <div className="flex gap-4">
                <span className="text-[10px] font-bold">GIF</span>
                <span className="text-[10px] font-bold">스티커</span>
              </div>
              <button 
                onClick={() => setIsKeyboardOpenManual(false)}
                className="text-[10px] font-black text-indigo-600"
              >
                닫기
              </button>
            </div>

            {/* Keys Mockup */}
            <div className="flex-1 grid grid-rows-4 gap-1">
              <div className="flex gap-1 px-1">
                {['Q','W','E','R','T','Y','U','I','O','P'].map(k => (
                  <div key={k} className="flex-1 bg-white rounded-md shadow-sm flex items-center justify-center text-sm font-medium text-gray-800">{k}</div>
                ))}
              </div>
              <div className="flex gap-1 px-4">
                {['A','S','D','F','G','H','J','K','L'].map(k => (
                  <div key={k} className="flex-1 bg-white rounded-md shadow-sm flex items-center justify-center text-sm font-medium text-gray-800">{k}</div>
                ))}
              </div>
              <div className="flex gap-1 px-1">
                <div className="w-12 bg-[#BDBDBD] rounded-md flex items-center justify-center text-white">⇧</div>
                {['Z','X','C','V','B','N','M'].map(k => (
                  <div key={k} className="flex-1 bg-white rounded-md shadow-sm flex items-center justify-center text-sm font-medium text-gray-800">{k}</div>
                ))}
                <div className="w-12 bg-[#BDBDBD] rounded-md flex items-center justify-center text-white">⌫</div>
              </div>
              <div className="flex gap-1 px-1">
                <div className="w-12 bg-[#BDBDBD] rounded-md flex items-center justify-center text-sm font-bold">!#1</div>
                <div className="w-10 bg-[#BDBDBD] rounded-md flex items-center justify-center text-sm">🌐</div>
                <div className="flex-1 bg-white rounded-md shadow-sm flex items-center justify-center text-xs text-gray-400">한글</div>
                <div className="w-10 bg-white rounded-md shadow-sm flex items-center justify-center text-sm">.</div>
                <div className="w-16 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold">이동</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardSimulator;