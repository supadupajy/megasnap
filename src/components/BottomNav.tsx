"use client";

import React from 'react';
import { Map, Flame, Plus, Search, User } from 'lucide-react';
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
    <nav className="fixed bottom-0 left-0 right-0 h-[106px] bg-white/95 backdrop-blur-xl rounded-t-[24px] shadow-[0_-8px_30px_rgba(0,0,0,0.05)] border-t border-white/20 grid grid-cols-5 items-center z-50 pb-8">
      {/* 첫 번째 메뉴: 지도 */}
      <button 
        onClick={() => navigate('/')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/') ? "text-indigo-600" : "text-gray-400"
        )}
      >
        <Map className={cn("w-6 h-6", isActive('/') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">지도</span>
      </button>

      {/* 두 번째 메뉴: HOT */}
      <button 
        onClick={() => navigate('/popular')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/popular') ? "text-orange-500" : "text-gray-400"
        )}
      >
        <Flame className={cn("w-6 h-6", isActive('/popular') ? "fill-orange-500 stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">HOT</span>
      </button>
      
      {/* 세 번째 메뉴: 글쓰기 (중앙) */}
      <div className="relative flex flex-col items-center w-full">
        <div className="absolute -top-12">
          <button 
            onClick={onWriteClick}
            className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_20px_rgba(79,70,229,0.25)] active:scale-90 active:rotate-90 transition-all duration-300"
          >
            <Plus className="w-7 h-7 stroke-[3px]" />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-indigo-600 font-black whitespace-nowrap tracking-tighter">글쓰기</span>
        </div>
      </div>

      {/* 네 번째 메뉴: 인물검색 */}
      <button 
        onClick={() => navigate('/search')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/search') ? "text-indigo-600" : "text-gray-400"
        )}
      >
        <Search className={cn("w-6 h-6", isActive('/search') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">인물검색</span>
      </button>

      {/* 다섯 번째 메뉴: 내정보 */}
      <button 
        onClick={() => navigate('/profile')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/profile') ? "text-indigo-600" : "text-gray-400"
        )}
      >
        <User className={cn("w-6 h-6", isActive('/profile') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">내정보</span>
      </button>
    </nav>
  );
};

export default BottomNav;