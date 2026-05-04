"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Heart, ExternalLink, Sparkles, Mail, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Post } from "@/types";
import { useLocationDisplay } from "@/hooks/use-location-display";
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from "@/hooks/use-ad";

// 동영상 URL인지 판별 (mp4, mov, webm 등)
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.m4v');
};

// 동영상 썸네일을 canvas로 추출하는 컴포넌트
const VideoThumbnail: React.FC<{ videoUrl: string; className?: string }> = ({ videoUrl, className }) => {
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const video = document.createElement('video');
    let timeoutId: number | undefined;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      video.src = '';
      video.load();
    };

    const capture = () => {
      if (cancelled) return;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setFailed(true);
          cleanup();
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.8);
        setThumbUrl(url);
      } catch {
        setFailed(true);
      }

      cleanup();
    };

    const moveToCaptureFrame = () => {
      if (cancelled) return;

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0.2) {
        capture();
        return;
      }

      const seekTime = Math.min(Math.max(duration * 0.15, 0.1), duration - 0.1);
      try {
        video.currentTime = seekTime;
      } catch {
        capture();
      }
    };

    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = videoUrl;

    video.addEventListener('loadedmetadata', moveToCaptureFrame);
    video.addEventListener('seeked', capture);
    video.addEventListener('error', () => {
      if (!cancelled) setFailed(true);
      cleanup();
    });

    timeoutId = window.setTimeout(() => {
      if (!cancelled && !thumbUrl) {
        setFailed(true);
        cleanup();
      }
    }, 8000);

    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', moveToCaptureFrame);
      video.removeEventListener('seeked', capture);
      cleanup();
    };
  }, [videoUrl]);

  if (thumbUrl) {
    return (
      <div className={cn("relative w-full h-full", className)}>
        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white fill-white ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={cn("w-full h-full bg-gray-800 flex items-center justify-center", className)}>
        <svg className="w-4 h-4 text-white fill-white ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full bg-gray-200 animate-pulse flex items-center justify-center", className)}>
      <svg className="w-4 h-4 text-gray-400 fill-gray-400 ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </div>
  );
};

// 포스트 썸네일 컴포넌트 (이미지/동영상 자동 판별)
const PostThumbnail: React.FC<{ post: Post; className?: string; imgClassName?: string; onImgError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void }> = ({ post, className, imgClassName, onImgError }) => {
  const videoUrl = post.videoUrl;
  const imageUrl = post.image_url || post.image;
  const hasStoredThumbnail = !!imageUrl && !isVideoUrl(imageUrl) && imageUrl !== '/placeholder.svg';

  if (hasStoredThumbnail) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn("w-full h-full object-cover", imgClassName, className)}
        onError={onImgError}
      />
    );
  }

  const effectiveVideoUrl = videoUrl || (isVideoUrl(imageUrl) ? imageUrl : null);

  if (effectiveVideoUrl) {
    return <VideoThumbnail videoUrl={effectiveVideoUrl} className={className} />;
  }

  return (
    <img
      src={imageUrl}
      alt=""
      className={cn("w-full h-full object-cover", imgClassName)}
      onError={onImgError}
    />
  );
};

// ── 순위 변동 추적 유틸 ──────────────────────────────────────
const RANK_STORAGE_KEY = 'trending_prev_ranks';
const RANK_STORAGE_TS_KEY = 'trending_prev_ranks_ts';
const RANK_REFRESH_INTERVAL = 60 * 1000; // 1분마다 이전 순위 갱신

interface PrevRankMap {
  [postId: string]: number;
}

