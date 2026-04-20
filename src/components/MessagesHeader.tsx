"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const MessagesHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-50 flex items-center px-4 border-b border-gray-100">
      <button 
        onClick={() => navigate(-1)}
        className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <ChevronLeft className="w-6 h-6 text-gray-600" />
      </button>
      <h1 className="flex-grow text-center text-xl font-bold text-gray-900 pr-8">
        Direct Message
      </h1>
    </header>
  );
};

export default MessagesHeader;