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
      // 트렌딩 풀에서 영상이 포함된 포스트만 추출
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

      // 영상 있는 포스트만 + 광고/차단 사용자 제외 → 셔플
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

  // ReelsViewer를 닫으면 이전 페이지(보통 메인)로 돌아감
  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // 로딩 또는 빈 풀
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[9998] bg-black flex flex-col items-center justify-center gap-3 text-white">
        <Clapperboard className="w-10 h-10 text-white/80" />
        <Loader2 className="w-6 h-6 animate-spin text-white/80" />
        <span className="text-xs font-bold tracking-wider text-white/70">FLICKS 불러오는 중…</span>
      </div>
    );
  }

  if (videoPool.length === 0) {
    return (
      <div className="fixed inset-0 z-[9998] bg-black flex flex-col items-center justify-center gap-3 text-white px-10 text-center">
        <Clapperboard className="w-12 h-12 text-white/70" />
        <p className="text-base font-black tracking-tight">아직 재생할 영상이 없어요</p>
        <p className="text-xs font-bold text-white/60 leading-relaxed">
          인기 포스팅에 영상이 등록되면<br />여기서 풀스크린으로 즐길 수 있어요.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-5 h-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white text-sm font-black active:scale-95 transition-transform"
        >
          돌아가기
        </button>
      </div>
    );
  }

  // 영상 풀에서 첫 포스트로 시작 (이미 셔플되어 있음)
  return (
    <ReelsViewer
      isOpen={true}
      initialPost={videoPool[0]}
      pool={videoPool}
      onClose={handleClose}
      noRepeat
      endMessage="더 이상 표시할 영상이 없습니다"
      endSubMessage="새로운 영상이 올라오면 여기서 만나볼 수 있어요."
    />
  );
};

export default Flicks;
