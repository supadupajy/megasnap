"use client";

import React from 'react';
import { Bell, MessageSquare } from 'lucide-react';

const Header = () => {
  return (
    // top-6 로 약간 더 내려서 모바일에서도 잘 보이게 함
    // bg-white/80 + backdrop-blur 로 하단 네비와 시각적 통일성 확보
    <header className="fixed top-6 left-0 right-0 h-14 bg-white/80 backdrop-blur-md z-50 flex items-center justify-between px-4 pb-2 border-b border-gray-100">
      <h1 className="text-xl font-bold text-green-500 tracking-tight">MegaSnap</h1>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="w-6 h-6 text-gray-600" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
            2
          </span>
        </div>
        <MessageSquare className="w-6 h-6 text-gray-600" />
      </div>
    </header>
  );
};

export default Header;