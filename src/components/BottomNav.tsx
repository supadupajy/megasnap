"use client";

import React from 'react';
import { Map, Flame, Plus, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleWriteClick = () => {
    // 이동 전 현재 경로가 write가 아니라면 새로운 작성을 시작하는 것이므로
    // 필요 시 여기서 draft를 유지하거나 초기화할 수 있습니다.
    navigate('/write');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[80px] bg-white border-t border-gray-100 flex items-center justify-around px-2 z-[2000]">
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

      <button 
        onClick={() => navigate('/popular')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/popular') ? "text-orange-500" : "text-gray-400"
        )}
      >
        <Flame className={cn("w-6 h-6", isActive('/popular') ? "fill-orange-500 stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">인기</span>
      </button>
      
      <button 
        onClick={handleWriteClick}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/write') ? "text-indigo-600" : "text-gray-400"
        )}
      >
        <Plus className={cn("w-6 h-6", isActive('/write') ? "stroke-[3px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">글쓰기</span>
      </button>

      <button 
        onClick={() => navigate('/search')}
        className={cn(
          "flex flex-col items-center gap-1.5 transition-all active:scale-90 w-full", 
          isActive('/search') ? "text-indigo-600" : "text-gray-400"
        )}
      >
        <Search className={cn("w-6 h-6", isActive('/search') ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className="text-[10px] font-bold tracking-tight">친구검색</span>
      </button>

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