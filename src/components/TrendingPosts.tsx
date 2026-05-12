"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Heart, ExternalLink, Sparkles, Mail, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn, getOptimizedMarkerImage, getOptimizedBannerImage } from "@/lib/utils";
import { Post } from "@/types";
import { useLocationDisplay } from "@/hooks/use-location-display";
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from "@/hooks/use-ad";

// 동영상 URL인지 판별 (mp4, mov, webm 등)
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.m4v');
};

// ── 비디오 썸네일 인메모리 캐시 ──────────────────────────────
const videoThumbCache = new Map<string, string | 'failed'>();

// 플레이 오버레이/로딩 인디케이터 사이즈
// - sm: collapsed 헤더의 w-6 h-6(24px) 썸네일용
// - md: 펼쳐진 리스트의 w-12 h-12(48px) 썸네일용
type PlayBadgeSize = 'sm' | 'md';

// 동영상 썸네일을 canvas로 추출하는 컴포넌트
const VideoThumbnail: React.FC<{ videoUrl: string; className?: string; size?: PlayBadgeSize }> = ({ videoUrl, className, size = 'md' }) => {
  const cached = videoThumbCache.get(videoUrl);
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(
    cached && cached !== 'failed' ? cached : null
  );
  const [failed, setFailed] = React.useState(cached === 'failed');

  React.useEffect(() => {
    // 캐시 히트 시 즉시 반환 (video 엘리먼트 생성 불필요)
    if (videoThumbCache.has(videoUrl)) {
      const c = videoThumbCache.get(videoUrl)!;
      if (c === 'failed') setFailed(true);
      else setThumbUrl(c);
      return;
    }

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
          videoThumbCache.set(videoUrl, 'failed');
          setFailed(true);
          cleanup();
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.8);
        videoThumbCache.set(videoUrl, url);
        setThumbUrl(url);
      } catch {
        videoThumbCache.set(videoUrl, 'failed');
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
      if (!cancelled) {
        videoThumbCache.set(videoUrl, 'failed');
        setFailed(true);
      }
      cleanup();
    });

    timeoutId = window.setTimeout(() => {
      if (!cancelled && !thumbUrl) {
        videoThumbCache.set(videoUrl, 'failed');
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
        <PlayOverlay size={size} />
      </div>
    );
  }

  if (failed) {
    return (
      <div className={cn("relative w-full h-full bg-gray-800", className)}>
        <PlayOverlay size={size} />
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full bg-gray-200 animate-pulse flex items-center justify-center", className)}>
      <svg
        className={cn(
          "text-gray-400 fill-gray-400 ml-0.5",
          size === 'sm' ? "w-2 h-2" : "w-4 h-4"
        )}
        viewBox="0 0 24 24"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  );
};

// 플레이 버튼 오버레이 (영상 표시용)
// - sm: 작은 썸네일(24px)에 어울리는 미니 배지
// - md: 일반 리스트 썸네일(48px)용 기본 배지
const PlayOverlay: React.FC<{ size?: PlayBadgeSize }> = ({ size = 'md' }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div
      className={cn(
        "bg-black/55 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md ring-1 ring-white/30",
        size === 'sm' ? "w-3.5 h-3.5" : "w-7 h-7"
      )}
    >
      <svg
        className={cn(
          "text-white fill-white",
          size === 'sm' ? "w-2 h-2 ml-[1px]" : "w-3.5 h-3.5 ml-0.5"
        )}
        viewBox="0 0 24 24"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  </div>
);

// 포스트 썸네일 컴포넌트 (이미지/동영상 자동 판별)
const PostThumbnail: React.FC<{
  post: Post;
  className?: string;
  imgClassName?: string;
  onImgError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  size?: PlayBadgeSize;
}> = ({ post, className, imgClassName, onImgError, size = 'md' }) => {
  const videoUrl = post.videoUrl;
  const imageUrl = post.image_url || post.image;
  const hasStoredThumbnail = !!imageUrl && !isVideoUrl(imageUrl) && imageUrl !== '/placeholder.svg';
  const isVideo = !!videoUrl || isVideoUrl(imageUrl);

  if (hasStoredThumbnail) {
    return (
      <div className={cn("relative w-full h-full", className)}>
        <img
          src={getOptimizedMarkerImage(imageUrl, post.id)}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("w-full h-full object-cover", imgClassName)}
          onError={onImgError}
        />
        {isVideo && <PlayOverlay size={size} />}
      </div>
    );
  }

  const effectiveVideoUrl = videoUrl || (isVideoUrl(imageUrl) ? imageUrl : null);

  if (effectiveVideoUrl) {
    return <VideoThumbnail videoUrl={effectiveVideoUrl} className={className} size={size} />;
  }

  return (
    <img
      src={getOptimizedMarkerImage(imageUrl, post.id)}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("w-full h-full object-cover", imgClassName)}
      onError={onImgError}
    />
  );
};

