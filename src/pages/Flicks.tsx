"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clapperboard } from 'lucide-react';
import { Post } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage } from '@/lib/utils';
import { fetchLikedPostIds } from '@/utils/like-utils';
import ReelsViewer from '@/components/ReelsViewer';

const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
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

const CONTENT_FIXED_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  bottom: 0,
  backgroundColor: '#000',
  zIndex: 0,
  pointerEvents: 'none',
};

// ─────────────────────────────────────────────────────────────
// 세션 캐시: 라우터 unmount 후에도 같은 세션에 돌아오면
// 동일한 셔플 순서/현재 영상/재생 위치를 유지하기 위한 module-scope 저장소.
//
// 사용 시나리오:
//   Flicks → 알림/메시지 진입 → X 눌러 복귀
//   이때 fetchVideoPool로 새로 셔플되지 않고, 보던 영상의 같은 시점부터 이어 재생.
//
// 무효화 시점:
//   - 사용자 변경 (다른 계정 로그인)
//   - 차단 목록 변경 (필터 결과가 달라지므로)
//   - 다음 fetchVideoPool 호출 (= 캐시가 없을 때만 fetch하므로 보통 한 세션 1회)
// ─────────────────────────────────────────────────────────────
type FlicksCache = {
  videoPool: Post[];
  activePostId: string | null;
  activeVideoTime: number;
  authUserId: string | null;
  blockedKey: string;
};
let flicksCache: FlicksCache | null = null;

// Flicks → 이 경로로 나갔다가 → 같은 경로에서 다시 Flicks로 돌아오면 이어 재생.
// 그 외 라우트로 이탈하면 캐시를 무효화해서 다음 진입 시 새 영상이 나오게 한다.
const FLICKS_RESUME_ROUTES = ['/notifications', '/messages'];

const isResumeRoute = (pathname: string): boolean =>
  FLICKS_RESUME_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'));

// Flicks가 unmount될 때 어떤 경로로 빠져나갔는지 기록.
// 다음에 Flicks가 mount될 때 이 값이 resume route였을 때만 캐시 복원.
let flicksLastExitPath: string | null = null;

