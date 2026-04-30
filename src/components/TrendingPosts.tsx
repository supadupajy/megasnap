"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Heart, ExternalLink, ChevronDown as ScrollDownIcon, ChevronUp as ScrollUpIcon, Sparkles, Mail } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Post } from "@/types";
import { useLocationDisplay } from "@/hooks/use-location-display";
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from "@/hooks/use-ad";

interface TrendingPostsProps {
  posts: Post[];
  isExpanded: boolean;
  onToggle: () => void;
  onPostClick: (post: Post) => void;
}

interface TrendingPostItemProps {
  post: Post & { rank: number };
  onPostClick: (post: Post) => void;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const TrendingPostItem: React.FC<TrendingPostItemProps> = ({ post, onPostClick, handleImageError }) => {
  const displayLocation = useLocationDisplay(post.location, post.lat, post.lng);

  const borderType = post.borderType || 'none';
  let borderColor = 'border-gray-100';
  let borderThickness = 'border';

  if (borderType === 'popular') {
    borderColor = 'border-rose-500';
    borderThickness = 'border-2';
  } else if (borderType === 'diamond') {
    borderColor = 'border-cyan-400';
    borderThickness = 'border-2';
  } else if (borderType === 'gold') {
    borderColor = 'border-amber-400';
    borderThickness = 'border-2';
  } else if (borderType === 'silver') {
    borderColor = 'border-slate-400';
    borderThickness = 'border-2';
  }

  return (
    <div
      key={post.id}
      onClick={() => onPostClick(post)}
      className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer group"
    >
      <div className="w-6 text-center shrink-0">
        <span className={cn(
          "text-sm font-black italic",
          post.rank <= 3 ? "text-indigo-600" : "text-gray-300"
        )}>
          {post.rank}
        </span>
      </div>

      <div className={cn(
        "relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-50",
        borderThickness,
        borderColor
      )}>
        <img
          src={post.image}
          alt=""
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        {borderType !== 'none' && (
          <div className="absolute top-0.5 right-0.5 z-10">
            <Sparkles className={cn(
              "w-2.5 h-2.5",
              borderType === 'popular' ? "text-rose-500 fill-rose-500" :
              borderType === 'diamond' ? "text-cyan-400 fill-cyan-400" :
              borderType === 'silver' ? "text-slate-400 fill-slate-400" :
              "text-amber-400 fill-amber-400"
            )} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-900 truncate leading-tight mb-1">
          {post.content}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium text-gray-400 truncate">
            {displayLocation || '위치 정보 없음'}
          </p>
          <div className="flex items-center gap-0.5 text-rose-500">
            <Heart className="w-3 h-3 fill-rose-500" />
            <span className="text-[10px] font-black">{post.likes}</span>
          </div>
        </div>
      </div>

      {post.hot_since && new Date().getTime() - new Date(post.hot_since).getTime() < 60 * 60 * 1000 && (
        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
        </div>
      )}
    </div>
  );
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const TrendingAdBanner: React.FC = () => {
  const { ad, loading, now } = useAd('trending');

  if (loading) {
    return (
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  // 광고가 없거나 비활성이면 구인 슬롯 사용
  const slot = ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT;

  // 구인 슬롯인 경우 별도 UI
  if (slot.isRecruitment) {
    return (
      <div className="px-5 py-3 border-b border-gray-100">
        <div
          onClick={(e) => {
            e.stopPropagation();
            window.open('mailto:chorasnap@gmail.com', '_blank');
          }}
          className="w-full h-32 bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-100 cursor-pointer relative overflow-hidden px-4 py-3 flex flex-col justify-between"
        >
          {/* 장식 원형 */}
          <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -top-1 -right-1 w-14 h-14 bg-white/10 rounded-full pointer-events-none" />
          {/* 상단 레이블 */}
          <span className="text-[10px] font-bold text-white/70 tracking-wide">광고 문의</span>
          {/* 메인 카피 */}
          <div>
            <h2 className="text-[15px] font-black text-white leading-tight tracking-tight">
              좋은 브랜드를 기다리고 있어요.
            </h2>
            <p className="text-[11px] font-medium text-white/70 mt-0.5">광고 문의는 언제든 환영이에요.</p>
          </div>
          {/* 이메일 버튼 */}
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-2.5 py-1.5">
            <Mail className="w-3.5 h-3.5 text-white/80 shrink-0" />
            <span className="flex-1 text-[11px] font-bold text-white tracking-tight">chorasnap@gmail.com</span>
            <div className="w-5 h-5 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-b border-gray-100">
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (slot.link_url) window.open(normalizeUrl(slot.link_url), '_blank', 'noopener,noreferrer');
        }}
        className="p-0 rounded-2xl bg-black text-white shadow-lg relative overflow-hidden group h-32 flex cursor-pointer"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="absolute inset-0 z-0">
          <img
            key={slot.image_url}
            src={slot.image_url}
            alt={slot.brand_name || 'Ad'}
            className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
        <div className="relative z-10 p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2">
            <span className="bg-white text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">AD</span>
            {slot.brand_logo_url && (
              <img
                src={slot.brand_logo_url}
                alt={slot.brand_name || 'Brand'}
                className="h-3.5 invert brightness-200"
              />
            )}
          </div>
          <div>
            <h3 className="text-xl font-black italic tracking-tighter leading-tight mb-0.5 drop-shadow-lg">
              {slot.title}
            </h3>
            <p className="text-[12px] font-bold text-white/90 drop-shadow-md">
              {slot.subtitle}
            </p>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Shop Now</p>
            <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

const TrendingPosts: React.FC<TrendingPostsProps> = ({
  posts,
  isExpanded,
  onToggle,
  onPostClick,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollDownArrow, setShowScrollDownArrow] = useState(false);
  const [showScrollUpArrow, setShowScrollUpArrow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLoading = posts.length === 0;

  useEffect(() => {
    if (isExpanded || posts.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posts.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [isExpanded, posts.length]);

  const currentPost = (posts[currentIndex] || posts[0]) as (Post & { rank: number }) | undefined;

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;

    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setShowScrollDownArrow(!isAtBottom);

    const isAtTop = scrollTop < 10;
    setShowScrollUpArrow(!isAtTop);
  }, []);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80';
  };

  useEffect(() => {
    const el = listRef.current;
    if (isExpanded && posts.length > 5) {
      handleScroll();
      el?.addEventListener('scroll', handleScroll);
      return () => el?.removeEventListener('scroll', handleScroll);
    } else {
      setShowScrollDownArrow(false);
      setShowScrollUpArrow(false);
    }
  }, [isExpanded, posts.length, handleScroll]);

  return (
    <div
      className={cn(
        "bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl transition-[max-height,transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden border-2 border-indigo-600/20",
        isExpanded ? "max-h-[85vh]" : "max-h-[56px]"
      )}
      style={{ willChange: "max-height" }}
    >
      <div
        className="h-[56px] flex items-center px-5 cursor-pointer active:bg-gray-50 transition-colors shrink-0"
        onClick={onToggle}
      >
        {isLoading ? (
          <div className="flex items-center gap-3 w-full animate-pulse">
            <div className="w-4 h-4 bg-gray-200 rounded shrink-0" />
            <div className="w-6 h-6 bg-gray-200 rounded-lg shrink-0" />
            <div className="flex-1 h-3 bg-gray-200 rounded" />
            <ChevronDown className="w-5 h-5 text-gray-200" />
          </div>
        ) : (
          <>
            <span className={cn(
              "text-indigo-600 font-black text-sm italic shrink-0",
              isExpanded ? "w-auto mr-1" : (currentPost?.rank >= 10 ? "w-6" : "w-4")
            )}>
              {isExpanded ? "HOT" : currentPost?.rank}
            </span>

            {!isExpanded ? (
              <div className="flex flex-1 items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  <img
                    src={currentPost?.image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                </div>
                <div className="flex-1 overflow-hidden relative h-5">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`${currentPost?.id}-${currentIndex}`}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -15, opacity: 0 }}
                      transition={{ duration: 0.3, opacity: { duration: 0.2 } }}
                      className="text-xs font-bold text-gray-800 truncate absolute inset-0 leading-5"
                    >
                      {currentPost?.content}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden ml-2">
                <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0 fill-orange-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">
                  Real-time HOT (Top 20)
                </span>
              </div>
            )}

            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            )}
          </>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col relative transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* 광고 구좌 (DB 연동) */}
        <TrendingAdBanner />

        {/* 스크롤 가능한 포스팅 리스트 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto no-scrollbar py-2 px-3 space-y-2 max-h-[40vh] relative"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isExpanded && showScrollUpArrow && (
            <div className="sticky top-0 left-0 right-0 flex justify-center pointer-events-none z-30 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
                <ScrollUpIcon className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          )}

          {posts.map((post) => (
            <TrendingPostItem
              key={post.id}
              post={post as Post & { rank: number }}
              onPostClick={onPostClick}
              handleImageError={handleImageError}
            />
          ))}
        </div>

        {isExpanded && posts.length > 5 && showScrollDownArrow && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none pb-2 z-20 animate-in fade-in duration-300">
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
              <ScrollDownIcon className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingPosts;