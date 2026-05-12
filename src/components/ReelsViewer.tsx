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
  Volume2,
  VolumeX,
  Play,
  ChevronUp,
} from "lucide-react";
import { Post } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toggleLikeInDb } from "@/utils/like-utils";
import { cn, getOptimizedFeedImage, getFallbackImage } from "@/lib/utils";
import { handleShare } from "@/utils/share";
import PostCommentsDialog from "@/components/PostCommentsDialog";
import PostUserAvatar from "@/components/PostUserAvatar";
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

// 슬라이드 아이템 타입 (포스트 또는 광고)
type ReelItem =
  | { kind: "post"; post: Post; key: string }
  | { kind: "ad"; key: string };

interface ReelsViewerProps {
  isOpen: boolean;
  initialPost: Post | null;
  pool: Post[]; // 알고리즘에서 사용할 인기 포스트 풀
  onClose: () => void;
}

const ReelsViewer: React.FC<ReelsViewerProps> = ({ isOpen, initialPost, pool, onClose }) => {
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
  const [uiVisible, setUiVisible] = useState(true);

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
  useEffect(() => {
    if (!isOpen || !initialPost) return;

    seenIdsRef.current = new Set([initialPost.id]);
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

    // 3개마다 광고 삽입
    const withAds: ReelItem[] = [];
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
  }, [isOpen, initialPost?.id]);

  // 풀에서 더 가져오기 (큐가 부족하면 알고리즘으로 재셔플)
  const appendMore = useCallback(() => {
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
  }, [pool]);

  // 활성 인덱스 추적 + 강제 스냅 (한 번에 1개씩만 이동)
  // CSS 스크롤은 비활성화하고 transform으로만 슬라이드 전환
  // 활성 인덱스 변경 시 자동으로 transform이 적용되므로 별도 스크롤 핸들러 불필요
  useEffect(() => {
    if (!isOpen) return;
    setShowHint(false);
    setUiVisible(true); // 새 슬라이드로 이동하면 UI 다시 표시
  }, [activeIndex, isOpen]);

  // 끝에 가까워지면 추가 로드
  useEffect(() => {
    if (!isOpen) return;
    if (items.length === 0) return;
    if (activeIndex >= items.length - 3) {
      appendMore();
    }
  }, [activeIndex, items.length, isOpen, appendMore]);

  // 모달 열림 시 body 스크롤 잠금 + 전역 플래그/이벤트
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (window as any).__isReelsViewerOpen = true;
    window.dispatchEvent(new CustomEvent("open-reels-viewer"));
    return () => {
      document.body.style.overflow = prev;
      (window as any).__isReelsViewerOpen = false;
      window.dispatchEvent(new CustomEvent("close-reels-viewer"));
    };
  }, [isOpen]);

  // ESC + 안드로이드 백버튼 닫기
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

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
        {/* 음소거 토글 (좌측, 비디오일 때만) + 닫기 버튼 (우측) */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pointer-events-none transition-opacity duration-200",
            uiVisible ? "opacity-100" : "opacity-0"
          )}
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          {activeIsVideo ? (
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
          ) : (
            <div className="w-10 h-10" aria-hidden="true" />
          )}

          <button
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

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
        >
          {items.map((item, index) => (
            <div
              key={item.key}
              data-reel-index={index}
              className="absolute left-0 right-0 w-full"
              style={{
                height: "100dvh",
                top: `${index * 100}dvh`,
              }}
            >
              {item.kind === "post" ? (
                <ReelSlide
                  post={item.post}
                  isActive={index === activeIndex}
                  muted={muted}
                  liked={likeMap[item.post.id]?.liked ?? !!item.post.isLiked}
                  likesCount={likeMap[item.post.id]?.count ?? item.post.likes ?? 0}
                  saved={savedMap[item.post.id] ?? !!item.post.isSaved}
                  uiVisible={uiVisible}
                  onToggleUi={() => setUiVisible((v) => !v)}
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
                />
              ) : (
                <AdMobInterstitialPlaceholder isActive={index === activeIndex} />
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
}

const ReelsSlideTrack: React.FC<ReelsSlideTrackProps> = ({
  containerRef,
  activeIndex,
  itemCount,
  onActiveIndexChange,
  children,
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
          transform: `translate3d(0, calc(${-activeIndex * 100}dvh + ${dragOffset}px), 0)`,
          transition: isTransitioning ? "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
        }}
      >
        {children}
      </div>
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
  uiVisible: boolean;
  onToggleUi: () => void;
  onLikeToggle: () => void;
  onSaveToggle: () => void;
  onCommentClick: () => void;
  onLocationClick: () => void;
  onUserClick: () => void;
}

const ReelSlide: React.FC<ReelSlideProps> = ({
  post,
  isActive,
  muted,
  liked,
  likesCount,
  saved,
  uiVisible,
  onToggleUi,
  onLikeToggle,
  onSaveToggle,
  onCommentClick,
  onLocationClick,
  onUserClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(post.commentsCount || 0);

  const videoUrl = post.videoUrl;
  const imageUrl = post.image_url || post.image;
  const hasVideo = !!videoUrl || isVideoUrl(imageUrl);
  const effectiveVideoUrl = videoUrl || (isVideoUrl(imageUrl) ? imageUrl : null);

  const fallbackImage = useMemo(() => {
    if (!imageUrl || isVideoUrl(imageUrl)) return getFallbackImage(String(post.id));
    return getOptimizedFeedImage(imageUrl, post.id);
  }, [imageUrl, post.id]);

  // active 슬라이드만 재생 + 음소거 상태 적용
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.muted = muted;
      // 자동재생 시도: 사운드 ON일 때 실패하면 일단 muted로 강제 재생
      const tryPlay = async () => {
        try {
          await v.play();
          setIsPlaying(true);
        } catch {
          // 자동재생 차단 → muted로 강제 재생 (소리는 사용자가 토글하면 들림)
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
    }
  }, [isActive, muted]);

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

  // 미디어 영역 탭 → UI 토글 (드래그가 아닌 단순 탭일 때만)
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
      onToggleUi();
    }
  };

  return (
    <div className="relative h-full w-full bg-black overflow-hidden" style={{ height: "100dvh" }}>
      {/* 배경 블러 (시각적 여유) */}
      {fallbackImage && (
        <img
          src={fallbackImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 pointer-events-none"
        />
      )}

      {/* 메인 미디어 — 화면 가로 너비에 딱 맞게 + 화면 정중앙 배치 */}
      {/* 탭하면 UI 토글 */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ cursor: "pointer" }}
      >
        {hasVideo && effectiveVideoUrl ? (
          <video
            ref={videoRef}
            src={effectiveVideoUrl}
            className="w-full h-auto max-h-full object-contain"
            playsInline
            loop
            muted={muted}
            preload="metadata"
            poster={!isVideoUrl(imageUrl) ? imageUrl : undefined}
          />
        ) : (
          <img
            src={fallbackImage}
            alt=""
            className="w-full h-auto max-h-full object-contain"
            draggable={false}
          />
        )}
      </div>

      {/* 재생 오버레이 아이콘 (비디오 일시정지 상태일 때만) */}
      {hasVideo && !isPlaying && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* 하단 그라데이션 + 정보 + 액션 알약 (UI 토글 시 페이드) */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-200",
          uiVisible ? "opacity-100 pointer-events-none" : "opacity-0 pointer-events-none"
        )}
      >
        <div
          className="bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pt-16"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
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
              <div
                onClick={() => setContentExpanded((v) => !v)}
                className="text-sm leading-snug font-medium drop-shadow-md cursor-pointer pr-2"
              >
                <p className={cn(contentExpanded ? "" : "line-clamp-2")}>{post.content}</p>
                {!contentExpanded && post.content.length > 60 && (
                  <span className="text-xs text-white/60 font-bold mt-1 inline-block">더 보기</span>
                )}
              </div>
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

            <button
              type="button"
              onClick={onSaveToggle}
              aria-label="저장하기"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
            >
              <Bookmark className={cn("h-[18px] w-[18px] transition-colors", saved ? "fill-amber-400 text-amber-400" : "text-white")} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReelsViewer;
