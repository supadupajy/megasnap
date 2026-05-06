"use client";

import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, ChevronLeft, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VideoSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* 고정 상단 헤더 */}
      <div className="fixed top-[env(safe-area-inset-top,0px)] pt-[64px] inset-x-0 z-[100] bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-semibold text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">영상 검색</h2>
          </div>
        </div>
      </div>

      {/* 검색 입력창 */}
      <div className="shrink-0 bg-white z-[90] pt-[calc(env(safe-area-inset-top,0px)+122px)]">
        <div className="px-4 pb-2">
          <div className="relative mb-4">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="원하는 영상을 검색해 보세요"
              className="w-full pl-12 h-14 bg-white border-2 border-indigo-600 rounded-2xl outline-none font-bold placeholder:text-gray-400 shadow-sm transition-all focus:ring-2 focus:ring-indigo-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* 빈 상태 */}
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        <div className="px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-orange-300" />
          </div>
          <p className="text-sm text-gray-400 font-bold leading-relaxed">
            {searchQuery ? '검색 결과가 없습니다.' : '원하는 영상을 검색해 보세요.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoSearch;
