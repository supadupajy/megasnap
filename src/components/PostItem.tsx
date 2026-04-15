"use client";

import React, { useState, useRef } from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Flame, Play, Star, Navigation, Utensils, Car, TreePine, Sparkles, PawPrint, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

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
  isViewed?: boolean;
  category?: 'food' | 'accident' | 'place' | 'animal' | 'none';
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
  disablePulse?: boolean;
  onLikeToggle?: (e: React.MouseEvent) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
  onClick?: () => void;
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
  isViewed,
  category = 'none',
  borderType = 'none',
  disablePulse = false,
  onLikeToggle,
  onLocationClick,
  onClick
}: PostItemProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([
    { user: "travel_lover", text: "와 여기 진짜 가보고 싶었는데! 정보 감사합니다." }
  ]);
  const [commentInput, setCommentInput] = useState('');
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

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim()) return;
    setComments([...comments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
  };

  const renderCategoryBadge = () => {
    if (category === 'none') return null;
    let Icon = null;
    let bgColor = "";
    let label = "";
    switch (category) {
      case 'food': Icon = Utensils; bgColor = "bg-orange-500"; label = "맛집"; break;
      case 'accident': Icon = Car; bgColor = "bg-red-600"; label = "사고"; break;
      case 'place': Icon = TreePine; bgColor = "bg-green-600"; label = "명소"; break;
      case 'animal': Icon = PawPrint; bgColor = "bg-purple-600"; label = "동물"; break;
    }
    if (!Icon) return null;
    return (
      <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10", bgColor)}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white mb-1 last:mb-20 transition-all duration-500 cursor-pointer border-b border-gray-50",
        isInfluencer && "animate-influencer-float",
        isPopular && !disablePulse && "animate-hot-pulse"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleUserClick}>
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover border-2 border-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{user.name}</p>
              {isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}
            </div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-medium">{location}</span>
            </div>
          </div>
        </div>
        <button className="text-gray-400" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-5 h-5" /></button>
      </div>

      <div className="px-4">
        <div className={cn(
          "relative aspect-square w-full rounded-2xl transition-all duration-500",
          isInfluencer ? "influencer-border-container" : (isAd ? "p-[2px] bg-blue-500 shadow-lg" : (isPopular ? "popular-border-container" : ""))
        )}>
          <div className={cn("w-full h-full rounded-[14px] overflow-hidden bg-white relative z-10", isInfluencer && "shine-overlay")}>
            <div ref={scrollRef} onScroll={handleImageScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
              {displayImages.map((img, idx) => (
                <div key={idx} className="w-full h-full shrink-0 snap-center relative">
                  <img src={img} alt="" className="w-full h-full object-cover" onError={handleImageError} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button onClick={(e) => { e.stopPropagation(); onLikeToggle?.(e); }}>
              <Heart className={cn("w-6 h-6", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
            </button>
            <MessageCircle className="w-6 h-6 text-gray-700" />
            <Share2 className="w-6 h-6 text-gray-700" />
          </div>
          <div className="flex items-center gap-2">
            {renderCategoryBadge()}
            {lat !== undefined && lng !== undefined && (
              <button onClick={handleLocationClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                <span className="text-[10px] font-black">위치보기</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-gray-500">좋아요 {likes.toLocaleString()}개</p>
          <div className="flex gap-2 items-start">
            <span className="text-sm font-bold text-gray-900">{user.name}</span>
            <p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p>
          </div>

          <form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
            <Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} />
            <button type="submit" disabled={!commentInput.trim()} className="text-indigo-600 disabled:text-gray-300"><Send className="w-4 h-4" /></button>
          </form>

          <AnimatePresence mode="wait">
            {!showComments ? (
              <motion.div key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {comments.length > 0 && (
                  <div className="flex gap-2 items-start mt-1">
                    <span className="font-bold text-sm text-gray-900">{comments[comments.length - 1].user}</span>
                    <span className="text-sm text-gray-500 line-clamp-1">{comments[comments.length - 1].text}</span>
                  </div>
                )}
                <button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(true); }}>
                  <span className="text-xs text-gray-400 font-medium">댓글 {comments.length + 11}개 모두 보기</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </motion.div>
            ) : (
              <motion.div key="expanded" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-3 py-2">
                  {comments.map((comment, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="font-bold text-sm text-gray-900">{comment.user}</span>
                      <span className="text-sm text-gray-500">{comment.text}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full py-1 flex items-center justify-between group border-t border-gray-50 mt-2" onClick={(e) => { e.stopPropagation(); setShowComments(false); }}>
                  <span className="text-xs text-gray-400 font-medium">댓글 닫기</span>
                  <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PostItem;