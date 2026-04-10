"use client";

import React from 'react';
import { Grid, Bookmark, Map as MapIcon, ChevronLeft, UserPlus, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900">@{userId || 'traveler'}</h1>
        <div className="w-6" />
      </header>

      <div className="pt-[88px] p-6">
        {/* Profile Info */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-400 to-green-500">
              <img 
                src={`https://i.pravatar.cc/150?u=${userId}`} 
                alt="profile" 
                className="w-full h-full rounded-full object-cover border-4 border-white"
              />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-gray-900 mb-1">{userId?.split('_')[0] || '여행가'}</h2>
            <p className="text-sm text-gray-500 mb-4">새로운 장소를 찾는 것을 좋아합니다 ✈️</p>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="font-bold text-gray-900">42</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">856</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">320</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl gap-2">
            <UserPlus className="w-4 h-4" /> 팔로우
          </Button>
          <Button variant="outline" className="flex-1 border-gray-200 text-gray-900 font-bold rounded-xl gap-2">
            <MessageCircle className="w-4 h-4" /> 메시지
          </Button>
        </div>

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
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 overflow-hidden rounded-sm">
              <img 
                src={`https://picsum.photos/seed/${userId}${i}/300/300`} 
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

export default UserProfile;