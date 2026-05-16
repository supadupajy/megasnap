"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Heart, Eye, ExternalLink, Sparkles, Mail, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn, getOptimizedMarkerImage, getOptimizedBannerImage, formatCount } from "@/lib/utils";
import { Post } from "@/types";
import { useLocationDisplay } from "@/hooks/use-location-display";
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from "@/hooks/use-ad";
import { useAuth } from "@/components/AuthProvider";
import HashtagText from "@/components/HashtagText";

// 동영상 URL인지 판별 (mp4, mov, webm 등)
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.m4v');
};

// ── 24시간 카운트다운 링 (지도 마커와 동일 룰) ─────────────────────────
// 마커는 60x60 박스에 border-radius=20, 패딩=2 로 ring을 그리고 있다.
// 썸네일은 박스 크기/모서리 반경이 다르므로, 외곽 크기·반경·테두리 두께를
// 인자로 받아 동일한 path/spark 계산식을 그대로 적용한다.
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
const COUNTDOWN_TIMER_UPDATE_MS = 60 * 1000;
const COUNTDOWN_PROGRESS_COLOR = '#39FF14';
const COUNTDOWN_TRACK_COLOR = 'rgba(34,197,94,0.55)';
const COUNTDOWN_GLOW = '0 0 4px rgba(57,255,20,0.7)';

interface RingGeometry {
  box: number;          // viewBox 한 변 길이 = 외곽 사각형의 한 변 길이 (px 단위와 동일)
  pad: number;          // 외곽에서 안쪽으로 들이는 픽셀 (= border 두께 절반 정도)
  size: number;         // 실제 path가 그려지는 안쪽 사각형 한 변
  r: number;            // 둥근 모서리 반지름
  strokeWidth: number;  // stroke 두께
  perimeter: number;    // path 총 둘레 길이
  path: string;
}

const createRingGeometry = (box: number, borderWidth: number, borderRadius: number, strokeWidth: number): RingGeometry => {
  const pad = borderWidth / 2 + 0.5;
  const size = box - pad * 2;
  const r = Math.max(0, borderRadius - pad);
  const left = pad;
  const right = pad + size;
  const top = pad;
  const bottom = pad + size;
  const cx = pad + size / 2;
  const path = `M ${cx} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left} ${top + r} V ${bottom - r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${right - r} A ${r} ${r} 0 0 0 ${right} ${bottom - r} V ${top + r} A ${r} ${r} 0 0 0 ${right - r} ${top} Z`;
  const perimeter = 4 * (size - 2 * r) + 2 * Math.PI * r;
  return { box, pad, size, r, strokeWidth, perimeter, path };
};

const getRingSparkPoint = (geo: RingGeometry, remainingRatio: number): { x: number; y: number } => {
  const { pad, size, r, perimeter } = geo;
  const left = pad;
  const right = pad + size;
  const top = pad;
  const bottom = pad + size;
  const cx = pad + size / 2;

  const halfTop = size / 2 - r;
  const straight = size - 2 * r;
  const arc = (Math.PI * r) / 2;
  let d = (perimeter * remainingRatio) % perimeter;

  if (d <= halfTop) return { x: cx - d, y: top };
  d -= halfTop;
  if (d <= arc) {
    const t = d / arc;
    const angle = -Math.PI / 2 - (Math.PI / 2) * t;
    return { x: left + r + r * Math.cos(angle), y: top + r + r * Math.sin(angle) };
  }
  d -= arc;
  if (d <= straight) return { x: left, y: top + r + d };
  d -= straight;
  if (d <= arc) {
    const t = d / arc;
    const angle = Math.PI - (Math.PI / 2) * t;
    return { x: left + r + r * Math.cos(angle), y: bottom - r + r * Math.sin(angle) };
  }
  d -= arc;
  if (d <= straight) return { x: left + r + d, y: bottom };
  d -= straight;
  if (d <= arc) {
    const t = d / arc;
    const angle = Math.PI / 2 - (Math.PI / 2) * t;
    return { x: right - r + r * Math.cos(angle), y: bottom - r + r * Math.sin(angle) };
  }
  d -= arc;
  if (d <= straight) return { x: right, y: bottom - r - d };
  d -= straight;
  if (d <= arc) {
    const t = d / arc;
    const angle = 0 - (Math.PI / 2) * t;
    return { x: right - r + r * Math.cos(angle), y: top + r + r * Math.sin(angle) };
  }
  d -= arc;
  return { x: right - r - d, y: top };
};

