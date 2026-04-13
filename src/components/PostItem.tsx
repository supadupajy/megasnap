"use client";

import React, { useState, useRef } from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Flame, Play, Star, Navigation, Utensils, Car, TreePine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface PostItemProps {
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  location: string;
  likes: number;
  image: string;
  images?: string[];
  adImageIndex?: number;
  lat?: number;
  lng?: number;
  isLiked?: boolean;
  isAd?: boolean;
  isGif?: boolean;
  isInfluencer?: boolean;
  category?: 'food' | 'accident' | 'place' | 'none';
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
  onLikeToggle?: (e: React.MouseEvent) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
}

const PostItem = ({ 
  user, 
  content, 
  location, 
  likes, 
  image, 
  images = [],
  adImageIndex,
  lat,
  lng,
  isLiked, 
  isAd, 
  isGif, 
  isInfluencer, 
  category = 'none',
  borderType = 'none',
  onLikeToggle,
  onLocationClick
}: PostItemProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isPopular = !isAd && borderType === 'popular';
  const displayImages = images.length > 0 ? images : [image];

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setCurrentImageIndex(index);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = `https://picsum.photos/seed/${content.length}/800/800`;
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${user.id}`);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined && onLocationClick) {
      onLocationClick(e, lat, lng);
    }
  };

  const renderCategoryIcon = () => {
    if (category === 'none') return null;
    
    const iconClass = "w-3.5 h-3.5 text-white";
    let Icon = null;
    let bgColor = "";

    switch (category) {
      case 'food':
        Icon = Utensils;
        bgColor = "bg-orange-500";
        break;
      case 'accident':
        Icon = Car;
        bgColor = "bg-red-600";
        break;
      case 'place':
        Icon = TreePine;
        bgColor = "bg-green-600";
        break;
    }

    if (!Icon) return null;

    return (
      <div className={cn(
        "absolute top-4 right-4 z-30 w-7 h-7 rounded-xl flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-sm",
        bgColor
      )}>
        <Icon className={iconClass} />
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-white mb-8 last:mb-20 transition-all duration-500",
      isInfluencer && "animate-influencer-float",
      isPopular && "animate-hot-pulse"
    )}>
      <div className="flex items-center justify-between px-4 py-3">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={handleUserClick}
        >
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full rounded-full object-cover border-2 border-white" 
            />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{user.name}</p>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-medium">{location}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-gray-400" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className={cn(
          "relative aspect-square w-full rounded-2xl transition-all duration-500",
          isInfluencer ? "influencer-border-container" : (
            isAd ? "p-[4px] bg-blue-500 shadow-lg shadow-blue-500/20" : (
              isPopular ? "popular-border-container" : (
                borderType === 'silver' ? "p-[4px] bg-gradient-to-br from-gray-300 via-white to-gray-400 shadow-lg" : (
                  borderType === 'gold' ? "p-[4px] bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 shadow-lg" : ""
                )
              )
            )
          )
        )}>
          <div className={cn(
            "w-full h-full rounded-[14px] overflow-hidden bg-white relative z-10",
            isInfluencer && "shine-overlay"
          )}>
            <div 
              ref={scrollRef}
              onScroll={handleImageScroll}
              className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
            >
              {displayImages.map((img, idx) => (
                <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                  <img
                    src={img}
                    alt={`post-${idx}`}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                  {idx === adImageIndex && (
                    <div className="absolute top-4 left-4 z-20 bg-yellow-400 text-black px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-black/5">
                      AD
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Category Icon Badge */}
            {renderCategoryIcon()}

            {/* Pagination Dots */}
            {displayImages.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">
                {displayImages.map((_, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      currentImageIndex === idx ? "bg-white w-4" : "bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
          
          {isInfluencer ? (
            <div className="absolute top-4 left-4 z-20 bg-yellow-400 text-black px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-black/5">
              <Star className="w-3.5 h-3.5 fill-black" />
              INFLUENCER
            </div>
          ) : isAd ? (
            <div className="absolute top-4 left-4 z-20 bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-white/10">
              AD
            </div>
          ) : isPopular && (
            <div className="absolute top-4 left-4 z-20 bg-red-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-white/10">
              <Flame className="w-3.5 h-3.5 fill-white" />
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

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button 
              className="transition-transform active:scale-125" 
              onClick={(e) => {
                e.stopPropagation();
                onLikeToggle?.(e);
              }}
            >
              <Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400')} />
            </button>
            <button onClick={(e) => e.stopPropagation()}>
              <MessageCircle className="w-6 h-6 text-gray-700" />
            </button>
            <button onClick={(e) => e.stopPropagation()}>
              <Share2 className="w-6 h-6 text-gray-700" />
            </button>
          </div>
          
          {lat !== undefined && lng !== undefined && (
            <button 
              onClick={handleLocationClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100"
            >
              <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
              <span className="text-[10px] font-black">위치보기</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-bold text-gray-500">좋아요 {likes.toLocaleString()}개</p>
          <div className="flex gap-2 items-start">
            <span 
              className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors"
              onClick={handleUserClick}
            >
              {user.name}
            </span>
            <p className="text-sm text-gray-800 leading-snug line-clamp-2">
              {content}
            </p>
          </div>
          <button className="text-xs text-gray-400 font-medium" onClick={(e) => e.stopPropagation()}>댓글 12개 모두 보기</button>
        </div>
      </div>
    </div>
  );
};

export default PostItem;