const loadPrevRanks = (): PrevRankMap => {
  try {
    const raw = localStorage.getItem(RANK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const savePrevRanks = (ranks: PrevRankMap) => {
  try {
    localStorage.setItem(RANK_STORAGE_KEY, JSON.stringify(ranks));
    localStorage.setItem(RANK_STORAGE_TS_KEY, String(Date.now()));
  } catch {}
};

const getPrevRankTimestamp = (): number => {
  try {
    return Number(localStorage.getItem(RANK_STORAGE_TS_KEY) || '0');
  } catch {
    return 0;
  }
};

// rankChange: 양수 = 상승, 음수 = 하락, 0 = 유지, null = NEW
type RankChange = number | null;

interface TrendingPostsProps {
  posts: Post[];
  isExpanded: boolean;
  onToggle: () => void;
  onPostClick: (post: Post) => void;
  maxHeight?: string;
}

interface TrendingPostItemProps {
  post: Post & { rank: number };
  onPostClick: (post: Post) => void;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  rankChange: RankChange;
}

const TrendingPostItem: React.FC<TrendingPostItemProps> = ({ post, onPostClick, handleImageError, rankChange }) => {
  const displayLocation = useLocationDisplay(post.location, post.lat, post.lng);
  const isHot = Number(post.likes_per_hour ?? 0) >= 100;

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

  // 순위 변동 UI 렌더
  const renderRankChange = () => {
    if (rankChange === null) {
      // NEW
      return (
        <div className="flex items-center justify-center shrink-0 w-9">
          <span className="inline-flex items-center justify-center text-[9px] font-black text-white bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 px-1.5 rounded-md tracking-wide" style={{ height: '18px', lineHeight: '18px' }}>
            NEW
          </span>
        </div>
      );
    }
    if (rankChange > 0) {
      return (
        <div className="flex items-center justify-center shrink-0 w-9 gap-1">
          {/* 위쪽 채워진 삼각형 */}
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 0L10 8H0L5 0Z" fill="#10b981"/>
          </svg>
          <span className="text-[10px] font-black text-emerald-500 leading-none">{rankChange}</span>
        </div>
      );
    }
    if (rankChange < 0) {
      return (
        <div className="flex items-center justify-center shrink-0 w-9 gap-1">
          {/* 아래쪽 채워진 삼각형 */}
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 8L0 0H10L5 8Z" fill="#f43f5e"/>
          </svg>
          <span className="text-[10px] font-black text-rose-500 leading-none">{Math.abs(rankChange)}</span>
        </div>
      );
    }
    // 유지 (0)
    return (
      <div className="flex items-center justify-center shrink-0 w-9">
        <Minus className="w-3 h-3 text-gray-300" />
      </div>
    );
  };

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
        <PostThumbnail post={post} onImgError={handleImageError} />
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

      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-[13px] font-bold text-gray-900 truncate leading-tight mb-1">
          {post.content}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium text-gray-400 truncate">
            {displayLocation || '위치 정보 없음'}
          </p>
          <div className="flex items-center gap-0.5 text-rose-500 shrink-0">
            <Heart className="w-3 h-3 fill-rose-500" />
            <span className="text-[10px] font-black">{post.likes}</span>
          </div>
        </div>
      </div>

      {/* 순위 변동 표시 (HOT 아이콘 대신 항상 표시) */}
      {renderRankChange()}

      {isHot && (
        <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
          <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
        </div>
      )}
    </div>
  );
};

const FALLBACK_IMAGE = "/placeholder.svg";

const TrendingAdBanner: React.FC = () => {
  const { ad, loading, now } = useAd('trending');

  if (loading) {
    return (
      <div className="px-5 py-1 border-b border-gray-100">
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  // 광고가 없거나 비활성이면 구인 슬롯 사용
  const slot = ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT;

  // 구인 슬롯인 경우 별도 UI
  if (slot.isRecruitment) {
    return (
      <div className="px-5 py-1 border-b border-gray-100">
        <div
          onClick={(e) => {
            e.stopPropagation();
            window.open('mailto:chorasnap@gmail.com', '_blank');
          }}
          className="w-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-100 cursor-pointer relative overflow-hidden px-4 pt-2.5 pb-2.5 flex flex-col gap-1.5"
        >
          {/* 장식 원형 */}
          <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -top-1 -right-1 w-14 h-14 bg-white/10 rounded-full pointer-events-none" />
          {/* 상단 레이블 */}
          <span className="text-[10px] font-bold text-white/70 tracking-wide">광고 문의</span>
          {/* 메인 카피 */}
          <div>
            <h2 className="text-[14px] font-black text-white leading-tight tracking-tight">
              좋은 브랜드를 기다리고 있어요.
            </h2>
            <p className="text-[10px] font-medium text-white/70 mt-0.5">광고 문의는 언제든 환영이에요.</p>
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
    <div className="px-5 py-1 border-b border-gray-100">
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (slot.link_url) window.open(normalizeUrl(slot.link_url), '_blank', 'noopener,noreferrer');
        }}
        className="p-0 rounded-2xl bg-black text-white shadow-lg relative overflow-hidden group h-24 flex cursor-pointer"
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
  maxHeight,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDownArrow, setShowScrollDownArrow] = useState(false);
  const [showScrollUpArrow, setShowScrollUpArrow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevRanks, setPrevRanks] = useState<PrevRankMap>(() => loadPrevRanks());
  const prevRanksRef = useRef<PrevRankMap>(prevRanks);
  const isExpandedRef = useRef(isExpanded);

  // isExpanded 변경 시 ref 동기화 (클로저 캡처 문제 방지)
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // 최초 마운트 시 이전 순위 초기화 (1회만)
  useEffect(() => {
    if (posts.length === 0) return;
    const now = Date.now();
    const lastTs = getPrevRankTimestamp();
    // 처음 로드(lastTs === 0)이면 현재 순위를 이전 순위로 저장
    if (lastTs === 0) {
      const newMap: PrevRankMap = {};
      posts.forEach((p: any) => {
        if (p.rank != null) newMap[p.id] = p.rank;
      });
      savePrevRanks(newMap);
      setPrevRanks(newMap);
      prevRanksRef.current = newMap;
    } else {
      // 저장된 이전 순위 로드
      const loaded = loadPrevRanks();
      setPrevRanks(loaded);
      prevRanksRef.current = loaded;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1분 주기로 현재 순위를 이전 순위로 갱신 (posts 내용이 바뀌어도 타이머 기준으로만 갱신)
  useEffect(() => {
    if (posts.length === 0) return;
    const now = Date.now();
    const lastTs = getPrevRankTimestamp();
    if (lastTs !== 0 && now - lastTs > RANK_REFRESH_INTERVAL) {
      const newMap: PrevRankMap = {};
      posts.forEach((p: any) => {
        if (p.rank != null) newMap[p.id] = p.rank;
      });
      savePrevRanks(newMap);
      setPrevRanks(newMap);
      prevRanksRef.current = newMap;
    }
  // posts 배열 내용이 바뀔 때마다 체크 (length 변화 포함)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  // rankChange 계산 함수
  const getRankChange = (post: Post & { rank: number }): RankChange => {
    const prev = prevRanks[post.id];
    if (prev == null) return null; // NEW
    return prev - post.rank; // 양수 = 상승 (이전 순위가 더 낮았음)
  };

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
    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;

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

  // isExpanded 전환 시 WebKit이 overscrollBehavior를 즉시 인식하도록 DOM에 직접 강제 적용
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.style.overscrollBehavior = 'none';
  }, [isExpanded]);

  // 패널이 펼쳐졌을 때 패널 전체의 터치 이벤트가 맵으로 전파되지 않도록 차단
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const saveStartY = (e: TouchEvent) => {
      // 어디서 시작하든 항상 저장
      (listRef.current as any)._touchStartY = e.touches[0].clientY;
    };

    const blockTouch = (e: TouchEvent) => {
      if (!isExpandedRef.current) return;
      e.stopPropagation();

      const listEl = listRef.current;
      if (listEl && listEl.contains(e.target as Node)) {
        const startY = (listEl as any)._touchStartY;
        if (startY == null) {
          e.preventDefault();
          return;
        }
        const deltaY = e.touches[0].clientY - startY;
        const atTop = listEl.scrollTop <= 0;
        const atBottom =
          listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 1;

        if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
          e.preventDefault(); // 경계에서만 브라우저 기본동작 차단
        }
        // 중간 스크롤은 건드리지 않음 → 정상 스크롤 유지
      } else {
        // 헤더, 광고 영역은 항상 차단
        e.preventDefault();
      }
    };

    const clearStartY = () => {
      (listRef.current as any)._touchStartY = null;
    };

    container.addEventListener('touchstart', saveStartY, { passive: true });
    container.addEventListener('touchend', clearStartY, { passive: true });
    container.addEventListener('touchcancel', clearStartY, { passive: true });
    container.addEventListener('touchmove', blockTouch, { passive: false }); // 반드시 false

    return () => {
      container.removeEventListener('touchstart', saveStartY);
      container.removeEventListener('touchend', clearStartY);
      container.removeEventListener('touchcancel', clearStartY);
      container.removeEventListener('touchmove', blockTouch);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-white/95 backdrop-blur-xl rounded-[32px] transition-[max-height,transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden border border-gray-100 shadow-md shadow-gray-200/80",
        isExpanded ? (maxHeight ? "" : "max-h-[85vh]") : "max-h-[56px]"
      )}
      style={{
        willChange: "max-height",
        ...(isExpanded && maxHeight ? { maxHeight } : {}),
      }}
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
            <AnimatePresence mode="wait" initial={false}>
              {isExpanded ? (
                <motion.div
                  key="expanded-header"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center gap-0.5 shrink-0 mr-1"
                >
                  <span className="text-indigo-600 font-black text-sm italic">HOT</span>
                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                </motion.div>
              ) : (
                <motion.span
                  key="collapsed-rank"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={cn(
                    "text-indigo-600 font-black text-sm italic shrink-0",
                    currentPost?.rank >= 10 ? "w-6" : "w-4"
                  )}
                >
                  {currentPost?.rank}
                </motion.span>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              {!isExpanded ? (
                <motion.div
                  key="collapsed-content"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-1 items-center gap-2 overflow-hidden"
                >
                  <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                    <PostThumbnail post={currentPost!} onImgError={handleImageError} />
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
                </motion.div>
              ) : (
                <motion.div
                  key="expanded-subtitle"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex-1 flex items-center min-w-0 overflow-hidden"
                >
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">
                    Real-time HOT (Top 20)
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </motion.div>
          </>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col relative transition-opacity duration-300 overflow-hidden",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ overscrollBehavior: 'none', ...(maxHeight ? { maxHeight: `calc(${maxHeight} - 56px)` } : {}) }}
      >
        {/* 광고 구좌 (DB 연동) */}
        <TrendingAdBanner />

        {/* 스크롤 가능한 포스팅 리스트 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-scroll no-scrollbar py-2 px-3 space-y-2 relative"
          data-trending-scroll="true"
          style={{ maxHeight: maxHeight ? undefined : '58vh', overscrollBehavior: 'none', touchAction: 'pan-y' }}
        >
          {isExpanded && showScrollUpArrow && (
            <div className="sticky top-0 left-0 right-0 flex justify-center pointer-events-none z-30 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
                <ChevronUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          )}

          {/* 상단 스톱바 (1위 위) */}
          <div className="h-[3px] rounded-full mx-8 mb-1" style={{ background: 'linear-gradient(90deg, #6366f1 0%, #818cf8 40%, #a78bfa 70%, #7c3aed 100%)' }} />

          {posts.map((post) => (
            <TrendingPostItem
              key={post.id}
              post={post as Post & { rank: number }}
              onPostClick={onPostClick}
              handleImageError={handleImageError}
              rankChange={getRankChange(post as Post & { rank: number })}
            />
          ))}

          {/* 하단 스톱바 (20위 아래) */}
          <div className="h-[3px] rounded-full mx-8 mt-1" style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 30%, #818cf8 60%, #6366f1 100%)' }} />
        </div>

        {isExpanded && posts.length > 5 && showScrollDownArrow && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none pb-2 z-20 animate-in fade-in duration-300">
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
              <ChevronDown className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingPosts;