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
import { getDiverseUnsplashUrl } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { postDraftStore } from '@/utils/post-draft-store';
import { toggleLikeInDb } from '@/utils/like-utils';
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

  // [Fix] 언마운트 시 confetti interval/timeout 정리용 ref (메모리 누수 방지)
  const confettiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerConfetti = useCallback(() => {
    try {
      // 이전 confetti가 진행 중이면 정리 후 재시작
      if (confettiIntervalRef.current) clearInterval(confettiIntervalRef.current);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);

      fireConfetti({ particleCount: 80, spread: 60, origin: { y: 0.65 }, zIndex: 999999, colors: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#22d3ee'], scalar: 1.0 });
      const duration = 1.2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 25, spread: 360, ticks: 60, zIndex: 999999, scalar: 0.8 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      confettiIntervalRef.current = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          if (confettiIntervalRef.current) {
            clearInterval(confettiIntervalRef.current);
            confettiIntervalRef.current = null;
          }
          return;
        }
        const particleCount = 20 * (timeLeft / duration);
        fireConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#4F46E5', '#F59E0B'] });
        fireConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#10B981', '#EF4444'] });
      }, 300);
      const pieces = Array.from({ length: 25 }).map((_, i) => ({ id: i, left: `${Math.random() * 100}%`, delay: `${Math.random() * 1.5}s`, color: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#22d3ee'][Math.floor(Math.random() * 5)] }));
      setConfettiPieces(pieces);
      setShowCssConfetti(true);
      confettiTimeoutRef.current = setTimeout(() => {
        setShowCssConfetti(false);
        confettiTimeoutRef.current = null;
      }, 3000);
    } catch (e) {}
  }, []);

  // 언마운트 시 진행 중이던 confetti interval/timeout 정리
  useEffect(() => {
    return () => {
      if (confettiIntervalRef.current) clearInterval(confettiIntervalRef.current);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    };
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
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 6);

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
  // [Optimized] profile state는 사용되지 않아 제거 (AuthProvider가 이미 관리)

  const highlightTimeoutRef = useRef<number | null>(null);
  const throttleTimer = useRef<any>(null);
  const fetchingRef = useRef(false);
  const mapDataRef = useRef<any>(null);
  const spreadMarkersRef = useRef<Post[]>([]);
  const currentZoomRef = useRef<number>(mapCache.lastZoom || 6);
  // posts 실시간 구독 제거에 따라 channelIdRef / triggerConfettiRef는 더 이상 필요하지 않음

  // 트렌딩/bounds fetch 캐싱 및 중복 호출 방지용 ref
  const trendingFetchedAtRef = useRef<number>(0);
  const lastBoundsKeyRef = useRef<string>('');

  // [Optimized] profile fetch 제거 — AuthProvider에서 이미 관리하며, Index.tsx에서는 사용처가 없음

  // ── 포스트 매핑 헬퍼 ────────────────────────────────────────
  // [Optimized] bounds fetch에서 일부 컬럼이 빠진 raw도 안전하게 처리.
  // 빠진 필드는 기존 allPosts의 동일 id 데이터를 우선 사용하고, 없으면 기본값.
  const mapRawToPost = (p: any, prev?: Post | null): Post => {
    const content = p.content !== undefined ? (p.content || '') : (prev?.content ?? '');
    const isAd = content.trim().startsWith('[AD]') || prev?.isAd || false;
    const likes = Number(p.likes ?? prev?.likes ?? 0);
    let borderType: any = 'none';
    if (likes >= 9000) borderType = 'popular';
    else if (!isAd) {
      let h = 0;
      const s = String(p.id);
      for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
      const v = Math.abs(h % 1000) / 1000;
      if (v < 0.03) borderType = 'diamond';
      else if (v < 0.08) borderType = 'gold';
      else if (v < 0.15) borderType = 'silver';
    }
    // profiles JOIN이 있으면 그것을 우선, 없으면 raw의 user_name/user_avatar, 그것도 없으면 prev 유지
    const userName = p.profiles?.nickname || p.user_name || prev?.user?.name || '탐험가';
    const userAvatar = p.profiles?.avatar_url || p.user_avatar || prev?.user?.avatar || `https://i.pravatar.cc/150?u=${p.user_id}`;
    let img = p.image_url ?? prev?.image_url ?? '';

    // [AD 보정] 광고 포스트는 영상/유튜브 썸네일/빈 이미지를 모두 무시하고
    // 안정적인 음식 사진 풀에서 ID 해시 기반으로 대체한다. (영상으로 표시되는 사고 방지)
    const isYoutubeThumb = typeof img === 'string' && img.includes('img.youtube.com');
    if (isAd && (!img || isYoutubeThumb)) {
      img = getDiverseUnsplashUrl(`ad:${p.id}`, 'food');
    }

    const rawImages = p.images || prev?.images || (img ? [img] : []);
    const images = isAd ? [img] : rawImages;
    const youtubeUrl = isAd ? undefined : (p.youtube_url ?? prev?.youtubeUrl);
    const videoUrl = isAd ? undefined : (p.video_url ?? prev?.videoUrl);

    return {
      id: p.id,
      user_id: p.user_id || prev?.user_id || '',
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: { id: p.user_id || prev?.user?.id || '', name: userName, avatar: userAvatar },
      content: content.replace(/^\[AD\]\s*/, ''),
      location: p.location_name ?? prev?.location ?? '알 수 없는 장소',
      lat: p.latitude ?? prev?.lat,
      lng: p.longitude ?? prev?.lng,
      latitude: p.latitude ?? prev?.latitude,
      longitude: p.longitude ?? prev?.longitude,
      likes,
      commentsCount: prev?.commentsCount ?? 0,
      comments: prev?.comments ?? [],
      image: img,
      image_url: img,
      images,
      isLiked: prev?.isLiked ?? false,
      youtubeUrl,
      videoUrl,
      category: isAd ? 'food' : (p.category ?? prev?.category ?? 'none'),
      createdAt: p.created_at ? new Date(p.created_at) : (prev?.createdAt ?? new Date()),
      borderType,
      is_seed_data: p.is_seed_data ?? prev?.is_seed_data,
    };
  };

  // ── 트렌딩 fetch ─────────────────────────────────────────────
  // [Optimized] 컬럼 축소(JOIN 제거), 60초 캐싱
  const fetchGlobalTrending = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - trendingFetchedAtRef.current < 60_000 && globalTrendingPosts.length > 0) {
      return; // 60초 이내 호출이면 스킵
    }
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, location_name, likes, category, youtube_url, video_url, latitude, longitude, created_at, user_id, user_name, user_avatar')
        .order('likes', { ascending: false })
        .limit(20);
      if (!error && data) {
        const mapped = data.map(p => mapRawToPost(p));
        const trending = mapped.slice(0, 20).map((p, i) => ({ ...p, rank: i + 1 }));
        setGlobalTrendingPosts(trending);
        trendingFetchedAtRef.current = now;
      }
    } catch (err) {
      console.error('[Trending] fetch error:', err);
    }
  }, [globalTrendingPosts.length]);

  useEffect(() => { fetchGlobalTrending(); }, []);

  // ── 핵심: bounds가 바뀔 때마다 해당 영역 포스트 fetch ──────
  useEffect(() => {
    if (!mapData?.bounds) return;
    if (currentZoom >= 11) return;

    const { sw, ne } = mapData.bounds;
    const center = mapData.center;

    // [Optimized] bounds 변화량이 작으면 fetch 스킵
    // 소수점 2자리(약 1.1km) 단위로 반올림 → 지도를 조금 움직여도 fetch 안 함
    const boundsKey = `${sw.lat.toFixed(2)}|${sw.lng.toFixed(2)}|${ne.lat.toFixed(2)}|${ne.lng.toFixed(2)}|${currentZoom}`;
    if (boundsKey === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = boundsKey;

    // 이전 fetch 취소용 플래그
    let cancelled = false;

    const doFetch = async () => {
      try {
        const raw = await fetchPostsInBounds(sw, ne, currentZoom, center);
        if (cancelled) return;
        if (raw.length === 0) return;

        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          raw.forEach(r => {
            const prevPost = existingMap.get(r.id) || null;
            existingMap.set(r.id, mapRawToPost(r, prevPost));
          });
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
    if (currentZoom >= 7) {
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
      const isInfluencer = post.isInfluencer || ['silver', 'gold', 'diamond'].includes(post.borderType || '');
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
      if (p.borderType === 'silver') return 3;
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

  // spreadMarkers가 바뀔 때마다 ref 동기화 (focusPostOnMap에서 분산 좌표 참조용)
  useEffect(() => {
    spreadMarkersRef.current = spreadMarkers;
  }, [spreadMarkers]);

  // currentZoom ref 동기화
  useEffect(() => {
    currentZoomRef.current = currentZoom;
  }, [currentZoom]);

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
    // 줌 레벨은 즉시 업데이트 → 레벨 7 전환 시 마커가 잠깐 보이는 버그 방지
    if (data.level !== undefined) {
      setCurrentZoom(data.level);
      currentZoomRef.current = data.level;
      mapCache.lastZoom = data.level;
    }
    throttleTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
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

    // 이전 타이머/리스너 취소
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);

    // spreadMarkers에서 분산된 실제 표시 좌표를 찾아 그 위치로 지도 이동
    // 없으면 원래 좌표 사용 (마커가 아직 렌더링 안 된 경우)
    const spreadPost = spreadMarkersRef.current.find(p => p.id === post.id);
    const targetCenter = spreadPost
      ? { lat: spreadPost.lat, lng: spreadPost.lng }
      : (center || { lat: post.lat, lng: post.lng });

    setMapCenter(targetCenter);

    // 지도 이동 완료 이벤트를 받아서 핑 효과 발생
    const handleMoveComplete = () => {
      window.removeEventListener('map-move-complete', handleMoveComplete);
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
      window.dispatchEvent(new CustomEvent('highlight-marker', { detail: { id: post.id, duration: 2500 } }));
      highlightTimeoutRef.current = null;
    };
    window.addEventListener('map-move-complete', handleMoveComplete);

    // 안전장치: 2초 후에도 이벤트가 안 오면 강제 실행
    highlightTimeoutRef.current = window.setTimeout(() => {
      window.removeEventListener('map-move-complete', handleMoveComplete);
      window.dispatchEvent(new CustomEvent('highlight-marker', { detail: { id: post.id, duration: 2500 } }));
      highlightTimeoutRef.current = null;
    }, 2000);
  }, []);

  // ── 마커 클릭 ────────────────────────────────────────────────
  const handleMarkerClick = useCallback(async (lightPost: Post) => {
    setSelectedPostId(lightPost.id);
    try {
      // [Optimized] select('*') → 필요한 컬럼만. profiles JOIN은 상세 진입 시점이므로 유지
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar, is_seed_data, profiles:user_id(nickname, avatar_url)')
        .eq('id', lightPost.id)
        .single();
      if (!error && data) {
        setAllPosts(prev => {
          const idx = prev.findIndex(p => p.id === data.id);
          const prevPost = idx === -1 ? null : prev[idx];
          const full = mapRawToPost(data, prevPost);
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
    await fetchGlobalTrending(true); // 강제 새로고침

    if (currentMapData?.bounds) {
      const { sw, ne } = currentMapData.bounds;
      const zoom = currentMapData.level ?? 6;
      const center = currentMapData.center;

      // 새로고침은 캐시 무시
      lastBoundsKeyRef.current = '';

      const raw = await fetchPostsInBounds(sw, ne, zoom, center);
      if (raw.length > 0) {
        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          raw.forEach(r => {
            const prevPost = existingMap.get(r.id) || null;
            existingMap.set(r.id, mapRawToPost(r, prevPost));
          });
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
      // 모바일(Capacitor)에서는 권한 확인 후 필요 시 요청
      let hasPermission = true;
      try {
        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location === 'denied') {
          dismissToast(toastId);
          showError('위치 권한이 거부되었습니다. 기기 설정에서 위치 권한을 허용해주세요.');
          if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
          return;
        }
        if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
          const requested = await Geolocation.requestPermissions();
          if (requested.location === 'denied') {
            dismissToast(toastId);
            showError('위치 권한이 거부되었습니다. 기기 설정에서 위치 권한을 허용해주세요.');
            if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
            return;
          }
        }
      } catch {
        // 웹 환경에서는 checkPermissions가 지원되지 않을 수 있으므로 무시
        hasPermission = true;
      }

      if (!hasPermission) return;

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
      if (pos?.coords) {
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        dismissToast(toastId);
        showSuccess('현재 위치로 이동했습니다.');
      }
    } catch (err: any) {
      dismissToast(toastId);
      // 에러 코드별 메시지 분기
      const code = err?.code ?? err?.message ?? '';
      if (String(code).includes('1') || String(code).toLowerCase().includes('denied') || String(code).toLowerCase().includes('permission')) {
        showError('위치 권한이 없습니다. 기기 설정에서 위치 권한을 허용해주세요.');
      } else if (String(code).includes('3') || String(code).toLowerCase().includes('timeout')) {
        showError('위치 확인 시간이 초과되었습니다. GPS를 켜고 다시 시도해주세요.');
      } else {
        showError('위치 정보를 가져올 수 없습니다. GPS 및 위치 권한을 확인해주세요.');
      }
      if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
    }
  };

  // ── 좋아요 토글 ──────────────────────────────────────────────
  const handleLikeToggle = useCallback((postId: string) => {
    if (!authUser?.id) return;
    // Optimistic UI: 즉시 상태 반영
    let currentlyLiked = false;
    const updater = (p: Post) => {
      if (p.id !== postId) return p;
      currentlyLiked = p.isLiked;
      return { ...p, isLiked: !p.isLiked, likes: !p.isLiked ? p.likes + 1 : p.likes - 1 };
    };
    setAllPosts(prev => prev.map(updater));
    setGlobalTrendingPosts(prev => prev.map(updater));
    // DB 쓰기 (트리거가 posts.likes 자동 동기화)
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        // 실패 시 롤백
        const rollback = (p: Post) => p.id === postId
          ? { ...p, isLiked: currentlyLiked, likes: currentlyLiked ? p.likes + 1 : p.likes - 1 }
          : p;
        setAllPosts(prev => prev.map(rollback));
        setGlobalTrendingPosts(prev => prev.map(rollback));
      }
    });
  }, [authUser?.id]);

  // ── 포스트 삭제 ──────────────────────────────────────────────
  const handlePostDeleted = useCallback((id: string) => {
    setSelectedPostId(null);
    window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id } }));
    setTimeout(() => {
      setAllPosts(prev => { const f = prev.filter(p => p.id !== id); mapCache.posts = f; return f; });
    }, 400);
  }, []);

  // ── posts 실시간 구독은 제거되었습니다 ─────────────────────────
  // 이유: 4,559+ row 테이블의 INSERT/DELETE 이벤트를 모든 클라이언트에
  // fan-out하는 것은 Realtime 서버에 큰 부하(thread killed by timeout)를 유발.
  // 새 글/삭제는 지도 이동, 재검색 버튼, 또는 글 작성 후 navigate state로
  // 자연스럽게 반영되므로 실시간 구독이 불필요합니다.
  // (confetti는 Write.tsx → navigate state.triggerConfetti 경로로 정상 동작)

  // ── 이벤트 리스너들 ──────────────────────────────────────────
  useEffect(() => {
    const handleFocusPost = (e: any) => {
      const { post, lat, lng } = e.detail;
      setIsPostListOpen(false);
      handleMarkerClick(post);
      // 오버레이 닫힘 애니메이션(350ms) 완료 후 지도 이동 시작
      setTimeout(() => {
        focusPostOnMap(post, { lat, lng });
      }, 400);
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

    // 트렌딩 포스트가 allPosts에 없으면 먼저 추가 (bounds 밖 포스트도 마커로 표시되도록)
    setAllPosts(prev => {
      if (prev.some(p => p.id === post.id)) return prev;
      const combined = [post, ...prev];
      mapCache.posts = combined;
      return combined;
    });

    // 줌 레벨 7 이상이면 마커가 숨겨지므로 6으로 강제 변경
    const needsZoomChange = currentZoomRef.current >= 7;
    if (needsZoomChange) {
      setCurrentZoom(6);
      currentZoomRef.current = 6;
    }

    // TrendingPosts 패널 닫힘(500ms) + 줌 변경 시 마커 렌더링 대기(추가 300ms)
    const delay = needsZoomChange ? 900 : 700;
    setTimeout(() => {
      focusPostOnMap(post, { lat: post.lat, lng: post.lng });
    }, delay);
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
              <div
                style={{ bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 8px)' }}
                className={cn("absolute left-4 z-20 flex flex-col gap-2 transition-opacity", isTrendingExpanded && "opacity-20 pointer-events-none")}
              >
                <button onClick={() => setIsCategoryOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Layers className="w-6 h-6" /></button>
                <button onClick={() => setIsSearchOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Search className="w-6 h-6" /></button>
                <button onClick={handleCurrentLocation} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Navigation className="w-6 h-6 fill-white" /></button>
              </div>

              <div
                style={{ bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 8px)' }}
                className={cn("absolute right-4 z-20 flex flex-col items-center gap-4 transition-opacity", isTrendingExpanded && "opacity-20 pointer-events-none")}
              >
                <button onClick={handleRefresh} disabled={isRefreshing} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100">
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} />
                  <span className="text-[9px] font-black mt-1">재검색</span>
                </button>
                <div className="relative">
                  {visibleMarkers.length > 0 && currentZoom < 7 && <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />}
                  <button
                    onClick={() => { if (visibleMarkers.length > 0 && currentZoom < 7) setIsPostListOpen(true); }}
                    disabled={currentZoom >= 7 || visibleMarkers.length === 0}
                    className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 overflow-hidden relative", (currentZoom >= 7 || visibleMarkers.length === 0) && "opacity-50 grayscale bg-slate-800/40 shadow-none")}
                  >
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
                    <span className="text-[10px] font-black mt-1 relative z-10">여기 보기</span>
                  </button>
                  {visibleMarkers.length > 0 && currentZoom < 7 && (
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
        {isTrendingExpanded && !isPostListOpen && !isSearchOpen && (
          <motion.div
            key="trending-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[49] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setIsTrendingExpanded(false)}
          >
            <div className="absolute left-0 right-0 flex flex-col items-center gap-2 pointer-events-none select-none" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>              
              <span className="text-white/80 text-sm font-bold tracking-tight drop-shadow-md">여기를 눌러 닫기</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "fixed top-[calc(env(safe-area-inset-top,0px)+74px)] left-4 right-4 z-[50] pointer-events-none transition-all duration-300",
          isCategoryOpen && "opacity-50 blur-[1px]",
          (isPostListOpen || isSearchOpen) && "invisible pointer-events-none"
        )}
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <TrendingPosts
            posts={globalTrendingPosts}
            onPostClick={handleTrendingPostClick}
            isExpanded={isTrendingExpanded}
            onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
          />
        </div>
      </div>

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