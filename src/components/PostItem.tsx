"use client";

import React from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';

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
  isPopular?: boolean; // For popular posts with moving red gradient border
  isInfluencer?: boolean; // For influencer posts with silver/gold border
}

const PostItem = ({ user, content, location, likes, image, isLiked, isPopular, isInfluencer }: PostItemProps) => {
  return (
    <div className="bg-white mb-8 last:mb-20">
      {/* User Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-purple-600">
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

      {/* Main Image with special border effects */}
      <div className="relative aspect-square w-full bg-gray-100 overflow-hidden">
        <img 
          src={image} 
          alt="post" 
          className="w-full h-full object-cover" 
        />
        
        {/* Popular post border effect - moving red gradient */}
        {isPopular && (
          <div className="absolute inset-0 rounded-lg pointer-events-none">
            <div className="absolute inset-0 rounded-lg bg-[length:200%_200%] bg-[radial-gradient(at_top_left,_red_0%,_transparent_50%)] 
                      animate-[border_move_10s_linear_infinite] border-4 -translate-[2px] 
                      bg-[radial-gradient(at_top_left,_red_0%,_transparent_50%)] 
                      bg-[size:200%_200%] 
                      bg-[position:0_0] 
                      bg-[repeat:no-repeat]">
            </div>
          </div>
        )}
        
        {/* Influencer post border effect - silver and gold gradient */}
        {isInfluencer && (
          <div className="absolute inset-0 rounded-lg pointer-events-none">
            <div className="absolute inset-0 rounded-lg bg-[length:200%_200%] 
                      bg-[conic-gradient(from_0deg,_silver_0%,_gold_25%,_silver_50%,_gold_75%,_silver_100%)] 
                      animate-[border_move_15s_linear_infinite] border-4 -translate-[2px]">
            </div>
          </div>
        )}
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