"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MapPin,
  Navigation,
  Volume2,
  VolumeX,
  Play,
  ChevronUp,
  Clapperboard,
} from "lucide-react";
import { Post } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toggleLikeInDb } from "@/utils/like-utils";
import { cn, getOptimizedFeedImage, getFallbackImage } from "@/lib/utils";
import { handleShare } from "@/utils/share";
import PostCommentsDialog from "@/components/PostCommentsDialog";
import PostUserAvatar from "@/components/PostUserAvatar";
import HashtagText from "@/components/HashtagText";
import ImageSliderDots from "@/components/ImageSliderDots";
import AdMobInterstitialPlaceholder from "@/components/AdMobInterstitialPlaceholder";
import { fetchCommentsByPostId, isPersistedPostId } from "@/utils/comments";

// 광고 삽입 주기 (포스팅 3개마다 광고 1개)
const AD_INSERT_INTERVAL = 3;

const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase().split("?")[0];
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".avi") ||
    lower.endsWith(".m4v")
  );
};

// Fisher-Yates 셔플
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 슬라이드 아이템 타입 (포스트 / 광고 / 끝-안내)
type ReelItem =
  | { kind: "post"; post: Post; key: string }
  | { kind: "ad"; key: string }
  | { kind: "end"; key: string };

interface ReelsViewerProps {
  isOpen: boolean;
  initialPost: Post | null;
  pool: Post[]; // 알고리즘에서 사용할 인기 포스트 풀 (shuffle 모드 전용)
  onClose: () => void;
  // ranked 모드: 1~20위 같은 고정 순서로 보여주고, 무한 스크롤/셔플/광고 없음
  // rankedPosts의 0번 인덱스가 1위, 1번이 2위, ...
  mode?: "shuffle" | "ranked";
  rankedPosts?: Post[];
  // noRepeat: shuffle 모드에서 풀이 소진되면 재셔플하지 않고 "끝" 슬라이드로 마무리
  noRepeat?: boolean;
  // 끝 슬라이드에 표시할 메시지
  endMessage?: string;
  // 끝 슬라이드에 표시할 보조 텍스트
  endSubMessage?: string;
  // embedded: 페이지 내부에 인라인으로 렌더링 (portal 사용 X, 전역 플래그/X버튼 없음)
  // - BottomNav 등 페이지 chrome이 그대로 노출됨
  // - 음소거 버튼은 영상 내부 좌상단에 배치됨
  embedded?: boolean;
  // embedded 모드에서 영상/이미지 우상단에 닫기(X) 버튼을 표시 (트렌딩 릴스 뷰어용)
  showInlineCloseButton?: boolean;
}