// 썸네일 박스 사이즈별 ring geometry (Tailwind 클래스와 일치시켜야 함)
// - 펼친 리스트: w-12 h-12 (48px), rounded-xl (12px), border 2.5px
// - 접힌 헤더:   w-6  h-6  (24px), rounded-lg (8px),  border 1.5px
//
// stroke 두께는 지도 마커(60x60 박스에 stroke-width 4 → 비율 4/60 ≈ 0.0667)와
// 시각적으로 동일하게 보이도록 산출한다.
// ⚠️ 인기 리스트 썸네일은 부모(.rounded-xl overflow-hidden) 안에서 그려지기 때문에
//    SVG stroke의 바깥쪽 절반이 클리핑되어 실제 보이는 두께가 절반 가까이로 줄어든다.
//    지도 마커는 SVG가 inner box 위 레이어에 overflow:visible로 그려져 stroke 전체가
//    보인다. 두 환경에서 "보이는 두께"를 맞추려면 인기 리스트 쪽 stroke 를
//    지도 마커 비율의 두 배로 키워, 클리핑 후 안쪽으로 남는 절반이 지도와
//    동일한 두께가 되도록 한다.
//   md: 2 × (4/60) × 48 = 6.4
//   sm: 2 × (4/60) × 24 = 3.2
const RING_GEOMETRY_MD = createRingGeometry(48, 2.5, 12, 6.4);
const RING_GEOMETRY_SM = createRingGeometry(24, 1.5, 8, 3.2);

const getPostCreatedAtMs = (post: Post): number | null => {
  const raw = post.createdAt;
  if (!raw) return null;
  if (raw instanceof Date) return raw.getTime();
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
};

