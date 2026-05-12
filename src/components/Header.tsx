"use client";

import React from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderAdBanner from './HeaderAdBanner';
import { useNotifications } from '@/components/NotificationProvider';
import { mapCache } from '@/utils/map-cache';
import { pushDebugLog } from './DebugBannerOverlay';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadMessages, unreadNotifs } = useNotifications();

  // DEBUG: Header 렌더링 추적
  const renderRef = React.useRef(0);
  renderRef.current += 1;
  React.useEffect(() => {
    pushDebugLog(`🏠 Header MOUNT path=${location.pathname}`);
    return () => pushDebugLog(`🏠 Header UNMOUNT path=${location.pathname}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  pushDebugLog(`🏠 Header render #${renderRef.current} path=${location.pathname}`);

  const isHiddenPage = location.pathname === '/' && location.state?.startSelection;
  if (isHiddenPage) {
    pushDebugLog(`🏠 Header HIDDEN (startSelection)`);
    return null;
  }

  const navigateKeepingMapPosition = (path: string) => {
    if (location.pathname === path) return;

    mapCache.keepPosition = true;

    const isTransientPage = location.pathname === '/notifications' || location.pathname === '/messages';
    const currentState = location.state as any;

    navigate(path, {
      replace: isTransientPage,
      state: {
        fromPath: isTransientPage && currentState?.fromPath
          ? currentState.fromPath
          : `${location.pathname}${location.search}${location.hash}`,
        fromState: isTransientPage
          ? currentState?.fromState ?? null
          : location.state ?? null,
      },
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[12600] bg-white border-b border-gray-100">
      <div className="h-[env(safe-area-inset-top,0px)] w-full bg-transparent" />
      
      <div className="h-16 px-4 flex items-center gap-2 max-w-lg mx-auto">
        <div
          className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shrink-0"
          onClick={() => navigate('/')}
        >
          <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span className="text-gray-900">Chora</span>
            <span className="text-indigo-600">Snap</span>
          </h1>
        </div>

        <HeaderAdBanner />

        <div className="flex items-center gap-4 shrink-0 ml-auto">
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigateKeepingMapPosition('/notifications')}
          >
            <Bell className="w-6 h-6 text-gray-600" />
            {unreadNotifs > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>
          <button 
            className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigateKeepingMapPosition('/messages')}
          >
            <MessageSquare className="w-6 h-6 text-gray-600" />
            {unreadMessages > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
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