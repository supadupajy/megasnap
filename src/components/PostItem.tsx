"use client";

import React, { useState, useRef } from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Flame, Play, Star, Navigation, Utensils, Car, TreePine, Sparkles, PawPrint, Send, ChevronDown, ChevronUp, Bookmark, ShoppingBag, AlertCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { isGifUrl } from '@/lib/mock-data';
import { Comment } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from '@/utils/toast';
import { useBlockedUsers } from '@/hooks/use-blocked-users';

interface PostItemProps {
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  location: string;
  likes: number;
  commentsCount: number;
  comments: Comment[];
  image: string;
  images?: string[];
  adImageIndex?: number;
  lat?: number;
  lng?: number;
  isLiked?: boolean;
  isSaved?: boolean;
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
  commentsCount = 0,
  comments: initialComments = [],
  image, 
  images = [],
  adImageIndex,
  lat,
  lng,
  isLiked, 
  isSaved: initialIsSaved,
  isAd, 
  isGif: initialIsGif, 
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
  const { blockUser } = useBlockedUsers();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved || false);
  const [localComments, setLocalComments] = useState<Comment[]>(initialComments || []);
  const [commentInput, setCommentInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isPopular = !isAd && borderType === 'popular';
  const displayImages = images.length > 0 ? images : [image];
  const isGif = initialIsGif || isGifUrl(displayImages[currentImageIndex]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setCurrentImageIndex(index);
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

  const handleSaveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim()) return;
    setLocalComments([...localComments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    showSuccess('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
  };

  const handleBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    blockUser(user.id);
    showError(`${user.name} 님을 차단했습니다.`);
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

  const lastComment = localComments.length > 0 ? localComments[localComments.length - 1] : null;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white mb-1 last:mb-20 transition-all duration-500 cursor-pointer border-b border-gray-50",
        (isInfluencer || (isPopular && !disablePulse)) && "animate-influencer-float"
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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">
            <DropdownMenuItem 
              onClick={handleReport}
              className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"
            >
              <AlertCircle className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-bold text-gray-700">신고</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleBlock}
              className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
            >
              <Ban className="w-4 h-4 text-red-600" />
              <span className="text-sm font-bold text-red-600">차단</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-4">
        <div className={cn(
          "relative aspect-square w-full rounded-2xl transition-all duration-500",
          isInfluencer ? "influencer-border-container" : (isAd ? "p-[2px] bg-blue-500 shadow-lg shadow-blue-500/20" : (isPopular ? "popular-border-container" : ""))
        )}>
          <div className={cn("w-full h-full rounded-[14px] overflow-hidden bg-white relative z-10", isInfluencer && "shine-overlay")}>
            <div ref={scrollRef} onScroll={handleImageScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
              {displayImages.map((img, idx) => (
                <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                  <img src={img} alt={`post-${idx}`} className="w-full h-full object-cover transition-all duration-700" />
                  {idx === adImageIndex && <div className="absolute top-4 right-4 z-20 bg-blue-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">AD</div>}
                </div>
              ))}
            </div>
            {displayImages.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">
                {displayImages.map((_, idx) => (
                  <div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />
                ))}
              </div>
            )}
          </div>
          {isInfluencer ? (
            <div className="absolute top-4 left-4 z-20 bg-yellow-400 text-black px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-black/5"><Star className="w-3.5 h-3.5 fill-black" />INFLUENCER</div>
          ) : isPopular && (
            <div className="absolute top-4 left-4 z-20 bg-red-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10"><Flame className="w-3.5 h-3.5 fill-white" />HOT</div>
          )}
          {isGif && !isAd && <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md text-white p-1.5 rounded-full shadow-lg border border-white/20"><Play className="w-3 h-3 fill-white" /></div>}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4 pt-1.5">
            <button className="transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(e); }}>
              <Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button>
            <button onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6 text-gray-700" /></button>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <button className="transition-transform active:scale-125" onClick={handleSaveToggle}><Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} /></button>
              {renderCategoryBadge()}
              {lat !== undefined && lng !== undefined && (
                <button onClick={handleLocationClick} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100">
                  <Navigation className="w-3.5 h-3.5 fill-indigo-600" /><span className="text-[10px] font-black">위치보기</span>
                </button>
              )}
            </div>
            {isAd && (
              <a href="https://s.baemin.com/t3000fBqlbHGL" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-sm border border-[#2AC1BC]/20">
                <ShoppingBag className="w-3.5 h-3.5 fill-white" /><span className="text-[10px] font-black">주문하기</span>
              </a>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-gray-500">좋아요 {likes.toLocaleString()}개</p>
          <div className="flex gap-2 items-start">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>
              {isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}
            </div>
            <p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p>
          </div>

          <form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
            <Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} />
            <button type="submit" disabled={!commentInput.trim()} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button>
          </form>

          {lastComment && (
            <div className="flex gap-2 items-start mt-1">
              <span className="font-bold text-sm text-gray-900">{lastComment.user}</span>
              <span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span>
            </div>
          )}

          <AnimatePresence>
            {showComments && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-3 py-2">
                  {localComments.slice(0, -1).map((comment, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="font-bold text-sm text-gray-900">{comment.user}</span>
                      <span className="text-sm text-gray-500">{comment.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}>
            <span className="text-xs text-gray-400 font-medium">{showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}</span>
            {showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostItem;