"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Map, Flame, PlusCircle, UsersRound, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { mapCache } from '@/utils/map-cache';

const navItems = [
  { icon: Map, label: '지도', path: '/' },
  { icon: Flame, label: '인기', path: '/popular' },
  { icon: PlusCircle, label: '업로드', path: '/write' },
  { icon: UsersRound, label: '친구', path: '/friends' },
  { icon: User, label: '내정보', path: '/profile' },
];

// 하위 경로(예: /settings, /search 등)에 들어갔을 때도 부모 탭이 활성 상태로 유지되도록 매핑
// path 우선순위: 첫 번째로 매치되는 것이 사용됨
const subRouteToTab: { match: (pathname: string) => boolean; tabPath: string }[] = [
  // 친구 탭: /friends 하위 경로 + /search (친구 검색)
  { match: (p) => p === '/search' || p.startsWith('/friends'), tabPath: '/friends' },
  // 인기 탭: /popular 하위 경로 + /video-search (포스팅 검색)
  { match: (p) => p === '/video-search' || p.startsWith('/popular'), tabPath: '/popular' },
  // 내정보 탭: /profile, /settings 하위 경로
  { match: (p) => p.startsWith('/profile') || p.startsWith('/settings'), tabPath: '/profile' },
  // 업로드 탭
  { match: (p) => p.startsWith('/write'), tabPath: '/write' },
];

const PILL_WIDTH = 64;
const PILL_HEIGHT = 60;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pillLeft, setPillLeft] = useState(0);
  const [ready, setReady] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const resolveActiveIndex = () => {
    const exact = navItems.findIndex((item) => item.path === location.pathname);
    if (exact !== -1) return exact;

    const matched = subRouteToTab.find((entry) => entry.match(location.pathname));
    if (matched) {
      const idx = navItems.findIndex((item) => item.path === matched.tabPath);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const activeIndex = resolveActiveIndex();
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  useEffect(() => {
    const iconEl = iconRefs.current[safeIndex];
    const nav = navRef.current;
    if (iconEl && nav) {
      const navRect = nav.getBoundingClientRect();
      const iconRect = iconEl.getBoundingClientRect();
      setPillLeft(iconRect.left - navRect.left + iconRect.width / 2 - PILL_WIDTH / 2);
      setReady(true);
    }
  }, [safeIndex]);

  const handleNavClick = (path: string) => {
    if (path === '/') {
      if (location.pathname === '/') return;
      mapCache.keepPosition = true;
    }
    navigate(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[20000]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div ref={navRef} className="relative flex items-center justify-around max-w-lg mx-auto h-16">
        {/* Sliding pill background */}
        {ready && (
          <motion.div
            className="absolute bg-gray-200 pointer-events-none"
            style={{ top: '50%', y: '-44%', height: PILL_HEIGHT, width: PILL_WIDTH, borderRadius: 18 }}
            animate={{ left: pillLeft }}
            initial={{ left: pillLeft }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = safeIndex === index;

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className="relative flex flex-col items-center gap-1 min-w-[64px]"
            >
              {/* Icon wrapper */}
              <div
                ref={(el) => { iconRefs.current[index] = el; }}
                className="flex items-center justify-center w-[52px] h-9"
              >
                <Icon
                  className={cn(
                    'w-6 h-6 transition-all duration-200',
                    isActive ? 'scale-110 text-gray-900' : 'scale-100 text-gray-400'
                  )}
                />
              </div>
              {/* Label */}
              <span
                className={cn(
                  'relative text-[10px] tracking-tighter leading-none transition-all duration-200',
                  isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-400'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {isIOS && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-slate-900/35"
          style={{ bottom: '6px' }}
        />
      )}
    </nav>
  );
};

export default BottomNav;