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

// Fisher-Yates 셔플
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Flicks 페이지 컨테이너: 기본적으로 헤더와 BottomNav 사이에 표시하고,
// BottomNav가 숨겨진 상태에서는 하단 예약 공간을 제거해 빈 배경이 드러나지 않게 한다.
const CONTENT_FIXED_BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
};

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
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const hasLoaded = useRef(false);

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

  useEffect(() => {
    const handleBottomNavVisibility = (e: Event) => {
      const detail = (e as CustomEvent<{ hidden?: boolean }>).detail;
      setIsBottomNavHidden(!!detail?.hidden);
    };

    window.addEventListener('bottom-nav-visibility', handleBottomNavVisibility);
    return () => {
      window.removeEventListener('bottom-nav-visibility', handleBottomNavVisibility);
    };
  }, []);

  const contentFixedStyle: React.CSSProperties = {
    ...CONTENT_FIXED_BASE_STYLE,
    bottom: isBottomNavHidden
      ? 'env(safe-area-inset-bottom, 0px)'
      : 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
  };

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
      <div className="bg-black" style={contentFixedStyle}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white">
          <Clapperboard className="w-10 h-10 text-white/80" />
          <Loader2 className="w-6 h-6 animate-spin text-white/80" />
          <span className="text-xs font-bold tracking-wider text-white/70">FLICKS 불러오는 중…</span>
        </div>
      </div>
    );
  }

  if (videoPool.length === 0) {
    return (
      <div className="bg-black" style={contentFixedStyle}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white px-10 text-center">
          <Clapperboard className="w-12 h-12 text-white/70" />
          <p className="text-base font-black tracking-tight">아직 재생할 영상이 없어요</p>
          <p className="text-xs font-bold text-white/60 leading-relaxed">
            영상이 등록된 컨텐츠가 없습니다.<br />영상을 업로드하면 여기서 즐길 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black" style={contentFixedStyle}>
      <ReelsViewer
        isOpen={true}
        initialPost={videoPool[0]}
        pool={videoPool}
        onClose={handleClose}
        onDelete={handlePostDeleted}
        onUpdate={handlePostUpdated}
        noRepeat
        embedded
        endMessage="더 이상 표시할 영상이 없습니다"
        endSubMessage="새로운 영상이 올라오면 여기서 만나볼 수 있어요."
      />
    </div>
  );
};

export default Flicks;
