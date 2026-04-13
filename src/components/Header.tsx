"use client";

import React from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MOCK_NOTIFICATIONS } from '@/lib/mock-data';

const Header = () => {
  const navigate = useNavigate();
  const notificationCount = MOCK_NOTIFICATIONS.length;

  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
      <h1 
        className="text-xl font-bold text-indigo-600 tracking-tight cursor-pointer"
        onClick={() => navigate('/')}
      >
        MegaSnap
      </h1>
      <div className="flex items-center gap-4">
        <button 
          className="relative p-1 hover:bg-gray-50 rounded-full transition-colors"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-6 h-6 text-gray-600" />
          {notificationCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
              {notificationCount}
            </span>
          )}
        </button>
        <button 
          className="p-1 hover:bg-gray-50 rounded-full transition-colors"
          onClick={() => navigate('/messages')}
        >
          <MessageSquare className="w-6 h-6 text-gray-600" />
        </button>
      </div>
    </header>
  );
};

export default Header;