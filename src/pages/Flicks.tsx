"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clapperboard } from 'lucide-react';
import { Post } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage } from '@/lib/utils';
import ReelsViewer from '@/components/ReelsViewer';

const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

// ReelsViewer 내부와 동일한 영상 URL 판별
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.avi') ||
    lower.endsWith('.m4v')
  );
};

const hasVideo = (p: Post): boolean => {
  if (p.videoUrl) return true;
  if (isVideoUrl(p.image_url) || isVideoUrl(p.image)) return true;
  if (Array.isArray(p.images) && p.images.some((u) => isVideoUrl(u))) return true;
  return false;
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

// 화면 viewport 중 Flicks 콘텐츠가 차지할 영역
// Header (fixed top, safe-top + 64px) 와 BottomNav (fixed bottom, safe-bottom + 64px) 사이를 정확히 채움.
// position: fixed 로 viewport 좌표 기준 배치하여, 본문 흐름에 영향 받지 않고
// 위/아래에서 잘리거나 빈 공간이 생기지 않도록 함.
const CONTENT_FIXED_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
};

// Floating BottomNav 뒤로 비치는 흰색 배경을 가리기 위한 풀스크린 검은 레이어.
// Flicks 페이지의 분위기와 자연스럽게 이어지도록 헤더 아래부터 화면 끝까지 검정으로 채운다.
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

const Flicks = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { blockedIds } = useBlockedUsers();
  const [videoPool, setVideoPool] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoaded = useRef(false);

  const fetchVideoPool = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_trending_posts', { limit_count: 200 });
      if (error) throw error;

      const mapped: Post[] = (data || []).map((p: any) => {
        const followers = Number(p.profiles?.followers ?? 0);
        const borderType = p.hot_since ? 'popular' : getTierFromFollowers(followers);
        const isAd = p.content?.trim().startsWith('[AD]');
        const finalImage = p.image_url || getFallbackImage(String(p.id));
        const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];
        return {
          id: p.id,
          isAd,
          isGif: false,
          isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
          user: { id: p.user_id, name: p.user_name, avatar: p.user_avatar },
          content: p.content?.replace(/^\[AD\]\s*/, '') || '',
          location: p.location_name,
          lat: p.latitude,
          lng: p.longitude,
          likes: Number(p.likes || 0),
          commentsCount: 0,
          comments: [],
          image: finalImage,
          image_url: finalImage,
          images: finalImages,
          latitude: p.latitude,
          longitude: p.longitude,
          videoUrl: p.video_url,
          isLiked: false,
          isSaved: false,
          createdAt: new Date(p.created_at),
          borderType: borderType as any,
          category: p.category || 'none',
        };
      });

      const videosOnly = mapped.filter(
        (p) => !p.isAd && hasVideo(p) && p.user && !blockedIds.has(p.user.id)
      );

      setVideoPool(shuffle(videosOnly));
    } catch (err) {
      console.error('[Flicks] failed to load video pool', err);
      setVideoPool([]);
    } finally {
      setIsLoading(false);
    }
  }, [blockedIds]);

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

  // Flicks 페이지를 떠날 때(또는 진입 시) BottomNav가 숨겨진 상태로 남지 않도록 reset.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('bottom-nav-visibility', { detail: { direction: 'reset' } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('bottom-nav-visibility', { detail: { direction: 'reset' } })
      );
    };
  }, []);

  // 사용되지 않는 닫기 콜백(embedded에서는 호출되지 않지만 prop 시그니처 충족용)
  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ReelsViewer 내부에서 내 포스팅 삭제/수정이 일어났을 때 풀 갱신
  const handlePostDeleted = useCallback((postId: string) => {
    setVideoPool((prev) => prev.filter((p) => p.id !== postId));
  }, []);
  const handlePostUpdated = useCallback((postId: string, content: string) => {
    setVideoPool((prev) => prev.map((p) => (p.id === postId ? { ...p, content } : p)));
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
              인기 포스팅에 영상이 등록되면<br />여기서 풀스크린으로 즐길 수 있어요.
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
    </>
  );
};

export default Flicks;
