"use client";

import React from 'react';
import { Map, Trophy, Plus, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onWriteClick: () => void;
}

const BottomNav = ({ onWriteClick }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 flex items-center justify-between z-50 pb-10">
      <button 
        onClick={() => navigate('/')}
        className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/') ? "text-green-500" : "text-gray-400")}
      >
        <Map className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-medium">지도</span>
      </button>
      <button 
        onClick={() => navigate('/popular')}
        className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/popular') ? "text-green-500" : "text-gray-400")}
      >
        <Trophy className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-medium">인기</span>
      </button>
      
      <div className="relative -top-6">
        <button 
          onClick={onWriteClick}
          className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8" strokeWidth={2.5} />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-medium whitespace-nowrap">글쓰기</span>
      </div>

      <button 
        onClick={() => navigate('/search')}
        className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/search') ? "text-green-500" : "text-gray-400")}
      >
        <Search className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-medium">검색</span>
      </button>
      <button 
        onClick={() => navigate('/profile')}
        className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/profile') ? "text-green-500" : "text-gray-400")}
      >
        <User className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-medium">내정보</span>
      </button>
    </nav>
  );
};

export default BottomNav;