// ── 순위 변동 추적 유틸 ──────────────────────────────────────
// localStorage에 직전 fetch의 순위 스냅샷을 저장 → 새 데이터와 비교
const RANK_STORAGE_KEY = 'trending_prev_ranks_v2';

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
  } catch {}
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

const TrendingPostItem: React.FC<TrendingPostItemProps> = React.memo(({ post, onPostClick, handleImageError, rankChange }) => {
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
      <div className="w-6 text-center shrink-0 flex items-center justify-center">
        {post.rank === 1 ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '14px', fontWeight: 900, lineHeight: 1, color: '#D97706' }}>
            1
          </span>
        ) : post.rank === 2 ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '14px', fontWeight: 900, lineHeight: 1, color: '#9CA3AF' }}>
            2
          </span>
        ) : post.rank === 3 ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '14px', fontWeight: 900, lineHeight: 1, color: '#CD7F32' }}>
            3
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '12px', fontWeight: 900, lineHeight: 1, color: '#111827' }}>
            {post.rank}
          </span>
        )}
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
});

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
          className="w-full bg-gradient-to-br from-indigo-100 via-blue-50 to-violet-100 rounded-2xl shadow-sm border border-indigo-200/50 cursor-pointer relative overflow-hidden px-4 pt-2.5 pb-2.5 flex flex-col gap-1.5"
        >
          {/* 장식 원형 */}
          <div className="absolute -top-5 -right-5 w-24 h-24 bg-indigo-200/30 rounded-full pointer-events-none" />
          <div className="absolute -top-1 -right-1 w-14 h-14 bg-violet-200/30 rounded-full pointer-events-none" />
          {/* 상단 레이블 */}
          <span className="text-[10px] font-bold text-indigo-400 tracking-wide">광고 문의</span>
          {/* 메인 카피 */}
          <div>
            <h2 className="text-[14px] font-black text-indigo-800 leading-tight tracking-tight">
              좋은 브랜드를 기다리고 있어요.
            </h2>
            <p className="text-[10px] font-medium text-indigo-500 mt-0.5">광고 문의는 언제든 환영이에요.</p>
          </div>
          {/* 이메일 버튼 */}
          <div className="flex items-center gap-2 bg-white/60 rounded-xl px-2.5 py-1.5 border border-indigo-200/50">
            <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="flex-1 text-[11px] font-bold text-indigo-700 tracking-tight">chorasnap@gmail.com</span>
            <div className="w-5 h-5 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
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
            src={getOptimizedBannerImage(slot.image_url, 'trending-ad')}
            alt={slot.brand_name || 'Ad'}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
        <div className="relative z-10 p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2">
            <span className="bg-white text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">AD</span>
            {slot.brand_logo_url && (
              <img
                src={getOptimizedMarkerImage(slot.brand_logo_url, 'trending-ad-logo')}
                alt={slot.brand_name || 'Brand'}
                loading="lazy"
                decoding="async"
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
  const [renderExpandedBody, setRenderExpandedBody] = useState(isExpanded);
  const [visibleItemLimit, setVisibleItemLimit] = useState(8);
  // 비교 기준이 되는 "이전 순위" 스냅샷 — localStorage에서 1회 로드
  // 현재 posts와 비교해 변동을 표시
  const [prevRanks, setPrevRanks] = useState<PrevRankMap>(() => loadPrevRanks());
  // 첫 진입 시(localStorage가 비어있던 사용자) 신규 표시를 억제하기 위한 플래그
  const [isFirstSnapshot, setIsFirstSnapshot] = useState<boolean>(() => {
    const loaded = loadPrevRanks();
    return Object.keys(loaded).length === 0;
  });
  const isExpandedRef = useRef(isExpanded);

  // isExpanded 변경 시 ref 동기화 (클로저 캡처 문제 방지)
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // posts ID:rank 시그니처가 바뀌면 다음 비교의 기준을 갱신
  // - 이전 시그니처가 비어있던 경우: 현재 posts를 첫 스냅샷으로 저장(첫 비교 기준 마련)
  // - 이전 시그니처가 있던 경우: 직전 시그니처의 순위를 prevRanks로 사용
  const postsSignature = posts.map((p: any) => `${p.id}:${p.rank}`).join('|');
  const prevSignatureRef = useRef<string>('');

  useEffect(() => {
    if (posts.length === 0) return;
    if (prevSignatureRef.current === postsSignature) return;

    // 다음 비교용 스냅샷을 localStorage에 저장
    const newMap: PrevRankMap = {};
    posts.forEach((p: any) => {
      if (p.rank != null) newMap[p.id] = p.rank;
    });
    savePrevRanks(newMap);

    if (prevSignatureRef.current === '') {
      // 컴포넌트 마운트 후 첫 시그니처 등록
      // - localStorage에 이전 순위가 있었으면(prevRanks 비어있지 않음) 그대로 비교 사용
      // - 신규 사용자(localStorage 비었음)는 isFirstSnapshot=true 상태에서
      //   현재 posts를 prevRanks로 박아 모두 "유지(0)"로 표시
      if (Object.keys(prevRanks).length === 0) {
        setPrevRanks(newMap);
      }
    } else {
      // 두 번째 갱신부터는 직전 시그니처의 순위를 새 비교 기준으로 사용
      const updated: PrevRankMap = {};
      prevSignatureRef.current.split('|').forEach(seg => {
        const idx = seg.lastIndexOf(':');
        if (idx > 0) {
          const id = seg.slice(0, idx);
          const rank = Number(seg.slice(idx + 1));
          if (Number.isFinite(rank)) updated[id] = rank;
        }
      });
      setPrevRanks(updated);
      // 첫 갱신이 일어났으니 이제부터는 정상적으로 NEW 표시 가능
      if (isFirstSnapshot) setIsFirstSnapshot(false);
    }

    prevSignatureRef.current = postsSignature;
  }, [postsSignature, posts]);

  // rankChange 계산 함수
  const getRankChange = (post: Post & { rank: number }): RankChange => {
    const prev = prevRanks[post.id];
    if (prev == null) {
      // 이전 데이터가 전혀 없는 신규 사용자의 첫 렌더에서는 NEW 대신 유지(0)로 표시
      return isFirstSnapshot ? 0 : null;
    }
    return prev - post.rank; // 양수 = 상승 (이전 순위 숫자가 더 컸음 = 더 낮은 순위였음)
  };

  const isLoading = posts.length === 0;

  useEffect(() => {
    let bodyTimer: number | undefined;
    let listTimer: number | undefined;

    if (isExpanded) {
      setVisibleItemLimit(8);
      bodyTimer = window.setTimeout(() => {
        setRenderExpandedBody(true);
        listTimer = window.setTimeout(() => {
          setVisibleItemLimit(posts.length);
        }, 260);
      }, 80);
    } else {
      setVisibleItemLimit(8);
      bodyTimer = window.setTimeout(() => setRenderExpandedBody(false), 260);
    }

    return () => {
      if (bodyTimer) window.clearTimeout(bodyTimer);
      if (listTimer) window.clearTimeout(listTimer);
    };
  }, [isExpanded, posts.length]);

  useEffect(() => {
    if (isExpanded || posts.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posts.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [isExpanded, posts.length]);

  const currentPost = (posts[currentIndex] || posts[0]) as (Post & { rank: number }) | undefined;
  const visibleExpandedPosts = isExpanded ? posts.slice(0, visibleItemLimit) : [];

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;

    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setShowScrollDownArrow(!isAtBottom);

    const isAtTop = scrollTop < 10;
    setShowScrollUpArrow(!isAtTop);
  }, []);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (isExpanded && renderExpandedBody && posts.length > 5) {
      handleScroll();
      el?.addEventListener('scroll', handleScroll);
      return () => el?.removeEventListener('scroll', handleScroll);
    } else {
      setShowScrollDownArrow(false);
      setShowScrollUpArrow(false);
    }
  }, [isExpanded, renderExpandedBody, visibleItemLimit, posts.length, handleScroll]);

  // isExpanded 전환 시 body/html 레벨 overscroll + 스크롤 자체 잠금
  // (Android WebView가 페이지를 끌어당기는 현상까지 차단)
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.touchAction = 'none';
    } else {
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.touchAction = '';
    }
    return () => {
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.touchAction = '';
    };
  }, [isExpanded]);

  // 터치 이벤트 처리는 Index.tsx의 document capture 레벨 핸들러가 전담
  // (TrendingPosts 내부 중복 핸들러 제거)

  // 패널 열릴 때 scrollTop 초기화
  useEffect(() => {
    if (isExpanded && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [isExpanded]);

  // 터치/wheel 이벤트 처리는 Index.tsx의 document capture 레벨 핸들러가 전담

  return (
    <div
      ref={containerRef}
      data-trending-panel="true"
      className="bg-white/95 rounded-[32px] overflow-hidden border border-gray-100 transition-[background-color] duration-200"
      style={{
        height: isExpanded ? (maxHeight || '85vh') : '56px',
        contain: 'layout paint style',
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
                <motion.div
                  key="collapsed-rank"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="shrink-0 flex items-center justify-center mr-1"
                >
                  {currentPost?.rank === 1 ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '14px', fontWeight: 900, lineHeight: 1, color: '#D97706' }}>1</span>
                  ) : currentPost?.rank === 2 ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '14px', fontWeight: 900, lineHeight: 1, color: '#9CA3AF' }}>2</span>
                  ) : currentPost?.rank === 3 ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '14px', fontWeight: 900, lineHeight: 1, color: '#CD7F32' }}>3</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '12px', fontWeight: 900, lineHeight: 1, color: '#111827' }}>{currentPost?.rank}</span>
                  )}
                </motion.div>
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
                    <PostThumbnail post={currentPost!} onImgError={handleImageError} size="sm" />
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
                  {/* 순위 변동 */}
                  {(() => {
                    const rc = currentPost ? getRankChange(currentPost) : undefined;
                    if (rc === null) return (
                      <span className="inline-flex items-center justify-center text-[9px] font-black text-white bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 px-1.5 rounded-md tracking-wide shrink-0" style={{ height: '18px', lineHeight: '18px' }}>NEW</span>
                    );
                    if (rc !== undefined && rc > 0) return (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M5 0L10 8H0L5 0Z" fill="#10b981"/></svg>
                        <span className="text-[10px] font-black text-emerald-500 leading-none">{rc}</span>
                      </div>
                    );
                    if (rc !== undefined && rc < 0) return (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M5 8L0 0H10L5 8Z" fill="#f43f5e"/></svg>
                        <span className="text-[10px] font-black text-rose-500 leading-none">{Math.abs(rc)}</span>
                      </div>
                    );
                    return <Minus className="w-3 h-3 text-gray-300 shrink-0" />;
                  })()}
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
          "flex flex-col relative overflow-hidden transition-[transform,opacity] duration-[220ms] ease-out origin-top",
          isExpanded ? "opacity-100 scale-y-100" : "opacity-0 scale-y-95 pointer-events-none"
        )}
        style={{
          height: maxHeight ? `calc(${maxHeight} - 56px)` : 'calc(85vh - 56px)',
          overscrollBehavior: 'none',
          contain: 'layout paint style',
          contentVisibility: isExpanded ? 'visible' : 'hidden',
        }}
      >
        {renderExpandedBody ? (
          <>
            {/* 광고 구좌 (DB 연동) */}
            <TrendingAdBanner />

            {/* 스크롤 위 화살표 - listRef 형제로 absolute 배치 (scrollHeight 변동 방지) */}
            {isExpanded && showScrollUpArrow && (
              <div className="absolute left-0 right-0 flex justify-center pointer-events-none z-30 animate-in fade-in slide-in-from-top-1 duration-300" style={{ top: '140px' }}>
                <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-indigo-100 animate-bounce pointer-events-auto">
                  <ChevronUp className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            )}

            {/* 스크롤 가능한 포스팅 리스트 */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-scroll no-scrollbar pb-2 px-3 space-y-2 relative"
              data-trending-scroll="true"
              style={{ maxHeight: maxHeight ? undefined : '58vh', overscrollBehavior: 'none', touchAction: 'pan-y', contain: 'layout paint' }}
            >
              {/* 상단 스톱바 (1위 위) */}
              <div className="h-[3px] rounded-full mx-8 mb-1" style={{ background: 'linear-gradient(90deg, #6366f1 0%, #818cf8 40%, #a78bfa 70%, #7c3aed 100%)' }} />

              {visibleExpandedPosts.map((post) => (
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
          </>
        ) : (
          <div className="px-5 py-3 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-2xl bg-gray-100/80 animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingPosts;