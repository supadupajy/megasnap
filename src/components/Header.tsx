"use client";

import React from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { useNotifications } from '@/components/NotificationProvider';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadMessages, unreadNotifs } = useNotifications();

  const isHiddenPage = location.pathname === '/' && location.state?.startSelection;
  if (isHiddenPage) return null;

  // 알림/메시지는 라우트가 아니라 전역 오버레이다.
  // 어느 페이지(Flicks 포함)에서든 버튼을 누르면 현재 페이지 위에 오버레이만 덮이고,
  // X로 닫으면 페이지가 그대로 이어진다 (영상은 그대로 살아 있음).
  const openOverlay = (overlay: 'notifications' | 'messages') => {
    window.dispatchEvent(new CustomEvent(`open-${overlay}-overlay`));
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[12600] bg-white border-b border-gray-100"
      style={{
        // 안드로이드 WebView에서 fixed 헤더와 sticky 자식 페이지 사이에 발생하는
        // 1px sub-pixel 갭(그 갭으로 아바타 그라데이션이 노란 줄처럼 비치는 현상)을
        // 방지하기 위해 헤더 아래로 1px 흰색 그림자를 둬서 갭을 메운다.
        boxShadow: '0 1px 0 0 #ffffff',
      }}
    >
      <div className="h-[env(safe-area-inset-top,0px)] w-full bg-transparent" />
      
      <div className="h-16 px-4 flex items-center gap-2 max-w-lg mx-auto">
        <div
          className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shrink-0"
          onClick={() => navigate('/')}
        >
          <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span className="text-gray-900">Snap</span>
            <span className="text-yellow-500">Pop</span>
          </h1>
        </div>

        <HeaderAdBanner />

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            className="relative w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:scale-95 rounded-full transition-all"
            onClick={() => openOverlay('notifications')}
          >
            <Bell className="w-[18px] h-[18px] text-gray-700" />
            {unreadNotifs > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>
          <button
            className="relative w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:scale-95 rounded-full transition-all"
            onClick={() => openOverlay('messages')}
          >
            <MessageSquare className="w-[18px] h-[18px] text-gray-700" />
            {unreadMessages > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
