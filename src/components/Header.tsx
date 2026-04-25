"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

// 사운드 파일 경로 (더 명확하고 호환성 높은 MP3 파일로 교체)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // ✅ [FIX] 위치 선택 모드(지도를 직접 조작할 때)에만 헤더를 숨기고, 
  // 글쓰기 페이지(Write) 자체에서는 헤더가 보이도록 조건 수정
  const isSelectingLocation = location.pathname === '/' && location.state?.startSelection;
  if (isSelectingLocation) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-[50] bg-white/80 backdrop-blur-xl border-b border-gray-100">
      {/* 안드로이드 상단 상태바 여백 - Index와의 간격을 위해 높이를 최소화하거나 Index에서 조절 */}
      <div className="h-[env(safe-area-inset-top,0px)] w-full bg-transparent" />
      
      <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-lg mx-auto">
        <div 
          className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          onClick={() => navigate('/')}
        >
          <h1 
            className="text-2xl font-black tracking-tighter italic shrink-0"
          >
            <span className="text-gray-900">Chora</span>
            <span className="text-indigo-600">Snap</span>
          </h1>
        </div>

        <HeaderAdBanner />

        <div className="flex items-center gap-4 shrink-0">
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="w-6 h-6 text-gray-600" />
          </button>
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/messages')}
          >
            <MessageSquare className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;