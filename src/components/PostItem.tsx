"use client";

import React from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Flame, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostItemProps {
  user: {
    name: string;
    avatar: string;
  };
  content: string;
  location: string;
  likes: number;
  image: string;
  isLiked?: boolean;
  isAd?: boolean;
  isGif?: boolean;
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
}

const PostItem = ({ user, content, location, likes, image, isLiked, isAd, isGif, borderType = 'none' }: PostItemProps) => {
  const isPopular = !isAd && borderType === 'popular';

  return (
    <div className="bg-white mb-8 last:mb-20">
      {/* User Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-green-500">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full rounded-full object-cover border-2 border-white" 
            />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">{user.name}</p>
            <div className="flex items-center text-green-500 gap-0.5 mt-0.5">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-medium">{location}</span>
            </div>
          </div>
        </div>
        <button className="text-gray-400">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image with Special Border */}
      <div className="px-4">
        <div className={cn(
          "relative aspect-square w-full rounded-2xl transition-all duration-500",
          isAd ? "p-[4px] bg-blue-500 shadow-lg shadow-blue-500/20" : (
            isPopular ? "p-[4px] bg-[#ccff00] shadow-lg shadow-[#ccff00]/20" : (
              borderType === 'silver' ? "p-[4px] bg-gradient-to-br from-gray-300 via-white to-gray-400 shadow-lg" : (
                borderType === 'gold' ? "p-[4px] bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 shadow-lg" : ""
              )
            )
          )
        )}>
          <div className="w-full h-full rounded-[14px] overflow-hidden bg-white relative z-10">
            <img
              src={image}
              alt="post"
              className="w-full h-full object-cover"
            />
          </div>
          
          {isAd ? (
            <div className="absolute top-4 left-4 z-20 bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-white/10">
              AD
            </div>
          ) : isPopular && (
            <div className="absolute top-4 left-4 z-20 bg-[#ccff00] text-black px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-black/5">
              <Flame className="w-3.5 h-3.5 fill-black" />
              HOT
            </div>
          )}

          {isGif && (
            <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md text-white p-1.5 rounded-full shadow-lg border border-white/20">
              <Play className="w-3 h-3 fill-white" />
            </div>
          )}
        </div>
      </div>

      {/* Interaction Bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button className="transition-transform active:scale-125">
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
            </button>
            <button>
              <MessageCircle className="w-6 h-6 text-gray-700" />
            </button>
            <button>
              <Share2 className="w-6 h-6 text-gray-700" />
            </button>
          </div>
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </div>

        {/* Likes & Content */}
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-gray-900">좋아요 {likes.toLocaleString()}개</p>
          <div className="flex gap-2 items-start">
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{user.name}</span>
            <p className="text-sm text-gray-800 leading-snug line-clamp-2">
              {content}
            </p>
          </div>
          <button className="text-xs text-gray-400 font-medium">댓글 12개 모두 보기</button>
        </div>
      </div>
    </div>
  );
};

export default PostItem;