const ReelsViewer: React.FC<ReelsViewerProps> = ({
  isOpen,
  initialPost,
  pool,
  onClose,
  mode = "shuffle",
  rankedPosts,
  noRepeat = false,
  endMessage = "더 이상 표시할 영상이 없습니다",
  endSubMessage = "처음으로 돌아가거나 닫아주세요.",
  embedded = false,
  showInlineCloseButton = false,
}) => {
  const isRankedMode = mode === "ranked";
  // 풀이 모두 소진되었는지 (noRepeat 모드 전용)
  const exhaustedRef = useRef(false);
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ReelItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // 한 번 음소거를 해제하면 세션 동안 유지 (localStorage 영구 저장)
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("reels_muted_v1");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const [showHint, setShowHint] = useState(true);

  // muted 변경 시 localStorage에 영구 저장
  useEffect(() => {
    try {
      localStorage.setItem("reels_muted_v1", String(muted));
    } catch {}
  }, [muted]);

  // 댓글 다이얼로그 상태
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  // 포스트별 좋아요/저장 로컬 상태
  const [likeMap, setLikeMap] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  // 다음 라운드용 풀 (셔플된 후속 포스트)
  const queueRef = useRef<Post[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // 초기화: initialPost를 첫 슬라이드로 두고, 풀에서 셔플한 나머지를 큐에 보관
  // ranked 모드: rankedPosts 전체를 고정 순서로 사용, initialPost는 시작 인덱스만 결정
  useEffect(() => {
    if (!isOpen || !initialPost) return;

    if (isRankedMode) {
      const list = rankedPosts && rankedPosts.length > 0 ? rankedPosts : [initialPost];
      const rankedItems: ReelItem[] = list.map((p) => ({
        kind: "post",
        post: p,
        key: `ranked-post-${p.id}`,
      }));

      const startIdx = Math.max(
        0,
        list.findIndex((p) => p.id === initialPost.id)
      );

      // 좋아요/저장 초기 상태 시드
      const seedLikes: Record<string, { liked: boolean; count: number }> = {};
      const seedSaved: Record<string, boolean> = {};
      list.forEach((p) => {
        seedLikes[p.id] = { liked: !!p.isLiked, count: p.likes || 0 };
        seedSaved[p.id] = !!p.isSaved;
      });

      // ranked 모드에서는 큐/seen 사용 안 함
      queueRef.current = [];
      seenIdsRef.current = new Set(list.map((p) => p.id));

      setItems(rankedItems);
      setActiveIndex(startIdx);
      setLikeMap(seedLikes);
      setSavedMap(seedSaved);

      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = 0;
      });
      return;
    }

    seenIdsRef.current = new Set([initialPost.id]);
    exhaustedRef.current = false;
    const remaining = pool.filter((p) => p.id !== initialPost.id);
    const shuffled = shuffle(remaining);
    queueRef.current = shuffled;

    // 처음에 초기 포스트 + 첫 6개 정도를 미리 펼침
    const initialBatch = queueRef.current.splice(0, 6);
    initialBatch.forEach((p) => seenIdsRef.current.add(p.id));

    const initialItems: ReelItem[] = [
      { kind: "post", post: initialPost, key: `post-${initialPost.id}` },
      ...initialBatch.map<ReelItem>((p) => ({ kind: "post", post: p, key: `post-${p.id}` })),
    ];

    // noRepeat 모드에서 광고는 의미가 없고(반복/추가 로드 없음), 끝 안내가 더 중요하므로 광고 삽입 생략
    const withAds: ReelItem[] = [];
    if (noRepeat) {
      withAds.push(...initialItems);
    } else {
      // 3개마다 광고 삽입
      let postCounter = 0;
      initialItems.forEach((it) => {
        withAds.push(it);
        if (it.kind === "post") {
          postCounter++;
          if (postCounter % AD_INSERT_INTERVAL === 0) {
            withAds.push({ kind: "ad", key: `ad-${postCounter}-${Date.now()}` });
          }
        }
      });
    }

    // noRepeat 모드에서 풀이 이미 소진되면 끝 슬라이드 추가
    if (noRepeat && queueRef.current.length === 0) {
      exhaustedRef.current = true;
      withAds.push({ kind: "end", key: `end-${Date.now()}` });
    }

    setItems(withAds);
    setActiveIndex(0);

    // 좋아요/저장 초기 상태 시드
    const seedLikes: Record<string, { liked: boolean; count: number }> = {};
    const seedSaved: Record<string, boolean> = {};
    [initialPost, ...initialBatch].forEach((p) => {
      seedLikes[p.id] = { liked: !!p.isLiked, count: p.likes || 0 };
      seedSaved[p.id] = !!p.isSaved;
    });
    setLikeMap(seedLikes);
    setSavedMap(seedSaved);

    // 컨테이너 스크롤을 맨 위로
    requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.scrollTop = 0;
    });
  }, [isOpen, initialPost?.id, isRankedMode, rankedPosts]);

  // 풀에서 더 가져오기 (큐가 부족하면 알고리즘으로 재셔플)
  // noRepeat 모드: 풀이 소진되면 재셔플하지 않고 끝 슬라이드를 한 번만 추가
  const appendMore = useCallback(() => {
    if (noRepeat) {
      // 이미 끝 슬라이드가 붙은 경우 더 이상 호출 X
      if (exhaustedRef.current) return;

      // 큐가 비었고 풀에 남은 새 포스트도 없으면 끝 슬라이드 추가 후 종료
      if (queueRef.current.length === 0) {
        exhaustedRef.current = true;
        setItems((prev) => [...prev, { kind: "end", key: `end-${Date.now()}` }]);
        return;
      }

      // noRepeat에서는 광고도 넣지 않고 남은 큐만 그대로 펼침
      const nextBatch = queueRef.current.splice(0, 5);
      if (nextBatch.length === 0) {
        exhaustedRef.current = true;
        setItems((prev) => [...prev, { kind: "end", key: `end-${Date.now()}` }]);
        return;
      }

      nextBatch.forEach((p) => seenIdsRef.current.add(p.id));

      setItems((prev) => {
        const additions: ReelItem[] = nextBatch.map((p) => ({
          kind: "post",
          post: p,
          key: `post-${p.id}-${Math.random().toString(36).slice(2, 6)}`,
        }));
        // 큐가 이번에 완전히 소진되었으면 곧바로 끝 슬라이드도 함께 추가
        if (queueRef.current.length === 0) {
          exhaustedRef.current = true;
          additions.push({ kind: "end", key: `end-${Date.now()}` });
        }
        return [...prev, ...additions];
      });

      setLikeMap((prev) => {
        const next = { ...prev };
        nextBatch.forEach((p) => {
          if (!next[p.id]) next[p.id] = { liked: !!p.isLiked, count: p.likes || 0 };
        });
        return next;
      });
      setSavedMap((prev) => {
        const next = { ...prev };
        nextBatch.forEach((p) => {
          if (!(p.id in next)) next[p.id] = !!p.isSaved;
        });
        return next;
      });
      return;
    }

    if (queueRef.current.length < 5) {
      // 풀 재셔플: 이미 본 것 제외 → 모두 봤다면 풀 전체를 재사용 (반복 노출 허용)
      const unseen = pool.filter((p) => !seenIdsRef.current.has(p.id));
      const source = unseen.length > 0 ? unseen : pool;
      queueRef.current.push(...shuffle(source));
      // 풀이 모두 소진되면 seen을 리셋해서 무한 스크롤 허용
      if (unseen.length === 0) seenIdsRef.current = new Set();
    }

    const nextBatch = queueRef.current.splice(0, 5);
    if (nextBatch.length === 0) return;

    nextBatch.forEach((p) => seenIdsRef.current.add(p.id));

    setItems((prev) => {
      // 현재 포스트 개수 카운트
      const currentPostCount = prev.filter((it) => it.kind === "post").length;
      const additions: ReelItem[] = [];
      let postCounter = currentPostCount;
      nextBatch.forEach((p) => {
        additions.push({ kind: "post", post: p, key: `post-${p.id}-${Math.random().toString(36).slice(2, 6)}` });
        postCounter++;
        if (postCounter % AD_INSERT_INTERVAL === 0) {
          additions.push({ kind: "ad", key: `ad-${postCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
        }
      });
      return [...prev, ...additions];
    });

    setLikeMap((prev) => {
      const next = { ...prev };
      nextBatch.forEach((p) => {
        if (!next[p.id]) next[p.id] = { liked: !!p.isLiked, count: p.likes || 0 };
      });
      return next;
    });
    setSavedMap((prev) => {
      const next = { ...prev };
      nextBatch.forEach((p) => {
        if (!(p.id in next)) next[p.id] = !!p.isSaved;
      });
      return next;
    });
  }, [pool, noRepeat]);

  // 활성 인덱스 추적 + 강제 스냅 (한 번에 1개씩만 이동)
  // CSS 스크롤은 비활성화하고 transform으로만 슬라이드 전환
  // 활성 인덱스 변경 시 자동으로 transform이 적용되므로 별도 스크롤 핸들러 불필요
  useEffect(() => {
    if (!isOpen) return;
    setShowHint(false);
    // 새 슬라이드로 이동해도 사용자가 마지막에 선택한 UI 표시 상태를 유지함
  }, [activeIndex, isOpen]);

  // 끝에 가까워지면 추가 로드 (ranked 모드에서는 무한 스크롤 없음)
  useEffect(() => {
    if (!isOpen) return;
    if (isRankedMode) return;
    if (items.length === 0) return;
    if (activeIndex >= items.length - 3) {
      appendMore();
    }
  }, [activeIndex, items.length, isOpen, appendMore, isRankedMode]);

  // 모달 열림 시 body 스크롤 잠금 + 전역 플래그/이벤트
  // embedded 모드에서는 페이지의 일부로 동작하므로 전역 상태를 바꾸지 않는다 (BottomNav 등 chrome 유지)
  useEffect(() => {
    if (!isOpen) return;
    if (embedded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (window as any).__isReelsViewerOpen = true;
    window.dispatchEvent(new CustomEvent("open-reels-viewer"));
    return () => {
      document.body.style.overflow = prev;
      (window as any).__isReelsViewerOpen = false;
      window.dispatchEvent(new CustomEvent("close-reels-viewer"));
    };
  }, [isOpen, embedded]);

  // ESC + 안드로이드 백버튼 닫기
  // embedded 모드에서는 페이지 자체의 백버튼 처리(이전 페이지로 이동)에 위임
  useEffect(() => {
    if (!isOpen) return;
    if (embedded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleBackClose = () => onClose();
    window.addEventListener("keydown", handler);
    window.addEventListener("close-reels-viewer-by-back", handleBackClose);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("close-reels-viewer-by-back", handleBackClose);
    };
  }, [isOpen, onClose, embedded]);

  const handleLikeToggle = useCallback(
    (postId: string) => {
      if (!authUser?.id) return;
      const cur = likeMap[postId];
      if (!cur) return;
      const wasLiked = cur.liked;
      setLikeMap((prev) => ({
        ...prev,
        [postId]: {
          liked: !wasLiked,
          count: wasLiked ? Math.max(0, cur.count - 1) : cur.count + 1,
        },
      }));
      toggleLikeInDb(postId, authUser.id, wasLiked).then((ok) => {
        if (!ok) {
          setLikeMap((prev) => ({ ...prev, [postId]: cur }));
        }
      });
    },
    [authUser?.id, likeMap]
  );

  const handleSaveToggle = useCallback(
    async (postId: string) => {
      if (!authUser?.id) return;
      if (!isPersistedPostId(postId)) return;
      const prev = !!savedMap[postId];
      const next = !prev;
      setSavedMap((m) => ({ ...m, [postId]: next }));
      try {
        if (next) {
          const { data: existing } = await supabase
            .from("saved_posts")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", authUser.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from("saved_posts").insert({ post_id: postId, user_id: authUser.id });
          }
        } else {
          await supabase
            .from("saved_posts")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", authUser.id);
        }
      } catch {
        setSavedMap((m) => ({ ...m, [postId]: prev }));
      }
    },
    [authUser?.id, savedMap]
  );

  const handleLocationClick = useCallback(
    (post: Post) => {
      const lat = post.latitude ?? post.lat;
      const lng = post.longitude ?? post.lng;
      if (lat == null || lng == null) return;
      onClose();
      // 닫힘 애니메이션 직후 이동
      setTimeout(() => {
        navigate("/", { state: { center: { lat, lng }, post } });
      }, 50);
    },
    [navigate, onClose]
  );

  // 현재 활성 슬라이드가 비디오 포스트인지 (음소거 버튼 표시 조건)
  const activeIsVideo = useMemo(() => {
    const current = items[activeIndex];
    if (!current || current.kind !== "post") return false;
    const p = current.post;
    return !!p.videoUrl || isVideoUrl(p.image_url || p.image);
  }, [items, activeIndex]);

  if (!isOpen) return null;

  // 슬라이드 트랙 + 끝 슬라이드 콜백 (embedded 모드에서는 닫기 동작이 없음 → onClose는 페이지 뒤로가기로 위임)
  const sliderContent = (
    <>
      {/* 좌측: 순위 뱃지 (ranked 모드) + 음소거 토글 (비디오일 때만) / 우측: 닫기 버튼
          embedded 모드에서는 이 헤더 영역 전체를 숨기고, 음소거 버튼은 영상 내부 좌상단으로 옮긴다. */}
      {!embedded && (
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pointer-events-none"
          style={{
            paddingTop:
              "max(calc(env(safe-area-inset-top, 0px) + 12px), " +
              "calc(100dvh - env(safe-area-inset-bottom, 0px) - 160px - min(100vw * 4 / 3, 100dvh - env(safe-area-inset-bottom, 0px) - 160px) - 48px))",
          }}
        >
          <div className="flex items-center gap-2">
            {isRankedMode && (() => {
              const rank = activeIndex + 1;
              const palette =
                rank === 1
                  ? { bg: "from-amber-400 to-amber-500", text: "text-white", glow: "shadow-amber-500/40" }
                  : rank === 2
                  ? { bg: "from-slate-300 to-slate-400", text: "text-white", glow: "shadow-slate-400/40" }
                  : rank === 3
                  ? { bg: "from-orange-400 to-orange-500", text: "text-white", glow: "shadow-orange-500/40" }
                  : { bg: "from-gray-300 to-gray-300", text: "text-gray-900", glow: "shadow-gray-400/40" };
              return (
                <motion.div
                  key={`rank-${rank}`}
                  initial={{ opacity: 0, scale: 0.85, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={cn(
                    "pointer-events-auto inline-flex items-center gap-1 h-10 px-3 rounded-full bg-gradient-to-br shadow-lg backdrop-blur-md border border-white/20",
                    palette.bg,
                    palette.glow
                  )}
                  aria-label={`${rank}위`}
                >
                  <span className={cn("text-[15px] font-black tabular-nums leading-none tracking-tight", palette.text)}>
                    {rank}
                  </span>
                  <span className={cn("text-[11px] font-black leading-none tracking-tight", palette.text)}>위</span>
                </motion.div>
              );
            })()}

            {activeIsVideo && (
              <button
                onClick={() => setMuted((m) => !m)}
                className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
                aria-label={muted ? "음소거 해제" : "음소거"}
              >
                {muted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            )}

            {!isRankedMode && !activeIsVideo && <div className="w-10 h-10" aria-hidden="true" />}
          </div>

          <button
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* 스와이프 힌트 (처음에만) */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-1"
          >
            <ChevronUp className="w-6 h-6 text-white/80 animate-bounce" />
            <span className="text-white/80 text-xs font-bold tracking-wide">위로 스와이프</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transform 기반 슬라이더 — 한 번에 1개씩만 이동 (스와이프 강도와 무관) */}
      <ReelsSlideTrack
        containerRef={containerRef}
        activeIndex={activeIndex}
        itemCount={items.length}
        onActiveIndexChange={setActiveIndex}
        embedded={embedded}
      >
        {items.map((item, index) => (
          <div
            key={item.key}
            data-reel-index={index}
            className="absolute left-0 right-0 w-full"
            style={
              embedded
                ? { height: "100%", top: `${index * 100}%` }
                : { height: "100dvh", top: `${index * 100}dvh` }
            }
          >
            {item.kind === "post" ? (
              <ReelSlide
                post={item.post}
                isActive={index === activeIndex}
                muted={muted}
                liked={likeMap[item.post.id]?.liked ?? !!item.post.isLiked}
                likesCount={likeMap[item.post.id]?.count ?? item.post.likes ?? 0}
                saved={savedMap[item.post.id] ?? !!item.post.isSaved}
                onLikeToggle={() => handleLikeToggle(item.post.id)}
                onSaveToggle={() => handleSaveToggle(item.post.id)}
                onCommentClick={() => setCommentsPostId(item.post.id)}
                onLocationClick={() => handleLocationClick(item.post)}
                onUserClick={() => {
                  const targetUserId = item.post.owner_id || item.post.user_id || item.post.user.id;
                  const isValidUUID =
                    targetUserId &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
                  if (!isValidUUID) return;
                  onClose();
                  setTimeout(() => {
                    if (authUser?.id === targetUserId) navigate("/profile");
                    else navigate(`/profile/${targetUserId}`);
                  }, 50);
                }}
                embedded={embedded}
                showInlineMuteButton={embedded}
                onToggleMute={() => setMuted((m) => !m)}
                showInlineCloseButton={embedded && showInlineCloseButton}
                onClose={onClose}
                inlineRank={embedded && isRankedMode ? index + 1 : undefined}
              />
            ) : item.kind === "ad" ? (
              <AdMobInterstitialPlaceholder isActive={index === activeIndex} />
            ) : (
              <ReelsEndSlide
                message={endMessage}
                subMessage={endSubMessage}
                onClose={onClose}
                embedded={embedded}
                showCloseButton={!embedded}
              />
            )}
          </div>
        ))}
      </ReelsSlideTrack>

      {/* 댓글 다이얼로그 */}
      <PostCommentsDialog
        isOpen={!!commentsPostId}
        onOpenChange={(open) => {
          if (!open) setCommentsPostId(null);
        }}
        postId={commentsPostId || ""}
        initialComments={[]}
        authUser={authUser}
        profile={null}
        onCommentsChange={() => {}}
      />
    </>
  );

  // embedded: 페이지 안에 인라인으로 렌더 (portal X)
  if (embedded) {
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        {sliderContent}
      </div>
    );
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="reels-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-black"
      >
        {sliderContent}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

// ─── Transform 기반 슬라이더 트랙 ────────────────────────────
// 강한 스와이프든 약한 스와이프든 한 번에 1개씩만 이동하도록 강제
interface ReelsSlideTrackProps {
  containerRef: React.RefObject<HTMLDivElement>;
  activeIndex: number;
  itemCount: number;
  onActiveIndexChange: (idx: number) => void;
  children: React.ReactNode;
  // embedded면 슬라이드 높이를 100dvh 대신 컨테이너 100% 기준으로 계산
  embedded?: boolean;
}

const ReelsSlideTrack: React.FC<ReelsSlideTrackProps> = ({
  containerRef,
  activeIndex,
  itemCount,
  onActiveIndexChange,
  children,
  embedded = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 모든 상태를 ref로 관리해 클로저/state 비동기성 문제 회피
  const activeIndexRef = useRef(activeIndex);
  const itemCountRef = useRef(itemCount);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const startTimeRef = useRef(0);
  const startIndexRef = useRef(0); // 이번 터치 시작 시점의 인덱스 (고정)
  const lockTransitionRef = useRef(false);
  const consumedRef = useRef(false); // 이번 터치 제스처가 이미 슬라이드를 소비했는지

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    itemCountRef.current = itemCount;
  }, [itemCount]);

  const goTo = useCallback(
    (nextIndex: number) => {
      const currentActive = activeIndexRef.current;
      const clamped = Math.max(0, Math.min(itemCountRef.current - 1, nextIndex));

      // 같은 인덱스면 단순 복귀
      if (clamped === currentActive) {
        setIsTransitioning(true);
        setDragOffset(0);
        window.setTimeout(() => setIsTransitioning(false), 220);
        return;
      }

      lockTransitionRef.current = true;
      setIsTransitioning(true);
      setDragOffset(0);
      activeIndexRef.current = clamped; // 즉시 ref 업데이트 (state는 비동기)
      onActiveIndexChange(clamped);

      // 전환 애니메이션 중에만 락 (연속 스와이프 빠른 반응을 위해 짧게)
      window.setTimeout(() => {
        setIsTransitioning(false);
        lockTransitionRef.current = false;
      }, 220);
    },
    [onActiveIndexChange]
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const handleTouchStart = (e: TouchEvent) => {
      // 전환 중이면 새 제스처 시작 자체를 거부
      if (lockTransitionRef.current) {
        consumedRef.current = true; // 이번 제스처는 무시
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      isDraggingRef.current = true;
      consumedRef.current = false;
      startYRef.current = touch.clientY;
      lastYRef.current = touch.clientY;
      startTimeRef.current = Date.now();
      startIndexRef.current = activeIndexRef.current; // 시작 인덱스 고정
      setIsTransitioning(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || consumedRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();

      let dy = touch.clientY - startYRef.current;
      lastYRef.current = touch.clientY;

      const startIdx = startIndexRef.current;
      const atTop = startIdx === 0 && dy > 0;
      const atBottom = startIdx === itemCountRef.current - 1 && dy < 0;
      if (atTop || atBottom) {
        dy = dy * 0.25;
      }

      // 손가락 이동량을 슬라이드 1개 높이로 제한 (시각적으로만)
      const maxDrag = root.clientHeight;
      if (dy > maxDrag) dy = maxDrag;
      if (dy < -maxDrag) dy = -maxDrag;

      setDragOffset(dy);
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) {
        consumedRef.current = false;
        return;
      }
      isDraggingRef.current = false;

      // 이미 소비된 제스처는 무시
      if (consumedRef.current) {
        consumedRef.current = false;
        setDragOffset(0);
        return;
      }
      consumedRef.current = true; // 이번 제스처 소비 처리

      const dy = lastYRef.current - startYRef.current;
      const dt = Date.now() - startTimeRef.current;
      const velocity = Math.abs(dy) / Math.max(dt, 1);
      const slideHeight = root.clientHeight;

      const distanceThreshold = slideHeight * 0.2;
      const isFlick = velocity > 0.3 && Math.abs(dy) > 30;

      const startIdx = startIndexRef.current;
      let nextIndex = startIdx;

      // 거리/속도와 무관하게 무조건 ±1만 이동 (시작 인덱스 기준)
      if (dy < -distanceThreshold || (isFlick && dy < 0)) {
        nextIndex = startIdx + 1;
      } else if (dy > distanceThreshold || (isFlick && dy > 0)) {
        nextIndex = startIdx - 1;
      }

      goTo(nextIndex);
    };

    // 휠/트랙패드 (PC): 한 번에 1개만
    // 전략: 한 번의 제스처 = 1칸 이동
    //  - 첫 wheel 이벤트 → 1칸 이동 + 락 ON
    //  - 락 상태에서 추가 wheel 이벤트는 무시하되, "마지막 wheel로부터 120ms 동안 추가 입력이 없으면" 락 해제
    //  - 단, 방향이 반대로 바뀌면 즉시 새 제스처로 인정 (양방향 빠른 스와이프 지원)
    let wheelLocked = false;
    let lockedDirection = 0; // 락 걸린 시점의 방향
    let wheelIdleTimer: number | null = null;

    const scheduleUnlock = () => {
      if (wheelIdleTimer) window.clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(() => {
        wheelLocked = false;
        lockedDirection = 0;
        wheelIdleTimer = null;
      }, 120);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const delta = e.deltaY;
      const absDelta = Math.abs(delta);
      const direction = delta > 0 ? 1 : -1;

      if (absDelta < 1) return;

      // 전환 애니메이션 중에는 무조건 무시
      if (lockTransitionRef.current) {
        scheduleUnlock();
        return;
      }

      if (wheelLocked) {
        // 방향이 반대로 바뀌었으면 즉시 새 제스처로 인정
        if (direction !== lockedDirection) {
          goTo(activeIndexRef.current + direction);
          lockedDirection = direction;
        }
        // 같은 방향이면 무시 (관성 꼬리)
        scheduleUnlock();
        return;
      }

      // 첫 이벤트: 1칸 이동 + 락
      goTo(activeIndexRef.current + direction);
      wheelLocked = true;
      lockedDirection = direction;
      scheduleUnlock();
    };

    const handleKey = (e: KeyboardEvent) => {
      if (lockTransitionRef.current) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(activeIndexRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(activeIndexRef.current - 1);
      }
    };

    root.addEventListener("touchstart", handleTouchStart, { passive: true });
    root.addEventListener("touchmove", handleTouchMove, { passive: false });
    root.addEventListener("touchend", handleTouchEnd, { passive: true });
    root.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    root.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKey);

    return () => {
      root.removeEventListener("touchstart", handleTouchStart);
      root.removeEventListener("touchmove", handleTouchMove);
      root.removeEventListener("touchend", handleTouchEnd);
      root.removeEventListener("touchcancel", handleTouchEnd);
      root.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKey);
      if (wheelIdleTimer) window.clearTimeout(wheelIdleTimer);
    };
  }, [goTo, containerRef]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <div
        ref={trackRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transform: embedded
            ? `translate3d(0, calc(${-activeIndex * 100}% + ${dragOffset}px), 0)`
            : `translate3d(0, calc(${-activeIndex * 100}dvh + ${dragOffset}px), 0)`,
          transition: isTransitioning ? "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── 본문 텍스트 (1줄 클램프 + 우측 "더 보기") ──────────────
// 본문이 1줄을 초과해 잘리면 우측 끝에 "... 더 보기" 버튼을 표시.
// 펼치기 전: 한 줄(line-clamp-1)로만 노출.
// 펼치면: 모든 내용 표시 + 버튼 사라짐.
interface ReelContentTextProps {
  content: string;
  expanded: boolean;
  onToggle: () => void;
}

const ReelContentText: React.FC<ReelContentTextProps> = ({ content, expanded, onToggle }) => {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // 본문이 한 줄에 들어가는지 측정.
  // expanded 상태에서는 측정 노드가 마운트되지 않으므로 측정을 건너뛰고,
  // 직전 collapsed 상태에서 계산한 isOverflowing 값을 그대로 사용한다.
  // (측정 노드가 unmount 되며 ResizeObserver가 0×0으로 한 번 더 콜백을
  //  호출해 isOverflowing이 false로 덮어써지던 문제를 방지)
  useEffect(() => {
    if (expanded) return;
    const el = measureRef.current;
    if (!el) return;
    const check = () => {
      // 노드가 DOM에서 분리(또는 디스플레이 없음)되면 측정 결과를 무시
      if (!el.isConnected || el.clientWidth === 0) return;
      const overflow = el.scrollWidth > el.clientWidth + 1;
      setIsOverflowing((prev) => (prev === overflow ? prev : overflow));
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content, expanded]);

  return (
    <div className="text-sm leading-snug font-medium drop-shadow-md pr-2">
      {expanded ? (
        <div>
          <p className="inline">
            <HashtagText
              text={content}
              tagClassName="font-black text-indigo-300 hover:text-indigo-200 active:text-indigo-100"
            />
          </p>
          {isOverflowing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="ml-2 inline-flex items-center align-baseline text-xs font-black text-white hover:text-white/90"
            >
              {'... <닫기>'}
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* 측정용/표시용 — 항상 truncate로 한 줄 처리.
              우측 패딩은 두지 않고, "더 보기" 버튼은 우측에 절대 위치로 오버레이. */}
          <span
            ref={measureRef}
            className="block truncate leading-snug"
          >
            <HashtagText
              text={content}
              tagClassName="font-black text-indigo-300 hover:text-indigo-200 active:text-indigo-100"
            />
          </span>
          {isOverflowing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="absolute bottom-0 right-0 pl-3 text-xs font-bold text-white/90 hover:text-white transition-colors"
              style={{
                background:
                  'linear-gradient(to right, transparent, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0.8) 100%)',
              }}
            >
              ... 더 보기
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 개별 슬라이드 (포스트) ────────────────────────────────
interface ReelSlideProps {
  post: Post;
  isActive: boolean;
  muted: boolean;
  liked: boolean;
  likesCount: number;
  saved: boolean;
  onLikeToggle: () => void;
  onSaveToggle: () => void;
  onCommentClick: () => void;
  onLocationClick: () => void;
  onUserClick: () => void;
  // embedded: 페이지 안에 인라인으로 들어간 모드 (BottomNav 등이 보이는 상태)
  embedded?: boolean;
  // 영상 내부 좌상단에 표시할 음소거 토글 (embedded 모드 전용)
  showInlineMuteButton?: boolean;
  onToggleMute?: () => void;
  // 미디어 우상단에 표시할 닫기(X) 버튼 (embedded 모드 + ranked 트렌딩 뷰어 전용)
  showInlineCloseButton?: boolean;
  onClose?: () => void;
  // 미디어 좌상단에 표시할 순위 뱃지 (값이 있으면 표시; embedded ranked 모드 전용)
  inlineRank?: number;
}

const ReelSlide: React.FC<ReelSlideProps> = ({
  post,
  isActive,
  muted,
  liked,
  likesCount,
  saved,
  onLikeToggle,
  onSaveToggle,
  onCommentClick,
  onLocationClick,
  onUserClick,
  embedded = false,
  showInlineMuteButton = false,
  onToggleMute,
  showInlineCloseButton = false,
  onClose,
  inlineRank,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  // video 첫 프레임이 그려진 이후에만 큰 "재생/일시정지" 오버레이를 노출
  // (로딩 중에 회색 재생 버튼이 떠서 버그처럼 보이는 문제 방지)
  const [videoFirstFrameReady, setVideoFirstFrameReady] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(post.commentsCount || 0);

  // 영상 타임라인 상태
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  // 스크럽 중에는 사용자가 드래그하는 위치를 표시 (currentTime은 video element가 따라옴)
  const [scrubTime, setScrubTime] = useState(0);
  // 스크럽 시작 직전 재생 중이었는지 (드래그 끝나면 복원)
  const wasPlayingBeforeScrubRef = useRef(false);

  // ── 다중 미디어 (이미지/영상 여러개) ────────────────────
  // post.videoUrl이 있으면 영상이 우선 미디어가 되고, post.image_url/post.image는
  // "영상 썸네일"이므로 슬라이드에 중복 추가하지 않는다.
  // 단, post.images에 영상 외 추가 이미지가 들어 있다면 그것은 보여준다(영상+추가사진 케이스).
  const mediaList = useMemo<string[]>(() => {
    const candidates: string[] = [];
    const thumbnailUrl = post.image_url || post.image;

    if (post.videoUrl) {
      candidates.push(post.videoUrl);
      // 영상이 있을 땐 대표 썸네일은 슬라이드에서 제외하고,
      // images 배열에서 썸네일/영상과 다른 추가 이미지만 합친다.
      if (Array.isArray(post.images) && post.images.length > 0) {
        post.images.forEach((u) => {
          if (!u) return;
          if (u === post.videoUrl) return;
          if (u === thumbnailUrl) return;
          if (candidates.includes(u)) return;
          candidates.push(u);
        });
      }
    } else if (Array.isArray(post.images) && post.images.length > 0) {
      post.images.forEach((u) => {
        if (u && !candidates.includes(u)) candidates.push(u);
      });
    } else if (thumbnailUrl) {
      candidates.push(thumbnailUrl);
    }

    return candidates.filter(Boolean) as string[];
  }, [post.videoUrl, post.images, post.image_url, post.image]);

  const [mediaIndex, setMediaIndex] = useState(0);

  // 새 포스트가 들어오면 인덱스 초기화
  useEffect(() => {
    setMediaIndex(0);
  }, [post.id]);

  const activeMediaUrl = mediaList[mediaIndex] || "";
  const activeIsVideo = isVideoUrl(activeMediaUrl);
  const hasVideo = activeIsVideo; // 현재 보여지는 미디어가 영상인지

  const fallbackImage = useMemo(() => {
    // 1순위: 일반 이미지 (영상이 아닌 슬라이드)
    const firstImage = mediaList.find((u) => !isVideoUrl(u));
    if (firstImage) return getOptimizedFeedImage(firstImage, post.id);
    // 2순위: 영상이 있고 별도 이미지가 없더라도 image_url/image가 영상 썸네일로 저장돼 있음 → 그걸 poster로 사용
    const thumb = post.image_url || post.image;
    if (thumb && !isVideoUrl(thumb) && thumb !== '/placeholder.svg') {
      return getOptimizedFeedImage(thumb, post.id);
    }
    return getFallbackImage(String(post.id));
  }, [mediaList, post.id, post.image_url, post.image]);

  // active 슬라이드 + 현재 미디어가 영상일 때만 재생, 음소거 상태 적용
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && activeIsVideo) {
      v.muted = muted;
      const tryPlay = async () => {
        try {
          await v.play();
          setIsPlaying(true);
        } catch {
          try {
            v.muted = true;
            await v.play();
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
          }
        }
      };
      tryPlay();
    } else {
      v.pause();
      v.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isActive, muted, activeIsVideo, activeMediaUrl]);

  // 영상 시간/길이 + 첫 프레임 준비 상태 추적
  useEffect(() => {
    // 새 영상으로 바뀌면 ready 상태 리셋
    setVideoFirstFrameReady(false);

    const v = videoRef.current;
    if (!v) return;
    const handleTimeUpdate = () => {
      if (!isScrubbing) setCurrentTime(v.currentTime || 0);
    };
    const handleLoadedMeta = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    const handleDurationChange = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    const handlePlaying = () => {
      setVideoFirstFrameReady(true);
      setIsPlaying(true);
    };
    const handlePauseEvt = () => setIsPlaying(false);
    const handleLoadedData = () => {
      // 일부 디바이스에서 'playing'이 늦게 오므로 첫 프레임 디코드 신호로도 ready 처리
      if (v.readyState >= 2) setVideoFirstFrameReady(true);
    };
    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("loadedmetadata", handleLoadedMeta);
    v.addEventListener("durationchange", handleDurationChange);
    v.addEventListener("playing", handlePlaying);
    v.addEventListener("pause", handlePauseEvt);
    v.addEventListener("loadeddata", handleLoadedData);
    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("loadedmetadata", handleLoadedMeta);
      v.removeEventListener("durationchange", handleDurationChange);
      v.removeEventListener("playing", handlePlaying);
      v.removeEventListener("pause", handlePauseEvt);
      v.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [activeMediaUrl, isScrubbing]);

  // 댓글 수 fetch (활성화 시 1회)
  useEffect(() => {
    if (!isActive) return;
    if (!isPersistedPostId(post.id)) return;
    let cancelled = false;
    fetchCommentsByPostId(post.id)
      .then((cs) => {
        if (!cancelled) setCommentsCount(cs.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isActive, post.id]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // 미디어 영역 탭 → 영상일 때만 재생/일시정지 토글 (드래그가 아닌 단순 탭일 때만)
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handlePointerDown = (e: React.PointerEvent) => {
    tapStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    const dt = Date.now() - start.t;
    if (dx < 8 && dy < 8 && dt < 300) {
      if (hasVideo) togglePlay();
    }
  };

  return (
    <div
      className="relative h-full w-full bg-black overflow-hidden"
      style={{ height: embedded ? "100%" : "100dvh" }}
    >
      {/* 배경 블러 (시각적 여유) */}
      {fallbackImage && (
        <img
          src={fallbackImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 pointer-events-none"
        />
      )}

      {/* 메인 미디어 — 화면 가로 너비에 딱 맞는 3:4 비율 컨테이너 */}
      {/* 하단을 충분히 띄워 닉네임/위치/본문/액션 알약 영역이 영상과 겹치지 않도록 함.
          embedded 모드에서는 페이지 자체가 헤더/BottomNav 사이로 한정되어 있어
          safe-area 추가 패딩이 필요 없으나, 액션 영역의 실측 높이만큼은 여유가 필요. */}
      <div
        className="absolute left-0 right-0 top-0 flex items-end justify-center"
        style={{
          bottom: embedded
            ? "160px"
            : "calc(env(safe-area-inset-bottom, 0px) + 160px)",
          cursor: "pointer",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div
          className="relative w-full overflow-hidden bg-black"
          style={{ aspectRatio: "3 / 4", maxHeight: "100%" }}
        >
          {/* 영상 내부 좌상단 음소거 토글 (embedded 모드 전용)
              순위 뱃지가 있을 때는 음소거 버튼을 뱃지 옆으로 옮긴다. */}
          {showInlineMuteButton && hasVideo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute?.();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              aria-label={muted ? "음소거 해제" : "음소거"}
              className={cn(
                "absolute top-3 z-40 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform border border-white/10",
                inlineRank ? "left-[68px]" : "left-3"
              )}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* 영상/이미지 좌상단 순위 뱃지 (embedded ranked 모드 전용) */}
          {inlineRank && (
            <motion.div
              key={`inline-rank-${inlineRank}`}
              initial={{ opacity: 0, scale: 0.85, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className={cn(
                "absolute top-3 left-3 z-40 pointer-events-auto inline-flex items-center gap-1 h-9 px-3 rounded-full bg-gradient-to-br shadow-lg backdrop-blur-md border border-white/20",
                inlineRank === 1
                  ? "from-amber-400 to-amber-500 shadow-amber-500/40"
                  : inlineRank === 2
                  ? "from-slate-300 to-slate-400 shadow-slate-400/40"
                  : inlineRank === 3
                  ? "from-orange-400 to-orange-500 shadow-orange-500/40"
                  : "from-gray-300 to-gray-300 shadow-gray-400/40"
              )}
              aria-label={`${inlineRank}위`}
            >
              <span
                className={cn(
                  "text-[14px] font-black tabular-nums leading-none tracking-tight",
                  inlineRank <= 3 ? "text-white" : "text-gray-900"
                )}
              >
                {inlineRank}
              </span>
              <span
                className={cn(
                  "text-[10px] font-black leading-none tracking-tight",
                  inlineRank <= 3 ? "text-white" : "text-gray-900"
                )}
              >
                위
              </span>
            </motion.div>
          )}

          {/* 영상/이미지 우상단 닫기(X) 버튼 (embedded 트렌딩 뷰어 전용) */}
          {showInlineCloseButton && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              aria-label="닫기"
              className="absolute top-3 right-3 z-40 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform border border-white/10"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}

          {/* 가로 슬라이더 — 다중 미디어면 좌우 스와이프로 이동, 단일이면 그냥 표시 */}
          <MediaCarousel
            mediaList={mediaList}
            currentIndex={mediaIndex}
            onIndexChange={setMediaIndex}
            videoRef={videoRef}
            muted={muted}
            poster={fallbackImage}
          />

          {/* 미디어 인디케이터 도트 (다중일 때만) — 이미지 아래쪽 (타임라인 위) */}
          <ImageSliderDots
            count={mediaList.length}
            currentIndex={mediaIndex}
            activeWidthClass="w-4"
            inactiveColorClass="bg-white/50"
            bottomClass={hasVideo ? "bottom-6" : "bottom-4"}
            zIndexClass="z-30"
          />

          {/* 영상 타임라인 (현재 미디어가 영상일 때만) */}
          {hasVideo && (
            <VideoTimeline
              currentTime={isScrubbing ? scrubTime : currentTime}
              duration={duration}
              isScrubbing={isScrubbing}
              compact={embedded}
              onScrubStart={() => {
                const v = videoRef.current;
                if (!v) return;
                wasPlayingBeforeScrubRef.current = !v.paused;
                v.pause();
                setIsScrubbing(true);
                setScrubTime(v.currentTime || 0);
              }}
              onScrub={(t) => {
                setScrubTime(t);
                const v = videoRef.current;
                if (v) v.currentTime = t;
              }}
              onScrubEnd={(t) => {
                const v = videoRef.current;
                if (v) {
                  v.currentTime = t;
                  setCurrentTime(t);
                }
                setIsScrubbing(false);
                if (wasPlayingBeforeScrubRef.current && v) {
                  v.play().then(() => setIsPlaying(true)).catch(() => {});
                }
              }}
            />
          )}
        </div>
      </div>

      {/* 재생 오버레이 아이콘 (비디오 일시정지 상태일 때만)
          - 첫 프레임이 그려진 후(videoFirstFrameReady)에만 노출해서
            로딩 중에 회색 재생 버튼이 깜빡 떠서 버그처럼 보이는 문제를 방지 */}
      {hasVideo && !isPlaying && videoFirstFrameReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* 하단 그라데이션 + 정보 + 액션 알약 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div
          className="bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pt-16"
          style={{ paddingBottom: embedded ? "14px" : "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
        >
          {/* 유저 + 위치 + 본문 */}
          <div className="text-white pointer-events-auto mb-3">
            <button
              onClick={onUserClick}
              className="group flex items-center gap-2 mb-2 active:opacity-70 transition-opacity"
            >
              <PostUserAvatar
                name={post.user.name}
                avatar={post.user.avatar}
                postId={post.id}
                userId={post.user.id}
                size="sm"
                activePress
              />
              <span className="text-sm font-black drop-shadow-md">{post.user.name}</span>
            </button>

            {(post.lat != null && post.lng != null) && (
              <button
                onClick={onLocationClick}
                className="flex items-center gap-1 mb-2 text-white/90 active:opacity-70 transition-opacity"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold drop-shadow-md truncate max-w-[80vw]">
                  {post.location || "위치 보기"}
                </span>
              </button>
            )}

            {post.content && (
              <ReelContentText
                content={post.content}
                expanded={contentExpanded}
                onToggle={() => setContentExpanded((v) => !v)}
              />
            )}
          </div>

          {/* 알약 액션 버튼 (PostActions와 동일한 스타일, 다크 배경용으로 조정) */}
          <div className="flex items-center justify-between gap-2 pointer-events-auto">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={onLikeToggle}
                aria-label={`좋아요 ${likesCount.toLocaleString()}개`}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-black transition-all active:scale-95 backdrop-blur-md",
                  liked
                    ? "border-red-300/50 bg-red-500/20 text-white shadow-sm"
                    : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                )}
              >
                <Heart className={cn("h-[18px] w-[18px] transition-colors", liked ? "fill-red-500 text-red-500" : "text-white")} />
                <span className="tabular-nums leading-none">{likesCount.toLocaleString()}</span>
              </button>

              <button
                type="button"
                onClick={onCommentClick}
                aria-label={`댓글 ${commentsCount.toLocaleString()}개`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-sm font-black text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
              >
                <MessageCircle className="h-[18px] w-[18px] text-white" />
                <span className="tabular-nums leading-none">{commentsCount.toLocaleString()}</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleShare(e, post.id)}
                aria-label="공유하기"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
              >
                <Share2 className="h-[18px] w-[18px] text-white" />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onSaveToggle}
                aria-label="저장하기"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
              >
                <Bookmark className={cn("h-[18px] w-[18px] transition-colors", saved ? "fill-amber-400 text-amber-400" : "text-white")} />
              </button>

              {(post.lat != null && post.lng != null) && (
                <button
                  type="button"
                  onClick={onLocationClick}
                  aria-label="위치보기"
                  className="inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-full active:scale-95 transition-all shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', isolation: 'isolate' }}
                >
                  <Navigation className="w-3.5 h-3.5" style={{ fill: '#4f46e5', color: '#4f46e5', flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#4f46e5', lineHeight: 1 }}>위치보기</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Reels 영상 요소 ──────────────────────────────────────
// 안드로이드 Chrome/WebView에서 <video>가 첫 프레임을 그리기 전
// 잠깐 회색 placeholder가 깜빡이는 문제를 방지하기 위해
// `playing` 이벤트가 발생할 때까지 video를 opacity 0으로 숨겨둔다.
interface ReelsVideoProps {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  muted: boolean;
  preload: "none" | "metadata" | "auto";
  poster?: string;
  isCurrent: boolean;
}

const ReelsVideo: React.FC<ReelsVideoProps> = ({
  src,
  videoRef,
  muted,
  preload,
  poster,
  isCurrent,
}) => {
  const localRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  // isCurrent && 아직 첫 프레임 렌더 전이면 로딩 스피너를 보여줌 (200ms 그레이스)
  const [showSpinner, setShowSpinner] = useState(false);

  const setRefs = useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      if (videoRef) {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      }
    },
    [videoRef]
  );

  useEffect(() => {
    setIsReady(false);
  }, [src]);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const handlePlaying = () => setIsReady(true);
    const handleCanPlay = () => {
      // 자동 재생 보강: 부모 effect가 일찍 시도해서 실패한 경우라도 ready되면 다시 시도
      if (isCurrent && el.paused) {
        el.play().catch(() => {
          // 사운드 정책 등으로 실패하면 muted로 재시도
          el.muted = true;
          el.play().catch(() => {});
        });
      }
    };
    el.addEventListener("playing", handlePlaying);
    el.addEventListener("canplay", handleCanPlay);
    el.addEventListener("loadeddata", handleCanPlay);
    return () => {
      el.removeEventListener("playing", handlePlaying);
      el.removeEventListener("canplay", handleCanPlay);
      el.removeEventListener("loadeddata", handleCanPlay);
    };
  }, [src, isCurrent]);

  // 첫 프레임이 200ms 안에 안 뜨면 로딩 스피너 노출 (깜빡임 방지)
  useEffect(() => {
    if (!isCurrent) {
      setShowSpinner(false);
      return;
    }
    if (isReady) {
      setShowSpinner(false);
      return;
    }
    const t = window.setTimeout(() => setShowSpinner(true), 200);
    return () => window.clearTimeout(t);
  }, [isCurrent, isReady, src]);

  return (
    <>
      <video
        ref={setRefs}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        loop
        muted={muted}
        preload={preload}
        poster={poster}
        style={{
          opacity: isCurrent && !isReady ? 0 : 1,
          transition: "opacity 150ms ease-out",
        }}
      />
      {/* 영상이 활성 슬라이드인데 첫 프레임이 아직 안 그려졌다면 로딩 스피너 표시 */}
      {isCurrent && !isReady && showSpinner && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none bg-black/20">
          <div className="w-12 h-12 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
        </div>
      )}
    </>
  );
};

// ─── 다중 미디어 가로 슬라이더 (이미지/영상 혼합 지원) ───
interface MediaCarouselProps {
  mediaList: string[];
  currentIndex: number;
  onIndexChange: (idx: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  muted: boolean;
  poster?: string;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({
  mediaList,
  currentIndex,
  onIndexChange,
  videoRef,
  muted,
  poster,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentIndexRef = useRef(currentIndex);
  const mediaCountRef = useRef(mediaList.length);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    mediaCountRef.current = mediaList.length;
  }, [mediaList.length]);

  // 제스처 상태
  const gestureRef = useRef<{
    active: boolean;
    locked: "horizontal" | "vertical" | null;
    startX: number;
    startY: number;
    lastX: number;
    startTime: number;
    pointerId: number | null;
    startIndex: number;
  }>({
    active: false,
    locked: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    startTime: 0,
    pointerId: null,
    startIndex: 0,
  });

  // 다중 미디어가 아닐 땐 제스처 비활성 → 부모 세로 스와이프가 자연스럽게 동작
  const enabled = mediaList.length > 1;

  // native touch 리스너로 부모 ReelsSlideTrack의 세로 스와이프와 충돌 처리
  useEffect(() => {
    if (!enabled) return;
    const el = rootRef.current;
    if (!el) return;

    const HORIZONTAL_THRESHOLD = 8; // 처음 8px 이내에 방향 결정
    const VERTICAL_THRESHOLD = 8;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      gestureRef.current = {
        active: true,
        locked: null,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        startTime: Date.now(),
        pointerId: null,
        startIndex: currentIndexRef.current,
      };
      setIsAnimating(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      g.lastX = t.clientX;

      // 첫 임계값 통과 시 방향 결정
      if (!g.locked) {
        if (Math.abs(dx) > HORIZONTAL_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          g.locked = "horizontal";
        } else if (Math.abs(dy) > VERTICAL_THRESHOLD && Math.abs(dy) >= Math.abs(dx)) {
          g.locked = "vertical";
        }
      }

      if (g.locked === "horizontal") {
        // 가로 스와이프: 우리가 처리, 부모 세로 스와이프 차단
        e.stopPropagation();
        e.preventDefault();

        // 끝에서 더 못 가도록 저항 적용
        const atStart = g.startIndex === 0 && dx > 0;
        const atEnd = g.startIndex === mediaCountRef.current - 1 && dx < 0;
        let visualDx = dx;
        if (atStart || atEnd) visualDx = dx * 0.25;
        setDragX(visualDx);
      }
      // 세로면 아무것도 안 하고 부모가 처리하도록 둠
    };

    const settle = () => {
      const g = gestureRef.current;
      if (!g.active) return;
      const wasHorizontal = g.locked === "horizontal";
      const dx = g.lastX - g.startX;
      const dt = Date.now() - g.startTime;
      g.active = false;
      g.locked = null;

      if (!wasHorizontal) {
        // 가로 제스처가 아니었으면 위치 복원만 (보통은 dragX가 0임)
        setDragX(0);
        return;
      }

      const width = rootRef.current?.clientWidth || 1;
      const velocity = Math.abs(dx) / Math.max(dt, 1);
      const distanceThreshold = width * 0.2;
      const isFlick = velocity > 0.3 && Math.abs(dx) > 30;

      let nextIndex = g.startIndex;
      if (dx < -distanceThreshold || (isFlick && dx < 0)) {
        nextIndex = g.startIndex + 1;
      } else if (dx > distanceThreshold || (isFlick && dx > 0)) {
        nextIndex = g.startIndex - 1;
      }
      const clamped = Math.max(0, Math.min(mediaCountRef.current - 1, nextIndex));

      setIsAnimating(true);
      setDragX(0);
      if (clamped !== currentIndexRef.current) {
        onIndexChange(clamped);
      }
      window.setTimeout(() => setIsAnimating(false), 240);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (gestureRef.current.locked === "horizontal") {
        e.stopPropagation();
      }
      settle();
    };
    const onTouchCancel = () => settle();

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, onIndexChange]);

  // 마우스 드래그 (데스크탑용)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return;
    e.stopPropagation();
    gestureRef.current = {
      active: true,
      locked: "horizontal",
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      startTime: Date.now(),
      pointerId: null,
      startIndex: currentIndexRef.current,
    };
    setIsAnimating(false);

    const onMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const dx = ev.clientX - g.startX;
      g.lastX = ev.clientX;
      const atStart = g.startIndex === 0 && dx > 0;
      const atEnd = g.startIndex === mediaCountRef.current - 1 && dx < 0;
      let visualDx = dx;
      if (atStart || atEnd) visualDx = dx * 0.25;
      setDragX(visualDx);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const g = gestureRef.current;
      if (!g.active) return;
      const dx = g.lastX - g.startX;
      const dt = Date.now() - g.startTime;
      g.active = false;
      g.locked = null;
      const width = rootRef.current?.clientWidth || 1;
      const velocity = Math.abs(dx) / Math.max(dt, 1);
      const distanceThreshold = width * 0.2;
      const isFlick = velocity > 0.3 && Math.abs(dx) > 30;
      let nextIndex = g.startIndex;
      if (dx < -distanceThreshold || (isFlick && dx < 0)) {
        nextIndex = g.startIndex + 1;
      } else if (dx > distanceThreshold || (isFlick && dx > 0)) {
        nextIndex = g.startIndex - 1;
      }
      const clamped = Math.max(0, Math.min(mediaCountRef.current - 1, nextIndex));
      setIsAnimating(true);
      setDragX(0);
      if (clamped !== currentIndexRef.current) onIndexChange(clamped);
      window.setTimeout(() => setIsAnimating(false), 240);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden"
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute inset-0 flex"
        style={{
          width: `${mediaList.length * 100}%`,
          transform: `translate3d(calc(${-currentIndex * (100 / mediaList.length)}% + ${dragX}px), 0, 0)`,
          transition: isAnimating ? "transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
        }}
      >
        {mediaList.map((url, i) => {
          const isVid = isVideoUrl(url);
          const isCurrent = i === currentIndex;
          return (
            <div
              key={`${url}-${i}`}
              className="relative h-full shrink-0"
              style={{ width: `${100 / mediaList.length}%` }}
            >
              {isVid ? (
                <ReelsVideo
                  videoRef={isCurrent ? videoRef : undefined}
                  src={url}
                  muted={isCurrent ? muted : true}
                  preload={isCurrent ? "metadata" : "none"}
                  poster={poster}
                  isCurrent={isCurrent}
                />
              ) : (
                <img
                  src={getOptimizedFeedImage(url, url)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── 영상 타임라인 (드래그 스크럽 지원) ────────────────────
interface VideoTimelineProps {
  currentTime: number;
  duration: number;
  isScrubbing: boolean;
  onScrubStart: () => void;
  onScrub: (t: number) => void;
  onScrubEnd: (t: number) => void;
  // compact: 영상 가로 길이의 우측 절반에만 타임라인 표시 (닉네임/콘텐츠 오버레이와 겹치지 않도록)
  compact?: boolean;
}

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const VideoTimeline: React.FC<VideoTimelineProps> = ({
  currentTime,
  duration,
  isScrubbing,
  onScrubStart,
  onScrub,
  onScrubEnd,
  compact = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const latestTimeRef = useRef(currentTime);

  // 부모(ReelsSlideTrack)의 native touch 리스너가 슬라이드 스와이프로 인식하지 않도록 차단
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      e.stopPropagation();
    };
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("touchend", stop, { passive: true });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("touchend", stop);
    };
  }, []);

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  const computeTimeFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    onScrubStart();
    const t = computeTimeFromClientX(e.clientX);
    latestTimeRef.current = t;
    onScrub(t);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const t = computeTimeFromClientX(e.clientX);
    latestTimeRef.current = t;
    onScrub(t);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    onScrubEnd(latestTimeRef.current);
  };

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 select-none"
      )}
      // 부모(미디어 영역)의 탭/스와이프 핸들러가 타임라인 조작을 가로채지 않도록 차단
      onClick={(e) => e.stopPropagation()}
      style={{ touchAction: "none" }}
    >
      {/* 드래그 영역 (히트박스 크게, 시각 트랙은 얇게) */}
      <div
        ref={trackRef}
        className="relative w-full px-3 py-2 cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {/* 시간 표시 (스크럽 중에만) */}
        {isScrubbing && duration > 0 && (
          <div className="absolute -top-7 left-0 right-0 flex justify-center pointer-events-none">
            <span className="px-2 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-black tabular-nums backdrop-blur-md">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}

        {/* 트랙 (배경) */}
        <div
          className={cn(
            "relative w-full rounded-full bg-white/25 overflow-hidden transition-[height] duration-150",
            isScrubbing ? "h-1.5" : "h-1"
          )}
        >
          {/* 진행 바 */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
            style={{
              width: `${progress * 100}%`,
              transition: isScrubbing ? "none" : "width 120ms linear",
            }}
          />
        </div>

        {/* 핸들 (스크럽 중에만 크게 표시) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none transition-all",
            isScrubbing ? "w-3.5 h-3.5 opacity-100" : "w-0 h-0 opacity-0"
          )}
          style={{
            left: `calc(12px + (100% - 24px) * ${progress})`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
};

// ─── 끝 슬라이드 (더 이상 영상이 없을 때) ────────────────────
interface ReelsEndSlideProps {
  message: string;
  subMessage?: string;
  onClose: () => void;
  embedded?: boolean;
  showCloseButton?: boolean;
}

const ReelsEndSlide: React.FC<ReelsEndSlideProps> = ({
  message,
  subMessage,
  onClose,
  embedded = false,
  showCloseButton = true,
}) => {
  return (
    <div
      className="relative h-full w-full bg-black overflow-hidden flex flex-col items-center justify-center px-10 text-center"
      style={{ height: embedded ? "100%" : "100dvh" }}
    >
      <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center mb-6 shadow-lg">
        <Clapperboard className="w-9 h-9 text-white/80" />
      </div>
      <p className="text-white text-base font-black tracking-tight leading-snug">{message}</p>
      {subMessage && (
        <p className="mt-2 text-white/60 text-xs font-bold leading-relaxed tracking-tight">
          {subMessage}
        </p>
      )}
      {showCloseButton && (
        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex h-10 items-center justify-center px-5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white text-sm font-black active:scale-95 transition-transform"
        >
          닫기
        </button>
      )}
    </div>
  );
};

export default ReelsViewer;