const Flicks = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { blockedIds } = useBlockedUsers();
  const blockedKey = Array.from(blockedIds).sort().join(',');

  // 캐시가 현재 사용자/차단목록과 일치하고,
  // 직전에 Flicks에서 빠져나간 경로가 알림/메시지(=resume route)였을 때만 즉시 복원.
  // → 알림/메시지에서 X로 돌아오는 케이스에서만 이어 재생, 다른 메뉴 갔다 오면 새 영상.
  const cachedValid =
    !!flicksCache &&
    flicksCache.authUserId === (authUser?.id ?? null) &&
    flicksCache.blockedKey === blockedKey &&
    flicksCache.videoPool.length > 0 &&
    flicksLastExitPath !== null &&
    isResumeRoute(flicksLastExitPath);

  // [DEBUG-FLICKS-FLICKER] Flicks 마운트 시점 캐시/resume 상태
  console.log('[DEBUG-FLICKS-FLICKER] Flicks mount eval', {
    hasCache: !!flicksCache,
    flicksLastExitPath,
    isResume:
      flicksLastExitPath !== null ? isResumeRoute(flicksLastExitPath) : false,
    cachedValid,
    cachedActivePostId: flicksCache?.activePostId ?? null,
    cachedActiveVideoTime: flicksCache?.activeVideoTime ?? null,
    cachedPoolLen: flicksCache?.videoPool.length ?? 0,
  });

  // 한 번 마운트하면 exit path는 소비된 셈이므로 다시 null로 (다음 cycle을 위해)
  // 단, 캐시가 유효하지 않아 새로 페치하더라도 동일하게 리셋되어야 일관됨
  useEffect(() => {
    flicksLastExitPath = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [videoPool, setVideoPool] = useState<Post[]>(
    cachedValid ? flicksCache!.videoPool : []
  );
  const [isLoading, setIsLoading] = useState(!cachedValid);
  const hasLoaded = useRef(cachedValid);

  // 마지막으로 보고된 활성 포스트/시간을 ref로 추적 (state로 두면 매 보고마다 리렌더)
  const activePostIdRef = useRef<string | null>(
    cachedValid ? flicksCache!.activePostId : null
  );
  const activeVideoTimeRef = useRef<number>(
    cachedValid ? flicksCache!.activeVideoTime : 0
  );

  // ReelsViewer에 넘길 초기 포스트와 초기 재생 시간을 마운트 시 1회만 결정
  // (이후 ReelsViewer 내부 상태로 흘러가므로 부모는 재계산 안 함)
  const initialPostRef = useRef<Post | null>(null);
  const initialVideoTimeRef = useRef<number>(0);

  const fetchVideoPool = useCallback(async () => {
    try {
      setIsLoading(true);

      // 전체 영상 포스트 중 좋아요 50점 + 조회수 50점 합산 상위 200개 조회
      const { data, error } = await supabase.rpc('get_flicks_pool', { limit_count: 200 });
      if (error) throw error;

      const rows: any[] = data || [];
      const postIds = rows.map((p) => p.id);
      const userId = authUser?.id || null;

      // 좋아요/댓글/저장 상태를 병렬로 조회해 영속화된 상태를 정확히 반영
      const [likedIds, commentedIds, savedIds, commentCountMap] = await Promise.all([
        fetchLikedPostIds(postIds, userId),
        (async (): Promise<Set<string>> => {
          if (!userId || postIds.length === 0) return new Set();
          const { data: rows, error: err } = await supabase
            .from('comments')
            .select('post_id')
            .eq('user_id', userId)
            .in('post_id', postIds);
          if (err) {
            console.error('[Flicks] fetch user comments error:', err);
            return new Set();
          }
          return new Set((rows || []).map((r: any) => String(r.post_id)));
        })(),
        (async (): Promise<Set<string>> => {
          if (!userId || postIds.length === 0) return new Set();
          const { data: rows, error: err } = await supabase
            .from('saved_posts')
            .select('post_id')
            .eq('user_id', userId)
            .in('post_id', postIds);
          if (err) {
            console.error('[Flicks] fetch saved posts error:', err);
            return new Set();
          }
          return new Set((rows || []).map((r: any) => String(r.post_id)));
        })(),
        (async (): Promise<Map<string, number>> => {
          if (postIds.length === 0) return new Map();
          const { data: rows, error: err } = await supabase
            .from('comments')
            .select('post_id')
            .in('post_id', postIds);
          if (err) {
            console.error('[Flicks] fetch comments count error:', err);
            return new Map();
          }
          const map = new Map<string, number>();
          (rows || []).forEach((r: any) => {
            const key = String(r.post_id);
            map.set(key, (map.get(key) || 0) + 1);
          });
          return map;
        })(),
      ]);

      const mapped: Post[] = rows.map((p: any) => {
        const borderType = p.hot_since ? 'popular' : 'none';
        const isAd = p.content?.trim().startsWith('[AD]');
        const finalImage = p.image_url || getFallbackImage(String(p.id));
        const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];
        const idKey = String(p.id);
        return {
          id: p.id,
          isAd,
          isGif: false,
          isInfluencer: false,
          user: { id: p.user_id, name: p.user_name, avatar: p.user_avatar },
          content: p.content?.replace(/^\[AD\]\s*/, '') || '',
          location: p.location_name,
          lat: p.latitude,
          lng: p.longitude,
          likes: Number(p.likes || 0),
          commentsCount: commentCountMap.get(idKey) || 0,
          comments: [],
          image: finalImage,
          image_url: finalImage,
          images: finalImages,
          latitude: p.latitude,
          longitude: p.longitude,
          videoUrl: p.video_url,
          videoUrls: Array.isArray(p.video_urls) ? p.video_urls : undefined,
          isLiked: likedIds.has(idKey),
          isSaved: savedIds.has(idKey),
          hasUserCommented: commentedIds.has(idKey),
          createdAt: new Date(p.created_at),
          borderType: borderType as any,
          category: p.category || 'none',
        };
      });

      // 광고 제외 + 차단 유저 제외 후 랜덤 셔플
      const filtered = mapped.filter(
        (p) => !p.isAd && p.user && !blockedIds.has(p.user.id)
      );

      const shuffled = shuffle(filtered);
      setVideoPool(shuffled);

      // 새로 셔플된 풀을 캐시에 저장 (이후 페이지 재진입 시 재사용)
      flicksCache = {
        videoPool: shuffled,
        activePostId: shuffled[0]?.id ?? null,
        activeVideoTime: 0,
        authUserId: authUser?.id ?? null,
        blockedKey,
      };
      activePostIdRef.current = flicksCache.activePostId;
      activeVideoTimeRef.current = 0;
    } catch (err) {
      console.error('[Flicks] failed to load video pool', err);
      setVideoPool([]);
    } finally {
      setIsLoading(false);
    }
  }, [blockedIds, authUser?.id, blockedKey]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate('/login', { replace: true });
      return;
    }
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    fetchVideoPool();
  }, [authLoading, authUser, fetchVideoPool, navigate]);

  // Unmount 시 다음 라우트를 기록.
  // - 알림/메시지로 빠져나갔다 → 다음 mount에서 캐시 복원해 이어 재생
  // - 그 외 경로(하단 탭 다른 메뉴 등)로 이탈 → 캐시 무효화, 다음 진입 시 새 영상
  // React Router는 라우트 전환이 일어난 뒤 unmount하므로 이 시점에는 window.location.pathname이 이미 새 경로로 갱신돼 있다.
  useEffect(() => {
    return () => {
      const nextPath = typeof window !== 'undefined' ? window.location.pathname : '';
      flicksLastExitPath = nextPath;
      const willResume = isResumeRoute(nextPath);
      if (!willResume) {
        flicksCache = null;
      }
      // [DEBUG-FLICKS-FLICKER] Flicks 언마운트 시 다음 경로 기록
      console.log('[DEBUG-FLICKS-FLICKER] Flicks unmount', {
        nextPath,
        willResume,
        cacheKept: willResume,
        cachedActivePostId: flicksCache?.activePostId ?? null,
        cachedActiveVideoTime: flicksCache?.activeVideoTime ?? null,
      });
    };
  }, []);

  // 마운트 시 초기 포스트/초기 시간 결정 (cached일 때만 의미 있음; 새 fetch면 fetchVideoPool이 캐시를 덮어쓴 후 ReelsViewer가 첫 슬라이드부터 시작)
  if (videoPool.length > 0 && !initialPostRef.current) {
    const cachedActiveId = activePostIdRef.current;
    const found = cachedActiveId
      ? videoPool.find((p) => p.id === cachedActiveId)
      : null;
    initialPostRef.current = found ?? videoPool[0];
    initialVideoTimeRef.current = found ? activeVideoTimeRef.current : 0;
  }

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handlePostDeleted = useCallback((postId: string) => {
    setVideoPool((prev) => {
      const next = prev.filter((p) => p.id !== postId);
      if (flicksCache) {
        flicksCache.videoPool = next;
        if (flicksCache.activePostId === postId) {
          flicksCache.activePostId = next[0]?.id ?? null;
          flicksCache.activeVideoTime = 0;
        }
      }
      return next;
    });
  }, []);

  const handlePostUpdated = useCallback((postId: string, content: string) => {
    setVideoPool((prev) => {
      const next = prev.map((p) => (p.id === postId ? { ...p, content } : p));
      if (flicksCache) flicksCache.videoPool = next;
      return next;
    });
  }, []);

  // ReelsViewer에서 활성 포스트가 바뀔 때마다 캐시 갱신
  const handleActivePostChange = useCallback((postId: string) => {
    activePostIdRef.current = postId;
    if (flicksCache) {
      // 활성 포스트가 바뀌면 영상 시간은 0부터 — 그래야 다른 영상으로 갔다 돌아왔을 때
      // 마지막 본 영상이 처음부터 재생되는 게 아니라, 마지막 영상의 마지막 시점에서 재개됨
      if (flicksCache.activePostId !== postId) {
        flicksCache.activeVideoTime = 0;
      }
      flicksCache.activePostId = postId;
    }
  }, []);

  // 활성 영상의 재생 시간을 ref+캐시에 저장 (state 갱신 X, 리렌더 없음)
  const handleActiveVideoTimeChange = useCallback((time: number) => {
    activeVideoTimeRef.current = time;
    if (flicksCache) flicksCache.activeVideoTime = time;
  }, []);

  if (isLoading) {
    return (
      <>
        <div style={BACKDROP_STYLE} aria-hidden />
        <div className="bg-black" style={CONTENT_FIXED_STYLE}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white">
            <Clapperboard className="w-10 h-10 text-white/80" />
            <Loader2 className="w-6 h-6 animate-spin text-white/80" />
            <span className="text-xs font-bold tracking-wider text-white/70">FLICKS 불러오는 중…</span>
          </div>
        </div>
      </>
    );
  }

  if (videoPool.length === 0) {
    return (
      <>
        <div style={BACKDROP_STYLE} aria-hidden />
        <div className="bg-black" style={CONTENT_FIXED_STYLE}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white px-10 text-center">
            <Clapperboard className="w-12 h-12 text-white/70" />
            <p className="text-base font-black tracking-tight">아직 재생할 영상이 없어요</p>
            <p className="text-xs font-bold text-white/60 leading-relaxed">
              영상이 등록된 컨텐츠가 없습니다.<br />영상을 업로드하면 여기서 즐길 수 있어요.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={BACKDROP_STYLE} aria-hidden />
      <div className="bg-black" style={CONTENT_FIXED_STYLE}>
        <ReelsViewer
          isOpen={true}
          initialPost={initialPostRef.current ?? videoPool[0]}
          pool={videoPool}
          onClose={handleClose}
          onDelete={handlePostDeleted}
          onUpdate={handlePostUpdated}
          onActivePostChange={handleActivePostChange}
          onActiveVideoTimeChange={handleActiveVideoTimeChange}
          initialVideoTime={initialVideoTimeRef.current}
          noRepeat
          embedded
          endMessage="더 이상 표시할 영상이 없습니다"
          endSubMessage="새로운 영상이 올라오면 여기서 만나볼 수 있어요."
        />
      </div>
    </>
  );
};

export default Flicks;
