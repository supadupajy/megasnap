"use client";

import React from 'react';
import { Heart, MapPin } from 'lucide-react';

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
}

const PostItem = ({ user, content, location, likes, image, isLiked }: PostItemProps) => {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-50">
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
          <img src={image} alt="post" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
            <span className="font-semibold text-sm text-gray-800">{user.name}</span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mb-2 leading-snug">
            {content}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-green-500 gap-1">
              <MapPin className="w-3 h-3" />
              <span className="text-xs font-medium">{location}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-xs">{likes}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostItem;