"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';

import { formatCount, getOptimizedMarkerImage } from '@/lib/utils';

interface ProfileStatsProps {
  userId?: string;
  avatarUrl: string;
  displayName: string;
  bio?: string | null;
  postsCount: number;
  followerCount: number;
  followingCount: number;
  fallbackImage: string;
  onPostsClick: () => void;
}

const ProfileStats = ({
  userId,
  avatarUrl,
  displayName,
  bio,
  postsCount,
  followerCount,
  followingCount,
  fallbackImage,
  onPostsClick,
}: ProfileStatsProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-6 mb-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
          <img
            src={getOptimizedMarkerImage(avatarUrl, userId || 'profile')}
            alt="profile"
            loading="lazy"
            decoding="async"
            className="w-full h-full rounded-full object-cover border-4 border-white"
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackImage;
            }}
          />
        </div>
      </div>

      <div className="flex-1">
        <h2 className="text-xl font-black text-gray-900 mb-1">{displayName}</h2>
        <p className="text-sm text-gray-500 mb-4">{bio || '지도를 여행하는 탐험가 📍'}</p>

        <div className="flex gap-4">
          <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={onPostsClick}>
            <p className="font-bold text-gray-900">{formatCount(postsCount)}</p>
            <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
          </div>

          <div
            className="text-center cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'followers' } })}
          >
            <p className="font-bold text-gray-900">{formatCount(followerCount)}</p>
            <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
          </div>

          <div
            className="text-center cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'following' } })}
          >
            <p className="font-bold text-gray-900">{formatCount(followingCount)}</p>
            <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileStats;