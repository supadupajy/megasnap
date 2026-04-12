"use client";

import React from 'react';
import { Map, LayoutGrid, Plus, Search, User } from 'lucide-react';
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
    <nav className="fixed bottom-0 left-0 right-0 h-[100px] bg-white/95 backdrop-blur-xl rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.06)] border-t border-white/20 px-8 flex items-center justify-between z-50 pb-6">
      <button 
        onClick={() => navigate('/')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90", 
          isActive('/') ? "text-green-500" : "text-gray-400"
        )}
      >
        <Map className={cn("w-6 h-6", isActive('/') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">지도</span>
      </button>

      <button 
        onClick={() => navigate('/popular')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90", 
          isActive('/popular') ? "text-green-500" : "text-gray-400"
        )}
      >
        <LayoutGrid className={cn("w-6 h-6", isActive('/popular') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">My</span>
      </button>
      
      <div className="relative -top-8">
        <button 
          onClick={onWriteClick}
          className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-[0_12px_24px_rgba(34,197,94,0.3)] active:scale-90 active:rotate-90 transition-all duration-300"
        >
          <Plus className="w-9 h-9 stroke-[3px]" />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-green-600 font-black whitespace-nowrap uppercase tracking-tighter">Write</span>
      </div>

      <button 
        onClick={() => navigate('/search')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90", 
          isActive('/search') ? "text-green-500" : "text-gray-400"
        )}
      >
        <Search className={cn("w-6 h-6", isActive('/search') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">검색</span>
      </button>

      <button 
        onClick={() => navigate('/profile')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90", 
          isActive('/profile') ? "text-green-500" : "text-gray-400"
        )}
      >
        <User className={cn("w-6 h-6", isActive('/profile') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">내정보</span>
      </button>
    </nav>
  );
};

export default BottomNav;