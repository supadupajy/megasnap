"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import PlaceSearch from '@/components/PlaceSearch';
import CategoryMenu from '@/components/CategoryMenu';
import PostListOverlay from '@/components/PostListOverlay';
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Check, X } from 'lucide-react';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { postDraftStore } from '@/utils/post-draft-store';
import confetti from 'canvas-confetti';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

const fireConfetti = (options: any) => {
  try {
    const f = (window as any).confetti || confetti;
    if (f) f(options);
  } catch (e) {}
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, session } = useAuth();

  const [showCssConfetti, setShowCssConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<any[]>([]);

  const triggerConfetti = useCallback(() => {
    try {
      fireConfetti({ particleCount: 80, spread: 60, origin: { y: 0.65 }, zIndex: 999999, colors: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#22d3ee'], scalar: 1.0 });
      const duration = 1.2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 25, spread: 360, ticks: 60, zIndex: 999999, scalar: 0.8 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 20 * (timeLeft / duration);
        fireConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#4F46E5', '#F59E0B'] });
        fireConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#10B981', '#EF4444'] });
      }, 300);
      const pieces = Array.from({ length: 25 }).map((_, i) => ({ id: i, left: `${Math.random() * 100}%`, delay: `${Math.random() * 1.5}s`, color: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#22d3ee'][Math.floor(Math.random() * 5)] }));
      setConfettiPieces(pieces);
      setShowCssConfetti(true);
      setTimeout(() => setShowCssConfetti(false), 3000);
    } catch (e) {}
  }, []);

  // ── 핵심 상태 ──────────────────────────────────────────────
  // allPosts: 지금까지 fetch된 모든 포스트 (누적, 최대 5000개)
  // 캐시된 데이터는 사용하지 않고 항상 새로 fetch (좌표 오류 방지)
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [globalTrendingPosts, setGlobalTrendingPosts] = useState<Post[]>([]);
  // displayedMarkers: MapContainer에 실제로 전달되는 마커 목록
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>([]);

  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 5);

  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPostListOpen, setIsPostListOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResultLocation, setSearchResultLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const highlightTimeoutRef = useRef<number | null>(null);
  const throttleTimer = useRef<any>(null);
  const fetchingRef = useRef(false);
  const mapDataRef = useRef<any>(null);
  const channelIdRef = useRef(`posts-channel-${Math.random().toString(36).substring(7)}`);
  const triggerConfettiRef = useRef(triggerConfetti);
  useEffect(() => { triggerConfettiRef.current = triggerConfetti; }, [triggerConfetti]);

  useEffect(() => {
    if (session?.user) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [session]);

  // ── 포스트 매핑 헬퍼 ────────────────────────────────────────
  const mapRawToPost = (p: any): Post => {
    const isAd = p.content?.trim().startsWith('[AD]') || false;
    const likes = Number(p.likes || 0);
    let borderType: any = 'none';
    if (likes >= 9000) borderType = 'popular';
    else if (!isAd) {
      let h = 0;
      const s = String(p.id);
      for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
      const v = Math.abs(h % 1000) / 1000;
      if (v < 0.03) borderType = 'diamond';
      else if (v < 0.08) borderType = 'gold';
    }
    const isSeed = p.is_seed_data === true || p.is_seed_data === 'true';
    // profiles.nickname이 있으면 항상 우선 사용 (시드 데이터도 실제 유저 ID로 연결될 수 있음)
    // profiles.nickname이 없을 때만 posts.user_name 사용
    const userName = p.profiles?.nickname || p.user_name || '탐험가';
    const userAvatar = p.profiles?.avatar_url || p.user_avatar || '';
    const img = p.image_url || '';
    return {
      id: p.id,
      user_id: p.user_id || '',
      isAd,
      isGif: false,
      isInfluencer: ['gold', 'diamond'].includes(borderType),
      user: { id: p.user_id || '', name: userName, avatar: userAvatar },
      content: (p.content || '').replace(/^\[AD\]\s*/, ''),
      location: p.location_name || '알 수 없는 장소',
      lat: p.latitude,
      lng: p.longitude,
      latitude: p.latitude,
      longitude: p.longitude,
      likes,
      commentsCount: 0,
      comments: [],
      image: img,
      image_url: img,
      images: p.images || (img ? [img] : []),
      isLiked: false,
      youtubeUrl: p.youtube_url,
      videoUrl: p.video_url,
      category: p.category || 'none',
      createdAt: new Date(p.created_at),
      borderType,
      is_seed_data: p.is_seed_data,
    };
  };

  // ── 트렌딩 fetch ─────────────────────────────────────────────
  const fetchGlobalTrending = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, location_name, likes, category, youtube_url, video_url, latitude, longitude, created_at, user_id, user_name, user_avatar, is_seed_data, borderType, profiles:user_id(nickname, avatar_url)')
        .order('likes', { ascending: false })
        .limit(20);
      if (!error && data) {
        const mapped = data.map(mapRawToPost);
        const trending = mapped.slice(0, 20).map((p, i) => ({ ...p, rank: i + 1 }));
        setGlobalTrendingPosts(trending);
      }
    } catch (err) {
      console.error('[Trending] fetch error:', err);
    }
  }, []);

  useEffect(() => { fetchGlobalTrending(); }, []);

  // ── 핵심: bounds가 바뀔 때마다 해당 영역 포스트 fetch ──────
  useEffect(() => {
    if (!mapData?.bounds) return;
    if (currentZoom >= 11) return;

    const { sw, ne } = mapData.bounds;
    const center = mapData.center;

    // 이전 fetch 취소용 플래그
    let cancelled = false;

    const doFetch = async () => {
      try {
        const raw = await fetchPostsInBounds(sw, ne, currentZoom, center);
        if (cancelled) return;
        if (raw.length === 0) return;

        const mapped = raw.map(mapRawToPost);
        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          mapped.forEach(p => existingMap.set(p.id, p));
          const combined = Array.from(existingMap.values()).slice(0, 5000);
          mapCache.posts = combined;
          return combined;
        });
      } catch (err) {
        if (!cancelled) console.error('[Index] fetch error:', err);
      }
    };

    doFetch();

    return () => { cancelled = true; };
  }, [mapData?.bounds?.sw?.lat, mapData?.bounds?.sw?.lng, mapData?.bounds?.ne?.lat, mapData?.bounds?.ne?.lng, currentZoom]);

  // ── displayedMarkers: allPosts에서 카테고리 필터만 적용 ──────
  // bounds 필터 없음 - 카카오 CustomOverlay가 화면 밖 마커를 자동으로 숨김
  useEffect(() => {
    if (currentZoom >= 11) {
      setDisplayedMarkers([]);
      return;
    }

    const filtered = allPosts.filter(post => {
      if (!post || post.lat == null || post.lng == null) return false;
      if (blockedIds.has(post.user?.id)) return false;

      if (selectedCategories.includes('mine')) {
        return !!(authUser && post.user?.id === authUser.id);
      }
      if (selectedCategories.includes('all')) return true;

      const isHot = post.borderType === 'popular' || post.likes >= 9000;
      const isInfluencer = post.isInfluencer || ['gold', 'diamond'].includes(post.borderType || '');
      return selectedCategories.includes(post.category || 'none') ||
        (selectedCategories.includes('hot') && isHot) ||
        (selectedCategories.includes('influencer') && isInfluencer) ||
        post.isAd;
    });

    // 중복 제거
    const unique = Array.from(new Map(filtered.map(p => [p.id, p])).values());
    setDisplayedMarkers(unique);
  }, [allPosts, selectedCategories, blockedIds, authUser, currentZoom]);

  // ── 줌 레벨별 마커 겹침 방지 분산 ──────────────────────────
  // 줌 레벨에 따라 마커 1개가 차지하는 지리적 거리(도 단위)를 계산하여
  // 너무 가까운 마커들을 방사형으로 분산시킴
  const spreadMarkers = useMemo(() => {
    if (displayedMarkers.length === 0) return displayedMarkers;

    // 줌 레벨별 마커 60px이 차지하는 위도/경도 거리 (카카오 지도 기준)
    // level 5: 1px ≈ 0.000135도, 60px ≈ 0.0081도 (약 900m)
    // level 6: 1px ≈ 0.00027도,  60px ≈ 0.0162도
    // level 7: 1px ≈ 0.00054도,  60px ≈ 0.0324도
    const minDistByLevel: Record<number, number> = {
      1: 0.0010, 2: 0.0015, 3: 0.0020, 4: 0.0040,
      5: 0.0065, // 약 720m - 마커 크기보다 약간 작게 (살짝 겹쳐도 OK)
      6: 0.0090, // 줌아웃 시 더 넓게
      7: 0.0150,
    };
    const minDist = minDistByLevel[currentZoom] ?? 0.0065;

    // 중요도 순 정렬 (중요한 마커가 원래 위치 유지)
    const priority = (p: Post) => {
      if (p.borderType === 'diamond') return 5;
      if (p.borderType === 'gold') return 4;
      if (p.borderType === 'popular') return 3;
      if (p.isAd) return 2;
      return 1;
    };
    const sorted = [...displayedMarkers].sort((a, b) => priority(b) - priority(a));

    // 그리드 기반 빠른 겹침 감지 + 분산
    const placed: { lat: number; lng: number; id: string }[] = [];
    const result: Post[] = [];

    for (const post of sorted) {
      let lat = post.lat;
      let lng = post.lng;

      // 이미 배치된 마커들과 겹치는지 확인
      let attempts = 0;
      const maxAttempts = 8;
      while (attempts < maxAttempts) {
        const conflict = placed.find(p => {
          const dlat = Math.abs(p.lat - lat);
          const dlng = Math.abs(p.lng - lng);
          return dlat < minDist && dlng < minDist * 1.3; // 경도는 위도보다 약간 넓게
        });

        if (!conflict) break;

        // 충돌 시 방사형으로 밀어냄 (8방향 순환)
        const angle = (attempts * Math.PI * 2) / maxAttempts;
        lat = post.lat + Math.cos(angle) * minDist * 0.9;
        lng = post.lng + Math.sin(angle) * minDist * 1.1;
        attempts++;
      }

      placed.push({ lat, lng, id: post.id });
      result.push(lat === post.lat && lng === post.lng
        ? post
        : { ...post, lat, lng }
      );
    }

    return result;
  }, [displayedMarkers, currentZoom]);

  // ── visibleMarkers: 현재 지도 bounds 안에 있는 마커만 ──────
  // spreadMarkers의 분산된 좌표 기준으로 필터링해야 실제 화면과 일치함
  const visibleMarkers = useMemo(() => {
    if (!mapData?.bounds) return spreadMarkers;
    const { sw, ne } = mapData.bounds;
    return spreadMarkers.filter(p =>
      p.lat >= sw.lat && p.lat <= ne.lat &&
      p.lng >= sw.lng && p.lng <= ne.lng
    );
  }, [spreadMarkers, mapData?.bounds]);

  // ── 지도 변경 핸들러 ─────────────────────────────────────────
  const handleMapChange = useCallback((data: any) => {
    if (throttleTimer.current) clearTimeout(throttleTimer.current);
    // ref는 즉시 업데이트 (throttle 없이) → handleRefresh가 항상 최신 bounds 참조 가능
    mapDataRef.current = data;
    throttleTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
      if (data.level !== undefined) {
        setCurrentZoom(data.level);
        mapCache.lastZoom = data.level;
      }
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      throttleTimer.current = null;
    }, 800);
  }, [isSelectingLocation]);

  // ── 포스트 포커스 ────────────────────────────────────────────
  const focusPostOnMap = useCallback((post: Post, center?: { lat: number; lng: number }) => {
    if (post.lat == null || post.lng == null) return;

    setAllPosts(prev => {
      if (prev.some(p => p.id === post.id)) return prev;
      const combined = [post, ...prev];
      mapCache.posts = combined;
      return combined;
    });

    setSelectedPostId(null);
    setSearchResultLocation(null);

    // 이전 타이머 취소
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);

    setMapCenter(center || { lat: post.lat, lng: post.lng });

    // 지도 이동 후 핑 효과 (1회만)
    highlightTimeoutRef.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('highlight-marker', { detail: { id: post.id, duration: 2500 } }));
      highlightTimeoutRef.current = null;
    }, 800);
  }, []);

  // ── 마커 클릭 ────────────────────────────────────────────────
  const handleMarkerClick = useCallback(async (lightPost: Post) => {
    setSelectedPostId(lightPost.id);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:user_id(nickname, avatar_url)')
        .eq('id', lightPost.id)
        .single();
      if (!error && data) {
        const full = mapRawToPost({
          ...data,
          // profiles 조인 결과를 그대로 전달 → mapRawToPost에서 isSeed 여부에 따라 올바르게 처리
        });
        setAllPosts(prev => {
          const idx = prev.findIndex(p => p.id === full.id);
          if (idx === -1) return [full, ...prev];
          const next = [...prev];
          next[idx] = full;
          return next;
        });
      }
    } catch (err) {
      console.error('[Index] marker click fetch error:', err);
    }
  }, []);

  // ── 새로고침 ─────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    // ref에서 최신 mapData를 읽음 → stale closure 문제 해결
    const currentMapData = mapDataRef.current;

    setIsRefreshing(true);
    await fetchGlobalTrending();

    if (currentMapData?.bounds) {
      const { sw, ne } = currentMapData.bounds;
      const zoom = currentMapData.level ?? 6;
      const center = currentMapData.center;

      const raw = await fetchPostsInBounds(sw, ne, zoom, center);
      if (raw.length > 0) {
        const mapped = raw.map(mapRawToPost);
        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          mapped.forEach(p => existingMap.set(p.id, p));
          const combined = Array.from(existingMap.values()).slice(0, 5000);
          mapCache.posts = combined;
          return combined;
        });
      }
    }

    setIsRefreshing(false);
    showSuccess('데이터를 새로고침했습니다.');
  }, [fetchGlobalTrending]);

  // ── 현재 위치 ────────────────────────────────────────────────
  const handleCurrentLocation = async () => {
    const toastId = showLoading('현재 위치를 확인 중입니다...');
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
      if (pos?.coords) {
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        dismissToast(toastId);
        showSuccess('현재 위치로 이동했습니다.');
      }
    } catch {
      dismissToast(toastId);
      showError('위치 정보를 사용할 수 없습니다. 브라우저의 위치 권한과 GPS 설정을 확인해주세요.');
      if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
    }
  };

  // ── 좋아요 토글 ──────────────────────────────────────────────
  const handleLikeToggle = useCallback((postId: string) => {
    const updater = (p: Post) => p.id === postId ? { ...p, isLiked: !p.isLiked, likes: !p.isLiked ? p.likes + 1 : p.likes - 1 } : p;
    setAllPosts(prev => prev.map(updater));
    setGlobalTrendingPosts(prev => prev.map(updater));
  }, []);

  // ── 포스트 삭제 ──────────────────────────────────────────────
  const handlePostDeleted = useCallback((id: string) => {
    setSelectedPostId(null);
    window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id } }));
    setTimeout(() => {
      setAllPosts(prev => { const f = prev.filter(p => p.id !== id); mapCache.posts = f; return f; });
    }, 400);
  }, []);

  // ── 실시간 구독 ──────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(channelIdRef.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        const newPost = mapRawToPost(payload.new);
        setAllPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev;
          const updated = [newPost, ...prev];
          mapCache.posts = updated;
          return updated;
        });
        if (payload.new.user_id === authUser?.id) triggerConfettiRef.current();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        const deletedId = payload.old.id;
        window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id: deletedId } }));
        setTimeout(() => {
          setAllPosts(prev => { const f = prev.filter(p => p.id !== deletedId); mapCache.posts = f; return f; });
        }, 450);
      })
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [authUser?.id]);

  // ── 이벤트 리스너들 ──────────────────────────────────────────
  useEffect(() => {
    const handleFocusPost = (e: any) => {
      const { post, lat, lng } = e.detail;
      setIsPostListOpen(false);
      handleMarkerClick(post);
      focusPostOnMap(post, { lat, lng });
    };
    window.addEventListener('focus-post', handleFocusPost);
    return () => window.removeEventListener('focus-post', handleFocusPost);
  }, [focusPostOnMap, handleMarkerClick]);

  useEffect(() => {
    const handleCloseOverlay = () => { if (isPostListOpen) setIsPostListOpen(false); };
    window.addEventListener('close-post-list-overlay', handleCloseOverlay);
    return () => window.removeEventListener('close-post-list-overlay', handleCloseOverlay);
  }, [isPostListOpen]);

  useEffect(() => {
    const routeState = location.state as any;
    if (!routeState) return;
    if (routeState.triggerConfetti) setTimeout(() => triggerConfetti(), 800);
    if (routeState.filterUserId === 'me') {
      setSelectedCategories(['all']);
      setTimeout(() => setCurrentZoom(5), 500);
      if (routeState.post) focusPostOnMap(routeState.post, { lat: routeState.post.lat, lng: routeState.post.lng });
      else handleCurrentLocation();
    } else if (routeState.post) {
      focusPostOnMap(routeState.post, routeState.center);
    } else if (routeState.center) {
      setSelectedPostId(null);
      setMapCenter(routeState.center);
    }
    if (routeState.startSelection) {
      setIsPostListOpen(false);
      setTimeout(() => { setIsSelectingLocation(true); setTempSelectedLocation(mapData?.center || mapCache.lastCenter); }, 500);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setIsTrendingExpanded(false);
    focusPostOnMap(post);
    // 중복 dispatch 제거 - focusPostOnMap 내부에서 이미 처리
  }, [focusPostOnMap]);

  return (
    <>
      {showCssConfetti && <div className="css-confetti-container">{confettiPieces.map(p => <div key={p.id} className="css-confetti-piece animate" style={{ left: p.left, animationDelay: p.delay, backgroundColor: p.color }} />)}</div>}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-[100dvh] overflow-hidden bg-gray-50 flex flex-col"
        style={{
          paddingTop: isSelectingLocation ? '0px' : 'env(safe-area-inset-top)',
          paddingBottom: isSelectingLocation ? '0px' : 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 z-0">
            <MapContainer
              posts={spreadMarkers}
              viewedPostIds={viewedIds}
              onMarkerClick={handleMarkerClick}
              onMapChange={handleMapChange}
              center={mapCenter}
              level={currentZoom}
              searchResultLocation={searchResultLocation}
              onMapClick={() => setSearchResultLocation(null)}
            />
          </div>

          <AnimatePresence>
            {isSelectingLocation && (
              <div className="fixed inset-0 z-[120] pointer-events-none">
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative mb-12">
                    <div className="relative w-12 h-12">
                      <div className="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl" />
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10" />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full" />
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-24 left-0 right-0 px-6 pb-[env(safe-area-inset-bottom)] pointer-events-auto"
                >
                  <div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-indigo-100 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                      <p className="text-sm font-black text-gray-900">지도를 움직여 위치를 맞추세요</p>
                    </div>
                    <div className="flex w-full gap-3">
                      <Button onClick={() => { setIsSelectingLocation(false); setTempSelectedLocation(null); setTimeout(() => navigate('/write', { state: { fromLocationSelection: true } }), 100); }} variant="secondary" className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600">
                        <X className="w-4 h-4 mr-2" /> 취소
                      </Button>
                      <Button onClick={() => { if (tempSelectedLocation) { setIsSelectingLocation(false); setTimeout(() => navigate('/write', { state: { location: tempSelectedLocation, fromLocationSelection: true } }), 100); } }} className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                        <Check className="w-4 h-4 mr-2" /> 이 위치로 선택
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {!isSelectingLocation && (
            <>
              <div className={cn("absolute bottom-20 left-4 z-20 flex flex-col gap-2 mb-[env(safe-area-inset-bottom)] transition-opacity", isTrendingExpanded && "opacity-20 pointer-events-none")}>
                <button onClick={() => setIsCategoryOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Layers className="w-6 h-6" /></button>
                <button onClick={() => setIsSearchOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Search className="w-6 h-6" /></button>
                <button onClick={handleCurrentLocation} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Navigation className="w-6 h-6 fill-white" /></button>
              </div>

              <div className={cn("absolute bottom-20 right-4 z-20 flex flex-col items-center gap-4 mb-[env(safe-area-inset-bottom)] transition-opacity", isTrendingExpanded && "opacity-20 pointer-events-none")}>
                <button onClick={handleRefresh} disabled={isRefreshing} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100">
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} />
                  <span className="text-[9px] font-black mt-1">재검색</span>
                </button>
                <div className="relative">
                  {visibleMarkers.length > 0 && currentZoom < 9 && <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />}
                  <button
                    onClick={() => { if (visibleMarkers.length > 0 && currentZoom < 9) setIsPostListOpen(true); }}
                    disabled={visibleMarkers.length === 0 || currentZoom >= 9}
                    className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 overflow-hidden relative", (visibleMarkers.length === 0 || currentZoom >= 9) && "opacity-50 grayscale bg-slate-800/40 shadow-none")}
                  >
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
                    <span className="text-[10px] font-black mt-1 relative z-10">여기 보기</span>
                  </button>
                  {visibleMarkers.length > 0 && currentZoom < 9 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">
                      {visibleMarkers.length}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} />

      <AnimatePresence>
        {!isPostListOpen && !isSearchOpen && (
          <>
            <AnimatePresence>
              {isTrendingExpanded && (
                <motion.div
                  key="trending-backdrop"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 z-[49] bg-black/40 backdrop-blur-[2px]"
                  onClick={() => setIsTrendingExpanded(false)}
                >
                  <div className="absolute bottom-28 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none select-none translate-y-6">
                    <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </div>
                    <span className="text-white/80 text-sm font-bold tracking-tight drop-shadow-md">여기를 눌러 닫기</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className={cn("fixed top-[calc(env(safe-area-inset-top,0px)+74px)] left-4 right-4 z-[50] pointer-events-none transition-all duration-300", isCategoryOpen && "opacity-50 blur-[1px]")}
            >
              <div className="max-w-md mx-auto pointer-events-auto">
                <TrendingPosts
                  posts={globalTrendingPosts}
                  onPostClick={handleTrendingPostClick}
                  isExpanded={isTrendingExpanded}
                  onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPostListOpen && (
          <PostListOverlay
            key="post-list-overlay"
            isOpen={isPostListOpen}
            onClose={() => setIsPostListOpen(false)}
            initialPosts={visibleMarkers.map(m => allPosts.find(p => p.id === m.id) || m)}
            mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
            currentBounds={mapData?.bounds || { sw: { lat: 33, lng: 124 }, ne: { lat: 39, lng: 132 } }}
            selectedCategories={selectedCategories}
            authUserId={authUser?.id}
            onDeletePost={handlePostDeleted}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPostId && (
          <PostDetail
            key="post-detail-modal"
            posts={allPosts}
            initialIndex={allPosts.findIndex(p => p.id === selectedPostId)}
            isOpen={true}
            onClose={() => setSelectedPostId(null)}
            onDelete={handlePostDeleted}
            onViewPost={markAsViewed}
            onLikeToggle={handleLikeToggle}
            onLocationClick={(lat, lng) => {
              // lat/lng로 찾으면 spreadMarkers 분산 좌표와 불일치할 수 있으므로
              // 현재 열린 포스트(selectedPostId)를 우선 사용
              const post = allPosts.find(p => p.id === selectedPostId) || allPosts.find(p => p.lat === lat && p.lng === lng);
              if (post) focusPostOnMap(post, { lat: post.lat, lng: post.lng });
              else setMapCenter({ lat, lng });
              setSelectedPostId(null);
            }}
          />
        )}
      </AnimatePresence>

      <PlaceSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={p => { setMapCenter({ lat: p.lat, lng: p.lng }); setSearchResultLocation({ lat: p.lat, lng: p.lng }); }}
      />
    </>
  );
};

export default Index;