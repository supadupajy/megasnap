"use client";

import React from 'react';
import { Settings, Grid, Bookmark, Map as MapIcon, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

const Profile = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-50 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900">내 프로필</h1>
        <Settings className="w-6 h-6 text-gray-800" />
      </header>

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

      <BottomNav onWriteClick={() => {}} />
    </div>
  );
};

export default Profile;