"use client";

import React, { useState } from 'react';
import { Settings, Grid, Bookmark, Map as MapIcon, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';

const Profile = () => {
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />

      <div className="pt-[88px]">
        {/* Title Section - Popular 페이지와 동일한 레이아웃 */}
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shadow-sm">
                <UserIcon className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">내 프로필</h2>
                <p className="text-xs text-gray-400 font-medium">나의 활동과 기록을 확인하세요</p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Profile Info */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-green-500">
                <img 
                  src="https://i.pravatar.cc/150?u=me" 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white"
                />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">Dyad_Explorer</h2>
              <p className="text-sm text-gray-500 mb-4">지도를 여행하는 탐험가 📍</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-gray-900">128</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">1.2k</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">850</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                </div>
              </div>
            </div>
          </div>

          <Button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">
            프로필 편집
          </Button>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 mb-4">
            <button className="flex-1 py-3 flex justify-center border-b-2 border-green-500">
              <Grid className="w-6 h-6 text-green-500" />
            </button>
            <button className="flex-1 py-3 flex justify-center text-gray-300">
              <MapIcon className="w-6 h-6" />
            </button>
            <button className="flex-1 py-3 flex justify-center text-gray-300">
              <Bookmark className="w-6 h-6" />
            </button>
          </div>

          {/* Grid Posts */}
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 overflow-hidden rounded-sm">
                <img 
                  src={`https://picsum.photos/seed/${i + 50}/300/300`} 
                  alt="" 
                  className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Profile;