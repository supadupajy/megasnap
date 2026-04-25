"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, MessageSquare, ChevronLeft, PenLine, Send } from 'lucide-react';
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
  
  // 위치 선택 모드 체크
  const isSelectingLocationOnMap = location.pathname === '/' && location.state?.startSelection;
  if (isSelectingLocationOnMap) return null;

  // 글쓰기 페이지 여부 체크
  const isWritePage = location.pathname === '/write';

  return (
    <header className="fixed top-0 left-0 right-0 z-[50] bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="h-[env(safe-area-inset-top,0px)] w-full bg-transparent" />
      
      <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-lg mx-auto">
        {isWritePage ? (
          /* 글쓰기 전용 헤더 디자인 */
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                <PenLine className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 leading-tight">새 게시물 작성</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Leave your trace</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-800 active:scale-95 transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
                <Send className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </>
        ) : (
          /* 일반 페이지 헤더 디자인 */
          <>
            <div 
              className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              onClick={() => navigate('/')}
            >
              <h1 className="text-2xl font-black tracking-tighter italic shrink-0">
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
          </>
        )}
      </div>
    </header>
  );
};

export default Header;