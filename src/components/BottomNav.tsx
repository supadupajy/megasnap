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

const PILL_WIDTH = 64;
const PILL_HEIGHT = 56;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pillLeft, setPillLeft] = useState(0);
  const [ready, setReady] = useState(false);

  const activeIndex = navItems.findIndex((item) => item.path === location.pathname);
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
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[2000]"
      style={{
        paddingTop: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      <div ref={navRef} className="relative flex items-center justify-around max-w-lg mx-auto h-16">
        {/* Sliding pill background */}
        {ready && (
          <motion.div
            className="absolute bg-gray-700 pointer-events-none"
            style={{ top: '50%', y: '-50%', height: PILL_HEIGHT, width: PILL_WIDTH, borderRadius: 18 }}
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
                    isActive ? 'scale-110 text-white' : 'scale-100 text-gray-400'
                  )}
                />
              </div>
              {/* Label */}
              <span
                className={cn(
                  'relative text-[10px] tracking-tighter leading-none transition-all duration-200',
                  isActive ? 'font-bold text-white' : 'font-medium text-gray-400'
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
