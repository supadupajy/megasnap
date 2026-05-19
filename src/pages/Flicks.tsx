"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import { Post } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage } from '@/lib/utils';
import { fetchLikedPostIds } from '@/utils/like-utils';
import ReelsViewer from '@/components/ReelsViewer';
import FlicksAmbientFlow from '@/components/FlicksAmbientFlow';

// Fisher-Yates 셔플
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Flicks 페이지 컨테이너: 헤더(64px)와 BottomNav 영역(64px) 사이에만 표시.
const CONTENT_FIXED_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
};

const FlicksLoadingSkeleton = () => (
  <div className="relative h-full w-full overflow-hidden bg-black">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(79,70,229,0.22),transparent_34%),linear-gradient(180deg,#111827_0%,#030712_55%,#000_100%)]" />
    <div className="absolute inset-x-0 top-3 bottom-[116px] flex items-end justify-center px-3">
      <div className="relative h-full max-h-full aspect-[3/4] max-w-full overflow-hidden rounded-2xl bg-white/[0.07]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.10] via-white/[0.045] to-white/[0.08]" />
        <div className="absolute inset-x-6 bottom-6 h-1 rounded-full bg-white/12 animate-pulse" />
      </div>
    </div>
    <div className="absolute left-4 right-4 bottom-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-full bg-white/10 animate-pulse" />
          <div className="h-9 w-20 rounded-full bg-white/10 animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
          <div className="h-9 w-20 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-white/12 animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-28 rounded-full bg-white/14 animate-pulse" />
          <div className="h-2.5 w-44 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>
      <div className="h-3 w-3/4 rounded-full bg-white/10 animate-pulse" />
      <p className="pt-1 text-center text-[11px] font-black tracking-[0.28em] text-white/35">FLICKS</p>
    </div>
  </div>
);

// 알림/메시지는 라우트가 아니라 오버레이로 동작하므로,
// Flicks 페이지가 unmount되지 않고 그대로 살아 있다. 이전에 있던 캐시/이어재생/
// exitPath/initialVideoTime 같은 우회 로직은 모두 제거되었다.
const Flicks = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { blockedIds } = useBlockedUsers();
  const blockedKey = Array.from(blockedIds).sort().join(',');

  const [videoPool, setVideoPool] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoaded = useRef(false);
  // 현재 활성 슬라이드의 대표 이미지(영상 썸네일/첫 이미지) URL.
  // 하단 FlicksAmbientFlow가 이 이미지로부터 ambient 색상을 추출해서 분위기를 표현한다.
  const [activePosterUrl, setActivePosterUrl] = useState<string | null>(null);

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
      setVideoPool(shuffle(filtered));
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

  // 하단 BottomNav 알약 주변 영역.
  // 단순 검정 박스 대신, 현재 활성 영상의 색감을 추출해서 부드러운 ambient glow + 위로
  // 떠오르는 빛 입자(particle) 효과를 보여줘 단조로운 검은 여백을 한 단계 더 시네마틱하게 만든다.
  const bottomFill = (
    <FlicksAmbientFlow
      height="calc(env(safe-area-inset-bottom, 0px) + 64px)"
      posterUrl={activePosterUrl}
    />
  );

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handlePostDeleted = useCallback((postId: string) => {
    setVideoPool((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handlePostUpdated = useCallback((postId: string, content: string) => {
    setVideoPool((prev) => prev.map((p) => (p.id === postId ? { ...p, content } : p)));
  }, []);

  if (isLoading) {
    return (
      <>
        <div className="bg-black" style={CONTENT_FIXED_STYLE}>
          <FlicksLoadingSkeleton />
        </div>
        {bottomFill}
      </>
    );
  }

  if (videoPool.length === 0) {
    return (
      <>
        <div className="bg-black" style={CONTENT_FIXED_STYLE}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white px-10 text-center">
            <Clapperboard className="w-12 h-12 text-white/70" />
            <p className="text-base font-black tracking-tight">아직 재생할 영상이 없어요</p>
            <p className="text-xs font-bold text-white/60 leading-relaxed">
              영상이 등록된 컨텐츠가 없습니다.<br />영상을 업로드하면 여기서 즐길 수 있어요.
            </p>
          </div>
        </div>
        {bottomFill}
      </>
    );
  }

  return (
    <>
      <div className="bg-black" style={CONTENT_FIXED_STYLE}>
        <ReelsViewer
          isOpen={true}
          initialPost={videoPool[0]}
          pool={videoPool}
          onClose={handleClose}
          onDelete={handlePostDeleted}
          onUpdate={handlePostUpdated}
          noRepeat
          embedded
          embeddedBottomExtensionHeight="calc(env(safe-area-inset-bottom, 0px) + 64px)"
          endMessage="더 이상 표시할 영상이 없습니다"
          endSubMessage="새로운 영상이 올라오면 여기서 만나볼 수 있어요."
          onActivePosterChange={setActivePosterUrl}
        />
      </div>
      {bottomFill}
    </>
  );
};

export default Flicks;
