"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
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
  Clapperboard,
  Check,
  Loader2,
} from "lucide-react";
import { Post } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toggleLikeInDb } from "@/utils/like-utils";
import { cn, getOptimizedFeedImage, getFallbackImage, formatCount } from "@/lib/utils";
import { handleShare } from "@/utils/share";
import PostCommentsDialog from "@/components/PostCommentsDialog";
import PostUserAvatar from "@/components/PostUserAvatar";
import LocationButtonWithTimer from "@/components/LocationButtonWithTimer";
import HashtagText from "@/components/HashtagText";
import ImageSliderDots from "@/components/ImageSliderDots";
import AdMobInterstitialPlaceholder from "@/components/AdMobInterstitialPlaceholder";
import ReelsPostMenuDropdown from "@/components/ReelsPostMenuDropdown";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Textarea } from "@/components/ui/textarea";
import { fetchCommentsByPostId, isPersistedPostId } from "@/utils/comments";
import { useVideoMuted } from "@/hooks/use-video-muted";
import { useViewedPosts } from "@/hooks/use-viewed-posts";
import { showSuccess, showError } from "@/utils/toast";

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

// 초 → "M:SS" 포맷터 (영상 타임라인/시간 표시 공통 사용)
const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  // 내 포스팅 삭제 후 호출 (부모가 리스트에서 제거하도록)
  onDelete?: (postId: string) => void;
  // 내 포스팅 본문 수정 후 호출 (부모가 캐시된 content를 갱신하도록)
  onUpdate?: (postId: string, content: string) => void;
  // 활성 슬라이드의 포스트가 바뀔 때마다 부모에게 알림 (페이지 재진입 시 위치 복원용)
  onActivePostChange?: (postId: string) => void;
  // 활성 영상의 재생 시간을 주기적으로 부모에게 알림 (재진입 시 같은 위치에서 재생용)
  onActiveVideoTimeChange?: (time: number) => void;
  // 활성 영상의 시작 재생 위치 (페이지 재진입 시 복원). 활성 슬라이드가 영상일 때 1회 적용.
  initialVideoTime?: number;
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
  onDelete,
  onUpdate,
  onActivePostChange,
  onActiveVideoTimeChange,
  initialVideoTime,
}) => {
  const isRankedMode = mode === "ranked";
  // 풀이 모두 소진되었는지 (noRepeat 모드 전용)
  const exhaustedRef = useRef(false);
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // 활성 슬라이드가 바뀔 때마다 조회수를 기록한다.
  // markAsViewed 자체가 세션 dedupe + 서버측 시간 단위 dedupe를 하므로
  // 빠르게 위아래로 스와이프해도 동일 포스트는 1회만 카운트된다.
  const { markAsViewed } = useViewedPosts();

  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ReelItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // 음소거 상태는 앱 전역에서 공유 (localStorage 영구 저장)
  const [muted, setMuted] = useVideoMuted();
  const [showHint, setShowHint] = useState(true);

  // 댓글 다이얼로그 상태
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  // 포스트별 좋아요/저장 로컬 상태
  const [likeMap, setLikeMap] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  // 댓글 다이얼로그에서 변경된 결과를 슬라이드에 전파하기 위한 오버라이드 맵.
  // (각 ReelSlide는 활성화 시 자체적으로 fetch 하지만, 다이얼로그에서 추가/삭제 직후에는
  //  같은 슬라이드의 effect가 재실행되지 않으므로 명시적으로 오버라이드를 내려줘야 한다.)
  const [commentMetaMap, setCommentMetaMap] = useState<
    Record<string, { count: number; hasMine: boolean }>
  >({});
  // 내 포스팅 수정 후 즉시 슬라이드에 반영하기 위한 로컬 content 덮어쓰기 맵
  const [contentMap, setContentMap] = useState<Record<string, string>>({});

  // 삭제 확인 다이얼로그 상태 (수정은 각 ReelSlide 내부에서 인라인으로 처리)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

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

  // 활성 슬라이드가 포스트일 때마다 조회수 기록.
  // - 광고/끝 슬라이드는 건너뜀
  // - 동일 포스트는 markAsViewed 내부에서 세션 단위 dedupe되므로 안전
  useEffect(() => {
    if (!isOpen) return;
    const current = items[activeIndex];
    if (!current || current.kind !== "post") return;
    markAsViewed(current.post.id);
  }, [isOpen, activeIndex, items, markAsViewed]);

  // 활성 포스트가 바뀌면 부모에게 알림 (페이지 재진입 시 복원용)
  useEffect(() => {
    if (!isOpen) return;
    if (!onActivePostChange) return;
    const current = items[activeIndex];
    if (!current || current.kind !== "post") return;
    onActivePostChange(current.post.id);
  }, [isOpen, activeIndex, items, onActivePostChange]);

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

  // ── 스와이프 방향에 따른 버튼 슬라이드 인/아웃 효과 ─────────────
  // 위로 스와이프(=activeIndex 증가) → direction = 1
  //   : 이전 버튼은 위로 사라지고(상단 헤더 뒤로 밀려나는 느낌), 새 버튼이 아래에서 올라옴
  // 아래로 스와이프(=activeIndex 감소) → direction = -1
  //   : 이전 버튼은 아래로 사라지고, 새 버튼이 위(헤더 뒤)에서 내려오며 등장
  //
  // 방향 결정은 setActiveIndex 호출 시점에 동기적으로 함께 갱신한다.
  // (useEffect 기반 비교는 빠른 연속 스와이프 시 batching/순서 꼬임으로
  //  방향이 가끔 반대로 잡히는 버그가 있었음 → 그 자리에서 즉시 set)
  const [swipeDir, setSwipeDir] = useState<1 | -1>(1);
  const setActiveIndexWithDir = useCallback((next: number | ((prev: number) => number)) => {
    setActiveIndex((prev) => {
      const resolved = typeof next === "function" ? (next as (p: number) => number)(prev) : next;
      if (resolved > prev) setSwipeDir(1);
      else if (resolved < prev) setSwipeDir(-1);
      return resolved;
    });
  }, []);

  // ── 내 포스팅 수정/삭제 핸들러 ───────────────────────────────
  const isPostMine = useCallback(
    (post: Post): boolean => {
      if (!authUser?.id) return false;
      const ownerId = post.owner_id || post.user_id || post.user?.id;
      return ownerId === authUser.id;
    },
    [authUser?.id]
  );

  const handleEditSaved = useCallback(
    (postId: string, nextContent: string) => {
      setContentMap((prev) => ({ ...prev, [postId]: nextContent }));
      onUpdate?.(postId, nextContent);
    },
    [onUpdate]
  );

  const confirmDelete = useCallback(async () => {
    const postId = deletingPostId;
    if (!postId || !authUser?.id) {
      setDeletingPostId(null);
      return;
    }
    // 다이얼로그 먼저 닫기
    setDeletingPostId(null);

    // 슬라이드 목록에서 해당 포스트 제거 (다음 슬라이드로 자연스럽게 이동)
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.kind === "post" && it.post.id === postId);
      if (idx < 0) return prev;
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      // 만약 삭제된 인덱스가 마지막이었다면 activeIndex가 범위를 벗어날 수 있음 → clamp
      setActiveIndex((cur) => {
        if (next.length === 0) return 0;
        if (cur >= next.length) return next.length - 1;
        return cur;
      });
      return next;
    });

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", authUser.id);
      if (error) throw error;
      showSuccess("컨텐츠가 삭제되었습니다.");
      onDelete?.(postId);
    } catch (err) {
      console.error("[ReelsViewer] delete error:", err);
      showError("삭제 중 오류가 발생했습니다.");
    }
  }, [deletingPostId, authUser?.id, onDelete]);

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

      {/* embedded ranked 모드 전용 — 좌상단 순위 뱃지.
          X 버튼은 각 ReelSlide 안에 렌더링해 스와이프 전환에 슬라이드와 함께 움직인다.
          - 컨테이너(ReelsViewer 임베디드 루트)는 stacking context를 만들고 (Index 페이지 z=11000),
            그 위에 떠 있는 Header(z=12600)는 이 컨테이너 밖으로 빠져나간 자식을 자동으로 가려준다.
          - 따라서 클리핑 박스는 두지 않고, motion.div가 음수 y로 자유롭게 빠질 수 있게 한다. */}
      {embedded && isRankedMode && (
        <div className="absolute top-5 left-6 z-40 pointer-events-none">
          <AnimatePresence initial={false} mode="popLayout" custom={swipeDir}>
            <motion.div
              key={`rank-${activeIndex + 1}`}
              custom={swipeDir}
              variants={{
                enter: (dir: 1 | -1) => ({ y: dir === 1 ? 60 : -60, opacity: 0 }),
                center: { y: 0, opacity: 1 },
                exit: (dir: 1 | -1) => ({ y: dir === 1 ? -60 : 60, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
              className={cn(
                "pointer-events-auto inline-flex items-center gap-1 h-9 px-3 rounded-full bg-gradient-to-br shadow-lg backdrop-blur-md border border-white/20",
                activeIndex + 1 === 1
                  ? "from-amber-400 to-amber-500 shadow-amber-500/40"
                  : activeIndex + 1 === 2
                  ? "from-slate-300 to-slate-400 shadow-slate-400/40"
                  : activeIndex + 1 === 3
                  ? "from-orange-400 to-orange-500 shadow-orange-500/40"
                  : "from-gray-300 to-gray-300 shadow-gray-400/40"
              )}
              aria-label={`${activeIndex + 1}위`}
            >
              <span
                className={cn(
                  "text-[14px] font-black tabular-nums leading-none tracking-tight",
                  activeIndex + 1 <= 3 ? "text-white" : "text-gray-900"
                )}
              >
                {activeIndex + 1}
              </span>
              <span
                className={cn(
                  "text-[10px] font-black leading-none tracking-tight",
                  activeIndex + 1 <= 3 ? "text-white" : "text-gray-900"
                )}
              >
                위
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Transform 기반 슬라이더 — 한 번에 1개씩만 이동 (스와이프 강도와 무관) */}
      <ReelsSlideTrack
        containerRef={containerRef}
        activeIndex={activeIndex}
        itemCount={items.length}
        onActiveIndexChange={setActiveIndexWithDir}
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
                contentOverride={contentMap[item.post.id]}
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
                isMine={isPostMine(item.post)}
                authUserId={authUser?.id}
                onContentSaved={handleEditSaved}
                onRequestDelete={() => setDeletingPostId(item.post.id)}
                onActiveVideoTimeChange={
                  index === activeIndex ? onActiveVideoTimeChange : undefined
                }
                initialVideoTime={index === activeIndex ? initialVideoTime : undefined}
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
        onCommentsChange={(comments) => {
          if (!commentsPostId) return;
          const uid = authUser?.id;
          setCommentMetaMap((prev) => ({
            ...prev,
            [commentsPostId]: {
              count: comments.length,
              hasMine: !!uid && comments.some((c) => c.userId === uid),
            },
          }));
        }}
      />

      {/* 내 포스팅 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={!!deletingPostId}
        onClose={() => setDeletingPostId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );

  // embedded: 페이지 안에 인라인으로 렌더 (portal X)
  // 주의: overflow-hidden을 두지 않는다 → 상단의 알약/X 버튼이 위로 빠질 때
  //       (헤더 뒤로 사라지는 효과) 컨테이너 밖으로 자유롭게 이동할 수 있어야 함.
  //       슬라이드 미디어 자체의 클리핑은 ReelsSlideTrack 내부의 별도 컨테이너가 담당함.
  if (embedded) {
    return (
      <div className="relative w-full h-full bg-black">
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

// ─── 본문 텍스트 (1줄 truncate 고정) ────────────────────────
// 본문은 항상 한 줄로만 노출되며, 1줄을 초과하면 자동으로 "..." 처리된다.
// (펼치기/더 보기 기능 없음 — Flicks 페이지 정책)
interface ReelContentTextProps {
  content: string;
}

const ReelContentText: React.FC<ReelContentTextProps> = ({ content }) => {
  return (
    <div className="text-sm leading-snug font-medium drop-shadow-md pr-2">
      <span className="block truncate leading-snug">
        <HashtagText
          text={content}
          tagClassName="font-black text-indigo-300 hover:text-indigo-200 active:text-indigo-100"
        />
      </span>
    </div>
  );
};

// ─── 개별 슬라이드 (포스트) ────────────────────────────────
interface ReelSlideProps {
  post: Post;
  // 부모가 들고 있는 \"수정된 본문\"을 우선 표시할 때 사용. 없으면 post.content 사용.
  contentOverride?: string;
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
  // 내 포스팅 여부 — true일 때만 우상단 3-dot 메뉴(수정/삭제) 노출
  isMine?: boolean;
  // 본문 저장 시 사용할 인증 사용자 ID
  authUserId?: string;
  // 수정 저장 완료 시 부모에게 알림 (contentMap/외부 리스트 동기화용)
  onContentSaved?: (postId: string, nextContent: string) => void;
  onRequestDelete?: () => void;
  // 활성 영상의 재생 시간을 부모에게 throttle해서 알림 (Flicks 페이지 재진입 시 위치 복원용)
  onActiveVideoTimeChange?: (time: number) => void;
  // 활성 슬라이드가 영상일 때 적용할 시작 재생 위치 (재진입 시 복원). 한 번만 적용.
  initialVideoTime?: number;
}

const ReelSlide: React.FC<ReelSlideProps> = ({
  post,
  contentOverride,
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
  isMine = false,
  authUserId,
  onContentSaved,
  onRequestDelete,
  onActiveVideoTimeChange,
  initialVideoTime,
}) => {
  // 본문 표시는 부모의 수정 결과(contentOverride)를 우선
  const displayContent = contentOverride ?? post.content ?? "";

  // ── 본문 인라인 편집 상태 (다른 포스팅 카드와 일관된 UX) ─────────
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContent, setEditContent] = useState(displayContent);
  const [isSavingContent, setIsSavingContent] = useState(false);

  const startContentEdit = useCallback(() => {
    setEditContent(displayContent);
    setIsEditingContent(true);
  }, [displayContent]);

  const cancelContentEdit = useCallback(() => {
    setEditContent(displayContent);
    setIsEditingContent(false);
  }, [displayContent]);

  const saveContentEdit = useCallback(async () => {
    if (!authUserId) {
      showError("로그인이 필요합니다.");
      return;
    }
    const next = editContent.trim();
    if (!next) {
      showError("내용을 입력해주세요.");
      return;
    }
    setIsSavingContent(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ content: next })
        .eq("id", post.id)
        .eq("user_id", authUserId);
      if (error) throw error;
      onContentSaved?.(post.id, next);
      setIsEditingContent(false);
      showSuccess("컨텐츠가 수정되었습니다.");
    } catch (err) {
      console.error("[ReelsViewer] update error:", err);
      showError("수정 중 오류가 발생했습니다.");
    } finally {
      setIsSavingContent(false);
    }
  }, [authUserId, editContent, post.id, onContentSaved]);

  // 슬라이드가 비활성화되거나 다른 포스트로 바뀌면 편집 모드 종료
  useEffect(() => {
    if (!isActive) {
      setIsEditingContent(false);
    }
  }, [isActive, post.id]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  // video 첫 프레임이 그려진 이후에만 큰 "재생/일시정지" 오버레이를 노출
  // (로딩 중에 회색 재생 버튼이 떠서 버그처럼 보이는 문제 방지)
  const [videoFirstFrameReady, setVideoFirstFrameReady] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(post.commentsCount || 0);
  // 현재 로그인 사용자가 이 포스트에 댓글을 남겼는지 (댓글 아이콘 인디고 표시용)
  // 초기값은 부모(Flicks 등)가 사전 fetch해서 넘겨준 post.hasUserCommented 사용,
  // 활성화 시 fetchCommentsByPostId 결과로 정확히 재계산한다.
  const [hasUserCommented, setHasUserCommented] = useState<boolean>(!!post.hasUserCommented);

  // 영상 타임라인 상태
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // 활성 영상의 currentTime이 바뀔 때 부모에게 보고 (throttle ~400ms)
  // - 매 timeupdate마다 보고하면 부모 setState가 너무 자주 일어남
  // - 페이지 재진입 시 위치 복원 용도이므로 400ms 정도면 충분
  const lastReportedTimeRef = useRef(0);
  useEffect(() => {
    if (!isActive) return;
    if (!onActiveVideoTimeChange) return;
    const now = performance.now();
    if (now - lastReportedTimeRef.current < 400) return;
    lastReportedTimeRef.current = now;
    onActiveVideoTimeChange(currentTime);
  }, [currentTime, isActive, onActiveVideoTimeChange]);
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

  // 댓글 다이얼로그가 떠 있는 동안 영상을 잠시 일시정지
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).__commentsDialogOpen;
  });

  useEffect(() => {
    let commentsOpen = !!(window as any).__commentsDialogOpen;
    const apply = () => setIsOverlayOpen(commentsOpen);

    const handleComments = (e: Event) => {
      commentsOpen = !!(e as CustomEvent).detail?.open;
      apply();
    };

    window.addEventListener('comments-dialog-visibility', handleComments);
    apply();

    return () => {
      window.removeEventListener('comments-dialog-visibility', handleComments);
    };
  }, []);

  // 페이지 재진입 시 복원할 시작 위치를 1회만 적용하기 위한 가드.
  // post id + initialVideoTime 조합이 살아있는 동안 한 번만 seek 한다.
  const initialSeekAppliedRef = useRef(false);
  useEffect(() => {
    initialSeekAppliedRef.current = false;
  }, [post.id, initialVideoTime]);

  // active 슬라이드 + 현재 미디어가 영상일 때만 재생, 음소거 상태 적용
  // (오버레이가 떠 있는 동안은 일시정지하고, 닫히면 다시 재생)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && activeIsVideo && !isOverlayOpen) {
      v.muted = muted;
      // 재진입 시 직전 위치로 복원 (활성 슬라이드의 첫 재생 시 1회만)
      if (
        !initialSeekAppliedRef.current &&
        typeof initialVideoTime === "number" &&
        initialVideoTime > 0.1
      ) {
        try {
          v.currentTime = initialVideoTime;
          setCurrentTime(initialVideoTime);
        } catch {
          // seek 실패해도 재생은 진행
        }
        initialSeekAppliedRef.current = true;
      }
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
    } else if (isActive && activeIsVideo && isOverlayOpen) {
      // 오버레이가 떠 있으면 재생 위치는 유지한 채 일시정지만
      v.pause();
      setIsPlaying(false);
    } else {
      v.pause();
      v.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isActive, muted, activeIsVideo, activeMediaUrl, isOverlayOpen]);

  // 영상 시간/길이 + 첫 프레임 준비 상태 추적
  // 중요: videoRef.current는 MediaCarousel이 \"현재 활성 슬라이드 + 현재 활성 미디어\"일 때만
  // 비디오 요소를 attach 한다. 따라서 비활성 상태로 처음 마운트된 슬라이드는
  // videoRef.current === null 인 상태로 이 effect가 일찍 끝나버려, 나중에 active로 전환돼도
  // timeupdate 리스너가 다시 붙지 않아 타임라인이 갱신되지 않는 버그가 있었다.
  // → isActive를 deps에 추가해 슬라이드가 활성화되는 시점에 리스너가 다시 부착되도록 한다.
  useEffect(() => {
    // 새 영상으로 바뀌면 ready 상태 리셋
    setVideoFirstFrameReady(false);

    if (!isActive || !activeIsVideo) return;

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
    // 이미 메타데이터/현재시간이 준비돼 있을 수 있으므로 초기 값 동기화
    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    setCurrentTime(v.currentTime || 0);
    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("loadedmetadata", handleLoadedMeta);
      v.removeEventListener("durationchange", handleDurationChange);
      v.removeEventListener("playing", handlePlaying);
      v.removeEventListener("pause", handlePauseEvt);
      v.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [activeMediaUrl, isScrubbing, isActive, activeIsVideo]);

  // 댓글 수 + 내가 댓글을 남긴 포스팅인지 fetch (활성화 시 1회)
  useEffect(() => {
    if (!isActive) return;
    if (!isPersistedPostId(post.id)) return;
    let cancelled = false;
    fetchCommentsByPostId(post.id)
      .then((cs) => {
        if (cancelled) return;
        setCommentsCount(cs.length);
        if (authUserId) {
          setHasUserCommented(cs.some((c) => c.userId === authUserId));
        } else {
          setHasUserCommented(false);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isActive, post.id, authUserId]);

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

  // 하단 정보 영역(액션+아바타+본문) 실측 높이.
  // 미디어 컨테이너의 bottom 값을 정보 영역 높이와 동기화해 영상 끝과 액션 버튼 사이
  // 공백을 0으로 만든다. 본문 펼침/슬라이드 전환 시에도 ResizeObserver가 자동 갱신.
  const infoRef = useRef<HTMLDivElement>(null);
  const [infoHeight, setInfoHeight] = useState(150);

  useLayoutEffect(() => {
    const el = infoRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setInfoHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 편집 진입 시 슬라이드 루트 높이를 px로 박제 ─────────────
  // 안드로이드 WebView에서 키보드가 올라오면 visualViewport뿐만 아니라 layout viewport
  // 자체(window.innerHeight)도 줄어서, 부모(Flicks 페이지 컨테이너)와 함께 ReelSlide의
  // 100%/100dvh 높이가 같이 압축된다 → 영상이 작아짐.
  // 편집 모드에 들어가는 시점의 높이를 px로 박제하면, 부모가 줄어도 ReelSlide는 원래
  // 크기를 유지하고(=영상 그대로), 편집 오버레이만 portal로 키보드 위에 따로 그려진다.
  const slideRootRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  useEffect(() => {
    if (isEditingContent) {
      // 편집 진입 시 1회만 측정 (키보드가 이미 올라오는 중일 수도 있으므로 현재 값을 그대로 사용)
      const el = slideRootRef.current;
      if (el && lockedHeight == null) {
        const h = el.getBoundingClientRect().height;
        if (h > 0) setLockedHeight(h);
      }
    } else {
      setLockedHeight(null);
    }
  }, [isEditingContent, lockedHeight]);

  return (
    <div
      ref={slideRootRef}
      className="relative w-full bg-black overflow-hidden"
      style={{
        height: lockedHeight != null ? `${lockedHeight}px` : embedded ? "100%" : "100dvh",
      }}
    >
      {/* 배경 블러 — 3:4 메인 영상의 좌우 여백을 자연스럽게 채워주는 레이어.
          영상 첫 프레임 준비 여부와 무관하게 즉시 렌더링한다.
          (페이지 재진입 시 영상이 다시 디코드되는 짧은 순간에도 블러가 유지되어 화면이 튀지 않음) */}
      {fallbackImage && (
        <img
          src={fallbackImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-100 pointer-events-none"
        />
      )}

      {/* 트렌딩 릴스(showInlineCloseButton=true) 컨트롤.
          X 버튼도 슬라이드 내부에 두어 순위/음소거/메뉴 버튼처럼 스와이프 전환에 함께 움직이게 한다. */}
      {showInlineCloseButton && onClose && (
        <div
          className="absolute top-5 right-6 z-50 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {isMine && onRequestDelete && showInlineCloseButton && (
        <div
          className="absolute top-5 right-[68px] z-50 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <ReelsPostMenuDropdown
            onDelete={onRequestDelete}
          />
        </div>
      )}

      {/* 메인 미디어 — 화면 가로 너비에 딱 맞는 3:4 비율 컨테이너 */}
      {/* 하단을 충분히 띄워 닉네임/위치/본문/액션 알약 영역이 영상과 겹치지 않도록 함.
          embedded 모드에서는 페이지 자체가 헤더/BottomNav 사이로 한정되어 있어
          safe-area 추가 패딩이 필요 없으나, 액션 영역의 실측 높이만큼은 여유가 필요.
          상단에 약간의 여백(top)을 둬서 순위 뱃지/닫기 버튼과 미디어 사이에 자연스러운 갭을 만든다. */}
      <div
        className="absolute left-0 right-0 flex items-end justify-center"
        style={{
          top: "10px",
          bottom: embedded
            ? `${infoHeight}px`
            : `calc(env(safe-area-inset-bottom, 0px) + ${infoHeight}px)`,
          cursor: "pointer",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div
          className="relative overflow-hidden bg-black rounded-2xl"
          style={{
            aspectRatio: "3 / 4",
            height: "100%",
            width: "auto",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
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

          {/* 영상 내부 우상단 3-dot 메뉴 (내 포스팅일 때만, X 버튼이 없을 때만 여기에 둠).
              X 버튼(showInlineCloseButton)이 있는 트렌딩 릴스에서는 이 위치가 X와 겹쳐
              보이므로, 아래쪽의 \"외부 컨테이너\" 위치(X 왼쪽)로 옮긴다. */}
          {isMine && onRequestDelete && !showInlineCloseButton && (
            <div
              className="absolute top-3 right-3 z-40"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <ReelsPostMenuDropdown
                onDelete={onRequestDelete}
              />
            </div>
          )}

          {/* 가로 슬라이더 — 다중 미디어면 좌우 스와이프로 이동, 단일이면 그냥 표시 */}
          <MediaCarousel
            mediaList={mediaList}
            currentIndex={mediaIndex}
            onIndexChange={setMediaIndex}
            videoRef={videoRef}
            muted={muted}
            isSlideActive={isActive}
            videoPosterUrl={fallbackImage}
            // 페이지 재진입 시(initialVideoTime > 0) 썸네일 깜빡임 방지: 바로 영상으로 페이드인
            suppressVideoPoster={
              typeof initialVideoTime === "number" && initialVideoTime > 0.1
            }
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

          {/* 재생 오버레이 — 영상 컨테이너 정중앙에 위치 (3:4 영상의 시각적 중앙) */}
          {hasVideo && !isPlaying && videoFirstFrameReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              </div>
            </div>
          )}

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

      {/* 하단 그라데이션 + 액션 알약 + 정보
          순서 (위에서 아래):
            1) 액션 버튼 줄 (좋아요/댓글/공유 + 저장/위치보기) — 이미지/영상 바로 아래
            2) 아바타 + (닉네임/위치 세로) — 위치 정보가 닉네임 바로 밑, 모두 아바타 우측에 위치
            3) 본문 */}
      {/* 하단 그라데이션 — 영상 끝 위쪽(투명)에서 시작해서 본문 아래까지
          한 줄기로 자연스럽게 어두워진다.
          - 별도 레이어로 두어 정보 영역(infoRef) 높이 측정값에는 포함되지 않음
            → blur 배경이 아이콘 영역까지 잘리지 않고 자연스럽게 비친다.
          - 정보 영역 본체는 배경 없이 콘텐츠만 올린다. */}
      <div
        className="absolute left-0 right-0 z-10 pointer-events-none bg-gradient-to-t from-black/95 via-black/55 to-transparent"
        style={{ bottom: 0, height: `${infoHeight + 100}px` }}
        aria-hidden
      />
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div
          ref={infoRef}
          className="px-4"
          style={{
            paddingTop: "8px",
            paddingBottom: embedded ? "8px" : "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          }}
        >
          {/* 1) 알약 액션 버튼 (이미지/영상 바로 아래) */}
          <div className="flex items-center justify-between gap-2 pointer-events-auto mb-2">
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
                <span className="tabular-nums leading-none">{formatCount(likesCount)}</span>
              </button>

              <button
                type="button"
                onClick={onCommentClick}
                aria-label={`댓글 ${commentsCount.toLocaleString()}개`}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-black backdrop-blur-md transition-all active:scale-95",
                  hasUserCommented
                    ? "border-indigo-300/50 bg-indigo-500/20 text-white shadow-sm"
                    : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                )}
              >
                <MessageCircle
                  className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    hasUserCommented ? "fill-indigo-400 text-indigo-300" : "text-white"
                  )}
                />
                <span className="tabular-nums leading-none">{formatCount(commentsCount)}</span>
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

              {/* 위치 버튼: 좌표가 있으면 정상 위치 버튼, 없으면 "위치없음" 비활성 버튼.
                  위치 정보가 누락된 컨텐츠라도 시각적으로 위치 슬롯이 비어보이지 않도록
                  항상 위치 버튼 자리를 채워준다. */}
              {(post.lat != null && post.lng != null) ? (
                <LocationButtonWithTimer
                  createdAt={post.createdAt}
                  isAd={post.isAd}
                  onClick={onLocationClick as (e: React.MouseEvent) => void}
                  variant="dark"
                />
              ) : (
                <LocationButtonWithTimer
                  createdAt={null}
                  unavailable
                  onClick={(e) => e.stopPropagation()}
                  variant="dark"
                />
              )}
            </div>
          </div>

          {/* 2) 아바타 + (닉네임 / 위치) — 닉네임 바로 아래에 위치 정보 */}
          <div className="text-white pointer-events-auto mb-1.5 flex items-center gap-2.5">
            <button
              onClick={onUserClick}
              className="shrink-0 active:opacity-70 transition-opacity"
              aria-label={`${post.user.name}의 프로필`}
            >
              <PostUserAvatar
                name={post.user.name}
                avatar={post.user.avatar}
                postId={post.id}
                userId={post.user.id}
                size="sm"
                activePress
              />
            </button>

            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <button
                onClick={onUserClick}
                className="self-start text-left active:opacity-70 transition-opacity"
              >
                <span className="text-sm font-black drop-shadow-md leading-tight">
                  {post.user.name}
                </span>
              </button>

              {(post.lat != null && post.lng != null) && (
                <button
                  onClick={onLocationClick}
                  className="self-start flex items-center gap-1 text-indigo-300 active:opacity-70 transition-opacity"
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-bold drop-shadow-md truncate max-w-[70vw] leading-tight">
                    {post.location || "위치 보기"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* 3) 본문 — 항상 한 줄로만 표시 (1줄 초과 시 자동 truncate "...").
              편집 UI는 별도 오버레이(아래 absolute)로 띄워 infoRef 실측 높이에
              영향을 주지 않도록 한다 → 영상 컨테이너 크기 고정. */}
          {displayContent && (
            <div className="text-white pointer-events-auto">
              <ReelContentText content={displayContent} />
            </div>
          )}
        </div>
      </div>

      {/* 인라인 본문 편집 오버레이 — body에 portal로 띄워 키보드 바로 위에 고정.
          이렇게 하면:
            1) ReelsViewer/Flicks 페이지 컨테이너가 visualViewport 축소로 줄어도
               편집창은 영향을 받지 않고 항상 키보드 바로 위에 위치한다.
            2) 영상 컨테이너 크기는 ReelSlide 내부에서 그대로 유지된다(편집 진입 시 박제).
          위치 계산: visualViewport.height + offsetTop 으로 키보드 상단을 정확히 추적. */}
      <ReelContentEditOverlay
        open={isEditingContent}
        value={editContent}
        onChange={setEditContent}
        onSave={saveContentEdit}
        onCancel={cancelContentEdit}
        saving={isSavingContent}
      />
    </div>
  );
};

// ─── 본문 편집 오버레이 (body portal, 키보드 위 고정) ────────────
// 안드로이드 WebView에서 키보드가 올라오면 layout viewport(window.innerHeight)가
// 줄어 ReelsViewer 페이지 컨테이너도 같이 줄어든다(=영상이 작아짐). 편집창을 페이지
// 내부 absolute로 두면 영상 크기에 종속되어 같이 밀리는 문제가 있다.
// → 편집창만 body에 portal로 띄우고 position: fixed로 키보드 바로 위에 박제한다.
//   visualViewport API로 키보드 상단의 정확한 y좌표를 추적해 따라간다.
interface ReelContentEditOverlayProps {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const ReelContentEditOverlay: React.FC<ReelContentEditOverlayProps> = ({
  open,
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}) => {
  // 키보드 상단(=visualViewport 하단)의 viewport 기준 y좌표.
  // 키보드가 내려간 상태에서는 layout viewport 하단(window.innerHeight)과 같다.
  const [keyboardTop, setKeyboardTop] = useState<number>(() =>
    typeof window === "undefined" ? 0 : window.innerHeight
  );

  useEffect(() => {
    if (!open) return;

    const computeKeyboardTop = () => {
      const vv = window.visualViewport;
      if (vv) {
        // visualViewport 하단의 layout viewport 기준 y좌표
        return vv.offsetTop + vv.height;
      }
      return window.innerHeight;
    };

    const update = () => setKeyboardTop(computeKeyboardTop());

    update();
    // 키보드가 올라오는 동안 visualViewport는 여러 번 갱신되므로 모든 이벤트에 반응
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    // 키보드 애니메이션 중 누락 방지용 추가 체크
    const t1 = window.setTimeout(update, 100);
    const t2 = window.setTimeout(update, 250);
    const t3 = window.setTimeout(update, 450);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // bottom 위치: layout viewport 하단으로부터 키보드 높이만큼 위로
  // (= window.innerHeight - keyboardTop)
  // 키보드와 완전히 밀착되도록 추가 패딩 없음.
  const bottomPx = Math.max(0, window.innerHeight - keyboardTop);

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[40000] pointer-events-auto"
      style={{ bottom: `${bottomPx}px` }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative px-4 pb-2 pt-3 bg-gradient-to-t from-black/90 via-black/75 to-black/40 backdrop-blur-sm">
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={saving}
            autoFocus
            placeholder="이 영상에 대한 이야기를 들려주세요..."
            className="min-h-[88px] resize-none rounded-2xl border-indigo-100 bg-indigo-50/95 text-sm text-gray-900 shadow-inner focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !value.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition active:scale-95 disabled:bg-gray-300"
              aria-label="수정 저장"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition active:scale-95 disabled:opacity-60"
              aria-label="수정 취소"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Reels 영상 요소 ──────────────────────────────────────
// 안드로이드 Chrome/WebView에서 <video>가 첫 프레임을 그리기 전
// 잠깐 회색 placeholder가 깜빡이는 문제를 방지하기 위해
// 투명 poster로 네이티브 placeholder를 막고, 첫 프레임 준비 전까지 video를 숨겨둔다.
const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface ReelsVideoProps {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  muted: boolean;
  preload: "none" | "metadata" | "auto";
  isCurrent: boolean;
  /** 영상이 첫 프레임을 디코드하기 전 보여줄 썸네일. */
  posterUrl?: string;
  /** "이어 재생" 모드 — 페이지 재진입처럼 처음부터 시작이 아닐 때.
   * 이 경우 썸네일을 띄우지 않고 바로 영상으로 페이드인하여 화면 튐을 방지한다.
   * (썸네일이 잠깐 보였다 영상으로 바뀌는 깜빡임 제거. 그 짧은 디코드 시간엔
   *  부모 슬라이드의 blur 배경이 메워줘서 시각적으로 튀지 않음.) */
  suppressPoster?: boolean;
}

const ReelsVideo: React.FC<ReelsVideoProps> = ({
  src,
  videoRef,
  muted,
  preload,
  isCurrent,
  posterUrl,
  suppressPoster = false,
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
    const markReady = () => setIsReady(true);
    const handleCanPlay = () => {
      markReady();
      // 자동 재생 보강: 부모 effect가 일찍 시도해서 실패한 경우라도 ready되면 다시 시도
      if (isCurrent && el.paused) {
        el.play().catch(() => {
          // 사운드 정책 등으로 실패하면 muted로 재시도
          el.muted = true;
          el.play().catch(() => {});
        });
      }
    };
    el.addEventListener("loadeddata", markReady);
    el.addEventListener("playing", markReady);
    el.addEventListener("canplay", handleCanPlay);
    if (el.readyState >= 2) markReady();
    return () => {
      el.removeEventListener("loadeddata", markReady);
      el.removeEventListener("playing", markReady);
      el.removeEventListener("canplay", handleCanPlay);
    };
  }, [src, isCurrent]);

  // isCurrent가 false로 바뀌면 즉시 일시정지 + 음소거 처리.
  // (비활성 슬라이드의 영상이 백그라운드에서 계속 재생되어 소리가 겹치는 문제 방지)
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    if (!isCurrent) {
      el.muted = true;
      if (!el.paused) el.pause();
      el.currentTime = 0;
    }
  }, [isCurrent]);

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
      {/* 첫 프레임 디코드 전엔 posterUrl을 깔아 둠 (흰/회색 빈 화면 방지).
          isReady가 되면 부드럽게 사라진다.
          단 suppressPoster=true(=이어 재생 모드)면 썸네일 깜빡임을 막기 위해 아예 렌더하지 않음. */}
      {posterUrl && !suppressPoster && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: isReady ? 0 : 1,
            transition: "opacity 200ms ease-out",
          }}
          draggable={false}
        />
      )}
      <video
        ref={setRefs}
        src={src}
        className="absolute inset-0 w-full h-full object-cover video-hq bg-black"
        // suppressPoster일 땐 native poster도 띄우지 않음 (썸네일 깜빡임 원천 차단).
        // 그 외엔 1x1 투명 poster로 회색 placeholder 깜빡임만 막는다.
        poster={suppressPoster ? TRANSPARENT_POSTER : (posterUrl || TRANSPARENT_POSTER)}
        playsInline
        loop
        muted={muted}
        preload={preload}
        style={{
          // suppressPoster일 땐 영상을 숨기지 않고 즉시 보이도록 둔다.
          // (poster를 안 띄우는 대신 부모의 blur 배경이 디코드 동안 메움)
          opacity: !suppressPoster && isCurrent && !isReady ? 0 : 1,
          transition: "opacity 200ms ease-out",
          // 디코드 전 브라우저 기본 흰 배경이 잠깐 보이는 현상 방지.
          // (특히 이어 재생 시 suppressPoster=true라 poster도 안 깔리므로 필수)
          backgroundColor: "#000",
        }}
      />
      {/* 영상이 활성 슬라이드인데 첫 프레임이 아직 안 그려졌다면 로딩 스피너 표시 (이어 재생 모드 제외) */}
      {!suppressPoster && isCurrent && !isReady && showSpinner && (
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
  // 부모 ReelSlide가 현재 활성 슬라이드인지 여부.
  // false면 캐러셀 내부의 비디오가 canplay/loadeddata 이벤트로 자동 재생되는 것을 차단한다.
  // (여러 슬라이드가 동시에 DOM에 마운트되어 있어도 활성 슬라이드만 영상을 재생하기 위함)
  isSlideActive: boolean;
  /** 영상 슬라이드용 fallback 썸네일 (첫 프레임 디코드 전 빈 화면 방지). */
  videoPosterUrl?: string;
  /** 영상 "이어 재생" 모드 — 썸네일을 띄우지 않고 바로 영상 페이드인 (페이지 재진입 시). */
  suppressVideoPoster?: boolean;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({
  mediaList,
  currentIndex,
  onIndexChange,
  videoRef,
  muted,
  isSlideActive,
  videoPosterUrl,
  suppressVideoPoster,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  // 트랜지션 문자열 자체를 state로: 빠른 flick엔 짧고 가파른 곡선, 느릴 땐 살짝 더 부드럽게.
  const [trackTransition, setTrackTransition] = useState<string>("none");

  // velocity(px/ms) 기반으로 손을 놓은 뒤 다음 사진까지 갈 때 쓸 transition 계산
  const computeSnapTransition = (velocity: number): string => {
    // velocity: 0(정지) ~ 2.5+(아주 빠른 플릭) 범위로 보고 보간
    const v = Math.min(Math.max(velocity, 0), 2.5);
    // 빠를수록 짧게: 220ms(느림) → 110ms(빠름)
    const duration = Math.round(220 - v * 44);
    // 빠를수록 시작이 더 가파르게(스냅감) — cubic-bezier x1을 작게
    // v=0 → (0.25, 0.9, 0.25, 1)   v=2.5 → (0.05, 1, 0.2, 1)
    const x1 = (0.25 - v * 0.08).toFixed(3);
    const y1 = (0.9 + v * 0.04).toFixed(3);
    return `transform ${duration}ms cubic-bezier(${x1}, ${y1}, 0.2, 1)`;
  };

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
      setTrackTransition("none");
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

        // 끝에서 더 못 가도록 저항 적용 + 드래그 중 살짝 끈적한 느낌(0.88x)
        const atStart = g.startIndex === 0 && dx > 0;
        const atEnd = g.startIndex === mediaCountRef.current - 1 && dx < 0;
        let visualDx = dx * 0.88;
        if (atStart || atEnd) visualDx = dx * 0.22;
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
      const velocity = Math.abs(dx) / Math.max(dt, 1); // px/ms
      // 더 쉽게 다음으로 넘어가도록 임계값 완화 + flick 민감도 ↑
      const distanceThreshold = width * 0.12;
      const isFlick = velocity > 0.18 && Math.abs(dx) > 14;

      let nextIndex = g.startIndex;
      if (dx < -distanceThreshold || (isFlick && dx < 0)) {
        nextIndex = g.startIndex + 1;
      } else if (dx > distanceThreshold || (isFlick && dx > 0)) {
        nextIndex = g.startIndex - 1;
      }
      const clamped = Math.max(0, Math.min(mediaCountRef.current - 1, nextIndex));

      // 빠르게 휙 던졌을 땐 짧고 가파른 곡선으로 "촥!" 달라붙게
      const snap = computeSnapTransition(velocity);
      setTrackTransition(snap);
      setDragX(0);
      if (clamped !== currentIndexRef.current) {
        onIndexChange(clamped);
      }
      // 다음 제스처 시작 전엔 transition을 다시 끊어둠
      window.setTimeout(() => setTrackTransition("none"), 260);
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
    setTrackTransition("none");

    const onMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const dx = ev.clientX - g.startX;
      g.lastX = ev.clientX;
      const atStart = g.startIndex === 0 && dx > 0;
      const atEnd = g.startIndex === mediaCountRef.current - 1 && dx < 0;
      let visualDx = dx * 0.88;
      if (atStart || atEnd) visualDx = dx * 0.22;
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
      const distanceThreshold = width * 0.12;
      const isFlick = velocity > 0.18 && Math.abs(dx) > 14;
      let nextIndex = g.startIndex;
      if (dx < -distanceThreshold || (isFlick && dx < 0)) {
        nextIndex = g.startIndex + 1;
      } else if (dx > distanceThreshold || (isFlick && dx > 0)) {
        nextIndex = g.startIndex - 1;
      }
      const clamped = Math.max(0, Math.min(mediaCountRef.current - 1, nextIndex));
      const snap = computeSnapTransition(velocity);
      setTrackTransition(snap);
      setDragX(0);
      if (clamped !== currentIndexRef.current) onIndexChange(clamped);
      window.setTimeout(() => setTrackTransition("none"), 260);
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
          transition: trackTransition,
        }}
      >
        {mediaList.map((url, i) => {
          const isVid = isVideoUrl(url);
          const isCurrent = i === currentIndex;
          // 캐러셀 내부 활성 미디어이면서 동시에 부모 슬라이드가 활성 상태일 때만
          // "재생 가능 상태"로 취급한다. 그래야 화면에 보이지 않는 다른 슬라이드의
          // 영상이 canplay/loadeddata 이벤트로 자동 재생되어 소리가 겹치는 문제가 사라진다.
          const isPlayable = isCurrent && isSlideActive;
          return (
            <div
              key={`${url}-${i}`}
              className="relative h-full shrink-0 bg-black"
              style={{ width: `${100 / mediaList.length}%` }}
            >
              {isVid ? (
                <ReelsVideo
                  videoRef={isPlayable ? videoRef : undefined}
                  src={url}
                  muted={isPlayable ? muted : true}
                  preload={isPlayable ? "auto" : "none"}
                  isCurrent={isPlayable}
                  posterUrl={videoPosterUrl}
                  suppressPoster={isPlayable && suppressVideoPoster}
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
  const progressBarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const displayTimeRef = useRef<HTMLSpanElement>(null);
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

  // 비디오의 timeupdate 이벤트는 ~250ms 간격으로 들어와서 진행률이 끊기듯 보인다.
  // 매 프레임 rAF로 진행률을 보간해서 트랙/핸들/현재시간 텍스트를 직접 업데이트한다 (스무스).
  // - 스크럽 중에는 사용자가 지정한 위치를 즉시 반영 (보간 X).
  // - 진행률은 DOM 직접 조작으로 처리해 React 리렌더 비용을 회피.
  useEffect(() => {
    if (duration <= 0) return;

    let rafId = 0;
    let smoothedTime = currentTime;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000; // 초 단위
      lastFrame = now;

      const target = latestTimeRef.current;

      if (isDraggingRef.current) {
        // 스크럽 중에는 사용자가 지정한 위치를 즉시 반영
        smoothedTime = target;
      } else {
        // 1) 영상이 정상 재생 중이라면 dt만큼 자연스럽게 흐르게 함
        smoothedTime += dt;
        // 2) 실제 비디오 currentTime과 너무 멀어지면 부드럽게 보정 (지수 보간)
        const diff = target - smoothedTime;
        if (Math.abs(diff) > 0.4) {
          // 큰 점프(시킹 등): 즉시 맞춤
          smoothedTime = target;
        } else {
          smoothedTime += diff * Math.min(1, dt * 4);
        }
      }

      // 범위 clamp
      if (smoothedTime < 0) smoothedTime = 0;
      if (smoothedTime > duration) smoothedTime = duration;

      const ratio = duration > 0 ? smoothedTime / duration : 0;
      const pct = ratio * 100;

      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }
      if (handleRef.current) {
        handleRef.current.style.left = `calc(12px + (100% - 24px) * ${ratio})`;
      }
      if (displayTimeRef.current) {
        displayTimeRef.current.textContent = formatTime(smoothedTime);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  // 외부에서 들어오는 currentTime을 ref로 동기화 (rAF가 참조)
  useEffect(() => {
    latestTimeRef.current = currentTime;
  }, [currentTime]);

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
        {/* 시간 표시 (타임라인 우측 바로 위, 흰색 텍스트) — 현재 / 전체 */}
        {duration > 0 && (
          <div className="absolute -top-4 right-3 pointer-events-none flex items-baseline gap-1">
            <span
              ref={displayTimeRef}
              className="text-white text-[11px] font-black tabular-nums leading-none tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
            >
              {formatTime(currentTime)}
            </span>
            <span className="text-white/60 text-[11px] font-black tabular-nums leading-none tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
              / {formatTime(duration)}
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
          {/* 진행 바 — rAF로 매 프레임 width 업데이트 (transition 없음) */}
          <div
            ref={progressBarRef}
            className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* 핸들 (스크럽 중에만 크게 표시) — rAF로 매 프레임 left 업데이트 */}
        <div
          ref={handleRef}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none transition-[width,height,opacity] duration-150",
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
