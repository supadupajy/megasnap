"use client";

import React from 'react';
import { Map, Flame, Plus, Search, User, PlusCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: Map, label: '지도', path: '/' },
    { icon: Flame, label: '인기', path: '/popular' },
    { icon: PlusCircle, label: '글쓰기', path: '/write' },
    { icon: Search, label: '친구검색', path: '/search' },
    { icon: User, label: '내정보', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[2000] safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[64px] transition-all relative",
                isActive ? "text-indigo-600 scale-110" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className={cn(
                "w-6 h-6",
                isActive ? "fill-indigo-50" : ""
              )} />
              <span className="text-[10px] font-bold tracking-tighter">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1 w-1 h-1 bg-indigo-600 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
      {/* 안드로이드 하단 소프트키/제스처 바 여백 강제 확보 */}
      <div className="h-[env(safe-area-inset-bottom,16px)] w-full" />
    </nav>
  );
};

export default BottomNav;