const isThumbnailExpirable = (post: Post): boolean => {
  if (!post) return false;
  if (post.isAd) return false;
  if (post.isAdPending) return false;
  return true;
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
        "bg-white/90 rounded-full flex items-center justify-center shadow-md",
        size === 'sm' ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
      )}
    >
      <svg
        className={cn(
          "ml-[1px]",
          size === 'sm' ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
        viewBox="0 0 24 24"
        fill="#4f46e5"
        stroke="#4f46e5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
  </div>
);

// 지도 마커와 1:1 동일한 24시간 카운트다운 링.
// - 12시 방향에서 시계 반대방향으로 한 바퀴 도는 둥근 사각형 path
// - dashoffset을 음수로 늘려 시작점부터 깎아내며 끝점이 반시계로 후퇴
// - 끝점에는 펄스 spark (남은 시간이 1~99% 사이일 때만 표시)
// - 박스 크기/모서리 반경/테두리 두께에 맞춰 path를 재계산하여 외곽에 hug
//
// ⚠️ 정렬 주의:
//   부모 썸네일 박스가 `box-sizing: border-box` + `border: Xpx` 이면 자식의
//   width/height:100% 는 content box (= box - border*2) 가 된다.
//   따라서 SVG를 박스의 외곽선(border box) 에 정확히 맞추려면
//   borderWidth 만큼 음수 offset 으로 박스 바깥으로 펼쳐서 절대 좌표로 배치해야 한다.
const ThumbnailCountdownRing: React.FC<{ post: Post; now: number; geometry: RingGeometry; borderWidth: number }> = ({ post, now, geometry, borderWidth }) => {
  if (!isThumbnailExpirable(post)) return null;

  const createdAtMs = getPostCreatedAtMs(post);
  if (createdAtMs === null) return null;

  const elapsed = Math.min(Math.max(now - createdAtMs, 0), MARKER_LIFESPAN_MS);
  if (elapsed >= MARKER_LIFESPAN_MS) return null;

  const remainingRatio = 1 - elapsed / MARKER_LIFESPAN_MS;
  const elapsedRatio = 1 - remainingRatio;
  const dashOffset = -(geometry.perimeter * elapsedRatio);
  const spark = getRingSparkPoint(geometry, elapsedRatio);
  const showSpark = remainingRatio > 0.01 && remainingRatio < 0.995;

  return (
    <svg
      viewBox={`0 0 ${geometry.box} ${geometry.box}`}
      width={geometry.box}
      height={geometry.box}
      style={{
        position: 'absolute',
        top: -borderWidth,
        left: -borderWidth,
        width: `${geometry.box}px`,
        height: `${geometry.box}px`,
        pointerEvents: 'none',
        zIndex: 12,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      <path
        d={geometry.path}
        fill="none"
        stroke={COUNTDOWN_TRACK_COLOR}
        strokeWidth={geometry.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={geometry.path}
        fill="none"
        stroke={COUNTDOWN_PROGRESS_COLOR}
        strokeWidth={geometry.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={geometry.perimeter.toFixed(2)}
        strokeDashoffset={dashOffset.toFixed(2)}
        style={{ filter: `drop-shadow(${COUNTDOWN_GLOW})` }}
      />
      {showSpark && (
        <g
          transform={`translate(${spark.x.toFixed(2)} ${spark.y.toFixed(2)})`}
          style={{ filter: 'drop-shadow(0 0 3px rgba(57,255,20,0.95))' }}
        >
          {/* 닷의 지름이 stroke 두께와 동일하도록 반지름을 strokeWidth / 2 로 맞춤 */}
          <circle cx="0" cy="0" r={geometry.strokeWidth * 0.7} fill="rgba(57,255,20,0.22)">
            <animate attributeName="r" values={`${geometry.strokeWidth * 0.5};${geometry.strokeWidth * 0.9};${geometry.strokeWidth * 0.5}`} dur="1.15s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.75;0.25" dur="1.15s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r={geometry.strokeWidth * 0.5} fill="#ecfccb" stroke="#39FF14" strokeWidth={geometry.strokeWidth * 0.18}>
            <animate attributeName="opacity" values="1;0.45;1" dur="0.75s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </svg>
  );
};

// 포스트 썸네일 컴포넌트 (이미지/동영상 자동 판별)
const PostThumbnail: React.FC<{
  post: Post;
  className?: string;
  imgClassName?: string;
  onImgError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  size?: PlayBadgeSize;
  now: number;
  borderWidth: number;
}> = ({ post, className, imgClassName, onImgError, size = 'md', now, borderWidth }) => {
  const videoUrl = post.videoUrl;
  const imageUrl = post.image_url || post.image;
  const hasStoredThumbnail = !!imageUrl && !isVideoUrl(imageUrl) && imageUrl !== '/placeholder.svg';
  const isVideo = !!videoUrl || isVideoUrl(imageUrl);
  const ringGeometry = size === 'sm' ? RING_GEOMETRY_SM : RING_GEOMETRY_MD;

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
        <ThumbnailCountdownRing post={post} now={now} geometry={ringGeometry} borderWidth={borderWidth} />
      </div>
    );
  }

  const effectiveVideoUrl = videoUrl || (isVideoUrl(imageUrl) ? imageUrl : null);

  if (effectiveVideoUrl) {
    return (
      <div className={cn("relative w-full h-full", className)}>
        <VideoThumbnail videoUrl={effectiveVideoUrl} size={size} />
        <ThumbnailCountdownRing post={post} now={now} geometry={ringGeometry} borderWidth={borderWidth} />
      </div>
    );
  }

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
      <ThumbnailCountdownRing post={post} now={now} geometry={ringGeometry} borderWidth={borderWidth} />
    </div>
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
  /**
   * 부모(Index.tsx)에서 5분마다 트렌딩 fetch가 완료될 때마다 1씩 증가하는 카운터.
   * 이 값이 변할 때마다 "순위 변동 비교 기준(prevRanks)"을 직전 fetch 시점의 ranks로 갱신한다.
   * 데이터 시그니처가 동일하더라도(좋아요 변동 등으로 순위가 안 바뀐 경우에도)
   * 5분 간격으로 비교 기준이 갱신되어 NEW/▲/▼ 표시가 영원히 남는 문제가 없어진다.
   */
  refreshTick: number;
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
  now: number;
  authUserId?: string | null;
}

// 지도 마커와 동일한 테두리/그림자 룰을 썸네일에 그대로 적용한다.
// 우선순위: 광고 > 내 포스팅 > popular(HOT) > diamond/gold/silver > 일반
//
// borderWidth 를 분리해서 반환하는 이유:
//   카운트다운 링 SVG 는 box-sizing 으로 인해 줄어든 content box 가 아니라
//   border box (= 외곽 박스 자체) 에 정확히 맞춰 그려야 정렬이 어긋나지 않는다.
const getThumbnailFrameStyle = (post: Post, isMine: boolean): { borderWidth: number; border: string; boxShadow?: string } => {
  if (post.isAd) {
    return { borderWidth: 2.5, border: '2.5px solid #2563eb' };
  }
  if (isMine) {
    return { borderWidth: 2.5, border: '2.5px solid #4f46e5' };
  }
  const borderType = post.borderType || 'none';
  if (borderType === 'popular') {
    return { borderWidth: 2.5, border: '2.5px solid #ef4444', boxShadow: '0 0 12px rgba(239, 68, 68, 0.45)' };
  }
  if (borderType === 'diamond') {
    return { borderWidth: 2.5, border: '2.5px solid #22d3ee', boxShadow: '0 0 12px rgba(34, 211, 238, 0.7), inset 0 0 6px rgba(34, 211, 238, 0.45)' };
  }
  if (borderType === 'gold') {
    return { borderWidth: 2.5, border: '2.5px solid #fbbf24', boxShadow: '0 0 12px rgba(251, 191, 36, 0.55), inset 0 0 6px rgba(251, 191, 36, 0.35)' };
  }
  if (borderType === 'silver') {
    return { borderWidth: 2.5, border: '2.5px solid #94a3b8', boxShadow: '0 0 10px rgba(148, 163, 184, 0.65), inset 0 0 5px rgba(148, 163, 184, 0.25)' };
  }
  return { borderWidth: 2, border: '2px solid #ffffff', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' };
};

const TrendingPostItem: React.FC<TrendingPostItemProps> = React.memo(({ post, onPostClick, handleImageError, rankChange, now, authUserId }) => {
  const displayLocation = useLocationDisplay(post.location, post.lat, post.lng);

  const hasDisplayLocation = !!displayLocation && !['위치 정보 없음', '위치 미지정', '알 수 없는 장소'].includes(displayLocation);
  const isHot = Number(post.likes_per_hour ?? 0) >= 100;

  const borderType = post.borderType || 'none';
  const isMine = !!(authUserId && String((post as any).owner_id || post.user_id || '') === String(authUserId));
  const frameStyle = getThumbnailFrameStyle(post, isMine);

  // 순위 변동 UI 렌더
  const renderRankChange = () => {
    if (rankChange === null) {
      // NEW — PostItem의 새 포스팅 배지와 동일한 디자인 (노란 알약 + 흰 테두리)
      return (
        <div className="flex items-center justify-center shrink-0 w-9">
          <span
            aria-label="새 컨텐츠"
            className="inline-flex items-center justify-center rounded-full border-2 border-white bg-yellow-400 px-1.5 text-[9px] font-black leading-none tracking-[0.08em] text-amber-950"
            style={{ height: '18px' }}
          >
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

  // 실시간 트렌드 카드에 1위부터 0.2초씩 엇갈리게 흐르는 광택(shine) 효과.
  // 사이클 길이는 CSS에서 9s, 빛이 카드를 가로지르는 구간은 그중 일부 → 1위부터 20위까지
  // 순차적으로 차르륵 흘러내리듯 보임. 화면 밖일 때는 GPU 합성만 일어나고 비용은 낮다.
  const shineDelay = `${((post.rank ?? 1) - 1) * 0.2}s`;

  return (
    <div
      key={post.id}
      onClick={() => onPostClick(post)}
      className="relative flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer group overflow-hidden"
    >
      <div
        className="trending-shine-overlay"
        aria-hidden="true"
        style={{ ['--shine-delay' as any]: shineDelay }}
      >
        <div
          style={{
            width: '100%',
            height: '30px',
            background: 'lime',
            border: '3px solid magenta',
          }}
          data-debug="shine-bar-inline"
        />
      </div>
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

      <div
        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-50 box-border"
        style={{ border: frameStyle.border, boxShadow: frameStyle.boxShadow }}
      >
        <PostThumbnail post={post} onImgError={handleImageError} now={now} borderWidth={frameStyle.borderWidth} />
        {borderType !== 'none' && !post.isAd && !isMine && (
          <div className="absolute top-0.5 right-0.5 z-30">
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
          <HashtagText text={post.content || ''} />
        </p>
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-[11px] font-medium truncate",
            hasDisplayLocation ? "text-indigo-500" : "text-gray-400"
          )}>
            {displayLocation || '위치 정보 없음'}
          </p>
          <div className="flex items-center gap-0.5 text-rose-500 shrink-0">
            <Heart className="w-3 h-3 fill-rose-500" />
            <span className="text-[10px] font-black">{formatCount(Number(post.likes ?? 0))}</span>
          </div>
          <div className="flex items-center gap-0.5 text-sky-500 shrink-0">
            <Eye className="w-3 h-3" />
            <span className="text-[10px] font-black">{formatCount(Number(post.views_per_hour ?? 0))}</span>
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
      <div className="px-5 py-1">
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  // 광고가 없거나 비활성이면 구인 슬롯 사용
  const slot = ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT;

  // 구인 슬롯인 경우 별도 UI
  if (slot.isRecruitment) {
    return (
      <div className="px-5 py-1">
        <div
          onClick={(e) => {
            e.stopPropagation();
            window.open('mailto:support@thetocatoca.com', '_blank');
          }}
          className="w-full bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 rounded-2xl shadow-sm border border-amber-200/60 cursor-pointer relative overflow-hidden px-4 pt-2.5 pb-2.5 flex flex-col gap-1.5"
        >
          {/* 장식 원형 */}
          <div className="absolute -top-5 -right-5 w-24 h-24 bg-yellow-300/30 rounded-full pointer-events-none" />
          <div className="absolute -top-1 -right-1 w-14 h-14 bg-amber-300/30 rounded-full pointer-events-none" />
          {/* 상단 레이블 */}
          <span className="text-[10px] font-bold text-amber-600 tracking-wide">광고 문의</span>
          {/* 메인 카피 */}
          <div>
            <h2 className="text-[14px] font-black text-gray-900 leading-tight tracking-tight">
              좋은 브랜드를 기다리고 있어요.
            </h2>
            <p className="text-[10px] font-medium text-amber-700 mt-0.5">광고 문의는 언제든 환영이에요.</p>
          </div>
          {/* 이메일 버튼 */}
          <div className="flex items-center gap-2 bg-white/70 rounded-xl px-2.5 py-1.5 border border-amber-200/60">
            <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="flex-1 text-[11px] font-bold text-gray-900 tracking-tight">support@thetocatoca.com</span>
            <div className="w-5 h-5 bg-yellow-200 rounded-lg flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-1">
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
  refreshTick,
  isExpanded,
  onToggle,
  onPostClick,
  maxHeight,
}) => {
  const { user: authUser } = useAuth();
  const authUserId = authUser?.id || null;
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDownArrow, setShowScrollDownArrow] = useState(false);
  const [showScrollUpArrow, setShowScrollUpArrow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderExpandedBody, setRenderExpandedBody] = useState(isExpanded);
  const [visibleItemLimit, setVisibleItemLimit] = useState(8);
  const [thumbnailTimerNow, setThumbnailTimerNow] = useState(() => Date.now());
  // 비교 기준이 되는 "이전 순위" 스냅샷 — localStorage에서 1회 로드.
  // 현재 posts와 비교해 ▲/▼/NEW/유지를 표시한다.
  const [prevRanks, setPrevRanks] = useState<PrevRankMap>(() => loadPrevRanks());

  // 첫 진입 시(localStorage가 비어있던 사용자) NEW 표시를 억제하기 위한 플래그.
  // 신규 사용자는 비교 대상이 없으므로 모든 항목을 "유지(0)"로 표시한다.
  const [isFirstSnapshot, setIsFirstSnapshot] = useState<boolean>(() => {
    const loaded = loadPrevRanks();
    return Object.keys(loaded).length === 0;
  });

  // 다음 갱신 사이클에서 비교 기준으로 박을 ranks를 미리 저장해두는 ref.
  // - 매 5분 fetch 직후(refreshTick 변경 시) prevRanks를 이 ref의 직전 값으로 설정한 뒤,
  //   현재 posts의 ranks로 이 ref를 다시 채운다.
  // - 이렇게 하면 "이번에 표시되는 NEW/▲/▼은 직전 fetch 시점의 순위 기준"이 되고,
  //   다음 fetch가 오면 prevRanks가 이번 ranks로 갱신되어 NEW가 자연스럽게 사라진다.
  const ranksAtLastRefreshRef = useRef<PrevRankMap | null>(null);

  const isExpandedRef = useRef(isExpanded);

  // isExpanded 변경 시 ref 동기화 (클로저 캡처 문제 방지)
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    const timer = window.setInterval(() => setThumbnailTimerNow(Date.now()), COUNTDOWN_TIMER_UPDATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  // 5분 간격 fetch가 한 번씩 완료될 때마다(=refreshTick 증가) 비교 기준을 갱신한다.
  // - 첫 번째 fetch(refreshTick === 1): 비교 기준이 없으므로 prevRanks를 그대로 두고
  //   현재 posts의 ranks만 ref에 저장 → 다음 갱신부터 정상 비교 가능.
  // - 두 번째 이후: 직전 fetch 시점의 ranks를 prevRanks로 설정 → 새 posts와 비교됨.
  //   그 후 현재 posts의 ranks를 ref에 다시 저장 → 다음 비교의 기준이 됨.
  //
  // ⚠️ localStorage 저장 정책 (중요):
  //   localStorage에 저장하는 값은 "다음 마운트 시 비교 기준으로 쓸 ranks"여야 한다.
  //   즉, **현재 화면에 표시되는 ranks가 아니라 prevRanks**를 저장해야 한다.
  //   그래야 페이지 새로고침/탭 전환 후 다시 마운트됐을 때 NEW/▲/▼이 동일하게 유지된다.
  //   (이전 구현은 현재 ranks를 즉시 저장해버려서 새로고침하면 모든 항목이 '유지'로 보이는 버그가 있었음)
  useEffect(() => {
    if (refreshTick === 0 || posts.length === 0) return;

    const currentMap: PrevRankMap = {};
    posts.forEach((p: any) => {
      if (p.rank != null) currentMap[p.id] = p.rank;
    });

    if (ranksAtLastRefreshRef.current === null) {
      // 첫 fetch 도착
      // - 신규 사용자(prevRanks 비어있음): prevRanks를 현재 ranks로 박아 모두 "유지"로 표시
      //   → localStorage에도 currentMap을 저장(다음 마운트의 비교 기준).
      // - 기존 사용자(prevRanks=localStorage 직전 세션): prevRanks는 그대로 두고 비교 진행
      //   → localStorage는 절대 덮어쓰지 않는다. 이번 화면이 보여주는 NEW가 새로고침 후에도
      //     동일하게 보여야 하기 때문.
      if (Object.keys(prevRanks).length === 0) {
        setPrevRanks(currentMap);
        savePrevRanks(currentMap);
      }
      // 기존 사용자의 첫 fetch에서는 localStorage 갱신을 의도적으로 스킵.
    } else {
      // 두 번째 이후 fetch: 직전 fetch 시점의 ranks를 비교 기준으로 사용
      const newPrev = ranksAtLastRefreshRef.current;
      setPrevRanks(newPrev);
      // 비교 기준이 갱신됐으므로 localStorage도 동일하게 갱신.
      // (다음 마운트 시 동일한 비교 기준으로 NEW/▲/▼을 보여주기 위함)
      savePrevRanks(newPrev);
      if (isFirstSnapshot) setIsFirstSnapshot(false);
    }

    // 다음 갱신용으로 현재 ranks를 ref에만 저장(localStorage는 위에서 prevRanks로만 갱신).
    ranksAtLastRefreshRef.current = currentMap;
    // posts/prevRanks/isFirstSnapshot은 refreshTick 증가와 같은 렌더 사이클에 함께 갱신되거나
    // 별도 setter로만 변하므로, refreshTick에만 의존해도 stale 이슈가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

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
      className="bg-white rounded-[32px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-[background-color] duration-200"
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
                    <PostThumbnail post={currentPost!} onImgError={handleImageError} size="sm" now={thumbnailTimerNow} borderWidth={0} />
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
                        <HashtagText text={currentPost?.content || ''} />
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  {/* 순위 변동 */}
                  {(() => {
                    const rc = currentPost ? getRankChange(currentPost) : undefined;
                    if (rc === null) return (
                      <span
                        aria-label="새 컨텐츠"
                        className="inline-flex items-center justify-center rounded-full border-2 border-white bg-yellow-400 px-1.5 text-[9px] font-black leading-none tracking-[0.08em] text-amber-950 shrink-0"
                        style={{ height: '18px' }}
                      >NEW</span>
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
            {/* data-bottom-nav-keep: 이 컨테이너의 스크롤 이벤트는 BottomNav 숨김 로직에서 무시됨
                → 실시간 인기 패널을 스크롤해도 하단 알약 메뉴바가 사라지지 않는다. */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-scroll no-scrollbar pb-2 px-3 space-y-2 relative"
              data-trending-scroll="true"
              data-bottom-nav-keep="true"
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
                  now={thumbnailTimerNow}
                  authUserId={authUserId}
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