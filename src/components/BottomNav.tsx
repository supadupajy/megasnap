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

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const activeIndex = navItems.findIndex((item) => item.path === location.pathname);
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  useEffect(() => {
    const btn = buttonRefs.current[safeIndex];
    const nav = navRef.current;
    if (btn && nav) {
      const navRect = nav.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const indicatorWidth = 32;
      setIndicatorStyle({
        left: btnRect.left - navRect.left + btnRect.width / 2 - indicatorWidth / 2,
        width: indicatorWidth,
      });
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
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[2000]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div ref={navRef} className="relative flex items-center justify-around max-w-lg mx-auto h-16">
        {/* Sliding indicator bar */}
        <motion.div
          className="absolute top-0 h-[3px] bg-indigo-600 rounded-full"
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = safeIndex === index;

          return (
            <button
              key={item.path}
              ref={(el) => { buttonRefs.current[index] = el; }}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                'flex flex-col items-center gap-1 min-w-[64px] transition-colors duration-200',
                isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-500'
              )}
            >
              <Icon
                className={cn(
                  'w-6 h-6 transition-all duration-200',
                  isActive ? 'scale-110' : 'scale-100'
                )}
              />
              <span
                className={cn(
                  'text-[10px] tracking-tighter transition-all duration-200',
                  isActive ? 'font-bold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
