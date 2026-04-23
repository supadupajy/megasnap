"use client";

import React from 'react';
import { Map, Flame, Plus, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const handleWriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/write') {
      // 이미 글쓰기 페이지라면 이전 화면으로 돌아가거나 지도로 이동
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/', { replace: true });
      }
    } else {
      navigate('/write');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-3 z-50">
      <div className="max-w-md mx-auto flex items-end justify-between relative">
        <Link to="/" className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", isActive('/') ? "text-indigo-600 scale-110" : "text-gray-400")}>
          <Map className={cn("w-6 h-6", isActive('/') && "fill-indigo-600")} />
          <span className="text-[10px] font-bold">지도</span>
        </Link>
        
        <Link to="/popular" className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", isActive('/popular') ? "text-indigo-600 scale-110" : "text-gray-400")}>
          <Flame className={cn("w-6 h-6", isActive('/popular') && "fill-indigo-600")} />
          <span className="text-[10px] font-bold">인기</span>
        </Link>

        {/* Write Button - Floating style */}
        <div className="relative -top-6">
          <button 
            onClick={handleWriteClick}
            className={cn(
              "w-16 h-16 rounded-[24px] flex items-center justify-center shadow-2xl transition-all active:scale-95 border-4 border-white",
              isActive('/write') 
                ? "bg-gray-800 rotate-45 text-white" 
                : "bg-indigo-600 text-white shadow-indigo-200"
            )}
          >
            <Plus className="w-8 h-8 stroke-[3px]" />
          </button>
          <span className={cn(
            "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black transition-colors",
            isActive('/write') ? "text-indigo-600" : "text-gray-400"
          )}>
            글쓰기
          </span>
        </div>

        <Link to="/search" className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", isActive('/search') ? "text-indigo-600 scale-110" : "text-gray-400")}>
          <Search className={cn("w-6 h-6", isActive('/search') && "fill-indigo-600")} />
          <span className="text-[10px] font-bold">친구검색</span>
        </Link>

        <Link to="/profile" className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", isActive('/profile') ? "text-indigo-600 scale-110" : "text-gray-400")}>
          <User className={cn("w-6 h-6", isActive('/profile') && "fill-indigo-600")} />
          <span className="text-[10px] font-bold">내정보</span>
        </Link>
      </div>
    </div>
  );
};

export default BottomNav;