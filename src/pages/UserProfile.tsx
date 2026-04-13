"use client";

import React, { useState, useMemo } from 'react';
import { Grid, Bookmark, Map as MapIcon, ChevronLeft, UserPlus, Check, MessageCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // ID에 따라 일관된 닉네임 생성
  const nickname = useMemo(() => {
    if (!userId) return '여행가';
    if (userId.includes('_')) {
      return userId.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return `Explorer ${userId.slice(0, 4)}`;
  }, [userId]);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />

      <div className="pt-[88px]">
        {/* Title Section */}
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h2 className="text-xl font-black text-gray-900">유저 프로필</h2>
                <p className="text-xs text-gray-400 font-medium">@{userId || 'traveler'} 님의 활동</p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <MoreVertical className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Profile Info */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                <img 
                  src={`https://i.pravatar.cc/150?u=${userId}`} 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white"
                />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{nickname}</h2>
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
            <Button 
              onClick={() => setIsFollowing(!isFollowing)}
              className={`flex-1 font-bold rounded-xl gap-2 h-12 transition-all ${
                isFollowing 
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isFollowing ? (
                <>
                  <Check className="w-4 h-4" /> 팔로잉
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> 팔로우
                </>
              )}
            </Button>
            <Button variant="outline" className="flex-1 border-gray-200 text-gray-900 font-bold rounded-xl gap-2 h-12">
              <MessageCircle className="w-4 h-4" /> 메시지
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 mb-4">
            <button className="flex-1 py-3 flex justify-center border-b-2 border-indigo-600">
              <Grid className="w-6 h-6 text-indigo-600" />
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
                  src={`https://picsum.photos/seed/${userId}${i}/300/300`} 
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

export default UserProfile;