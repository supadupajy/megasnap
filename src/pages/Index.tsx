"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import PlaceSearch from '@/components/PlaceSearch';
import CategoryMenu from '@/components/CategoryMenu';
import PostListOverlay from '@/components/PostListOverlay';
import ShutterOverlay, { ShutterOverlayHandle } from '@/components/ShutterOverlay';
import OffScreenMarkerIndicator from '@/components/OffScreenMarkerIndicator';
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Check, X } from 'lucide-react';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds, fetchOffScreenCounts, DirectionCounts } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { getDiverseUnsplashUrl } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { postDraftStore } from '@/utils/post-draft-store';
import { toggleLikeInDb } from '@/utils/like-utils';
import { useMapMarkerAds, resolveActiveSlot } from '@/hooks/use-ad';
import { resolveOfflineLocationName } from '@/utils/offline-location';
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

  const MAX_VISIBLE_MARKERS = 30;

  // ── 초기 마운트 시 routeState 또는 sessionStorage에서 위치 정보 복원 ─────
  // 이렇게 하면 mapCenter 초기값이 처음부터 올바른 포스팅 위치로 설정되어
  // geolocation race condition 자체가 발생하지 않음
  const initialFocusRef = useRef<{ lat: number; lng: number; zoom?: number; post?: any } | null>(null);
  if (initialFocusRef.current === null) {
    try {
      const routeState = location.state as any;
      if (routeState?.center?.lat != null && routeState?.center?.lng != null) {
        initialFocusRef.current = {
          lat: routeState.center.lat,
          lng: routeState.center.lng,
          zoom: routeState.zoom,
          post: routeState.post,
        };
        console.log('[Index] Initial focus from routeState:', initialFocusRef.current);
      } else if (routeState?.post?.lat != null && routeState?.post?.lng != null) {
        initialFocusRef.current = {
          lat: routeState.post.lat,
          lng: routeState.post.lng,
          zoom: routeState.zoom,
          post: routeState.post,
        };
        console.log('[Index] Initial focus from routeState.post:', initialFocusRef.current);
      } else {
        const stored = sessionStorage.getItem('pendingMapFocus');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.lat != null && parsed?.lng != null) {
            initialFocusRef.current = parsed;
            console.log('[Index] Initial focus from sessionStorage:', initialFocusRef.current);
          }
        }
      }
    } catch (e) {
      console.error('[Index] initialFocusRef parse error:', e);
    }
  }

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

  const [offScreenCounts, setOffScreenCounts] = useState<DirectionCounts | null>(null);

  const [mapData, setMapData] = useState<any>(() => {
    // localStorage에 저장된 이전 bounds로 초기화 → 앱 로딩 시 인디케이터 즉시 표시
    try {
      const saved = localStorage.getItem('map_bounds');
      if (saved) {
        const bounds = JSON.parse(saved);
        return { bounds, center: mapCache.lastCenter, level: mapCache.lastZoom || 6 };
      }
    } catch {}
    return null;
  });
  // 초기 mapCenter/zoom은 항상 마지막 위치(mapCache) 사용 → 카카오맵이 이전 위치에서 시작
  // routeState로 위치가 지정된 경우 focusPostOnMap에서 setMapCenter를 호출 → 부드러운 smoothMoveTo
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 6);

  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();

  // map_marker 광고 데이터 구독 (여러 개 지원, now: 시간 전환 시 리렌더 트리거)
  const { ads: mapMarkerAds, now: mapMarkerNow } = useMapMarkerAds();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPostListOpen, setIsPostListOpen] = useState(false);
  // 오버레이가 열릴 때의 viewedIds 스냅샷 (구분선 위치 고정용)
  const [postListOpenedViewedIds, setPostListOpenedViewedIds] = useState<Set<string>>(new Set());
  // 오버레이가 열릴 때 한 번만 계산된 포스트 목록 (viewedIds 변화로 재정렬 방지)
  const [postListInitialPosts, setPostListInitialPosts] = useState<Post[]>([]);
  // 모두보기 셔터 애니메이션 - state 없이 ref로 직접 제어
  const shutterRef = useRef<ShutterOverlayHandle>(null);
  const viewAllBtnRef = useRef<HTMLButtonElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const trendingDivRef = useRef<HTMLDivElement>(null);
  const [trendingBottom, setTrendingBottom] = useState(160);
  const bottomNavHeight = 64; // BottomNav 높이(px)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const handleCategorySelect = useCallback((cats: string[]) => {
    setSelectedCategories(cats);
  }, []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSelectingAdLocation, setIsSelectingAdLocation] = useState(false);
  const [tempAdLocation, setTempAdLocation] = useState<{ lat: number; lng: number } | null>(mapCache.lastCenter || null);
  // stale closure 방지용 ref
  const isSelectingLocationRef = useRef(false);
  const isSelectingAdLocationRef = useRef(false);
  const tempAdLocationRef = useRef<{ lat: number; lng: number } | null>(mapCache.lastCenter || null);
  // 위치 선택 모드에서 throttle 없이 즉시 최신 center를 추적 (stale closure 방지)
  const tempSelectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [searchResultLocation, setSearchResultLocation] = useState<{ lat: number; lng: number } | null>(null);

  // [Optimized] profile state는 사용되지 않아 제거 (AuthProvider가 이미 관리)

  const highlightTimeoutRef = useRef<number | null>(null);
  const throttleTimer = useRef<any>(null);
  const fetchingRef = useRef(false);
  const mapDataRef = useRef<any>(null);
  const spreadMarkersRef = useRef<Post[]>([]);
  // route state로 위치가 지정된 경우 geolocation이 덮어쓰지 못하도록 보호
  // 초기 마운트 시 initialFocusRef가 있으면 즉시 잠금 (geolocation race condition 차단)
  const locationLockedRef = useRef(initialFocusRef.current !== null);

  const currentZoomRef = useRef<number>(mapCache.lastZoom || 6);

  // 트렌딩/bounds fetch 캐싱 및 중복 호출 방지용 ref
  const trendingFetchedAtRef = useRef<number>(0);
  const lastBoundsKeyRef = useRef<string>('');

  // ── 포스트 매핑 헬퍼 ────────────────────────────────────────
  const mapRawToPost = (p: any, prev?: Post | null): Post => {
    const content = p.content !== undefined ? (p.content || '') : (prev?.content ?? '');
    const isAd = content.trim().startsWith('[AD]') || prev?.isAd || false;
    const likes = Number(p.likes ?? prev?.likes ?? 0);
    let borderType: any = 'none';
    const hotSince = p.hot_since ?? prev?.hot_since ?? null;
    if (hotSince) borderType = 'popular';
    else if (!isAd) {
      const followers = Number(p.profiles?.followers ?? 0);
      if (followers >= 10000000) borderType = 'diamond';
      else if (followers >= 1000000) borderType = 'gold';
      else if (followers >= 100000) borderType = 'silver';
    }
    // profiles JOIN이 있으면 그것을 우선, 없으면 raw의 user_name/user_avatar, 그것도 없으면 prev 유지
    const userName = p.profiles?.nickname || p.user_name || prev?.user?.name || '탐험가';
    const userAvatar = p.profiles?.avatar_url || p.user_avatar || prev?.user?.avatar || `https://i.pravatar.cc/150?u=${p.user_id}`;
    // [FIX] display_user_id: 시드 데이터에서 표시용 유저 ID. 없으면 user_id(실제 소유자)
    // user.id는 화면 표시/프로필 이동용이므로 display_user_id를 우선 사용
    const displayUserId = p.display_user_id || prev?.user?.id || p.user_id || '';
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
      owner_id: p.user_id || prev?.owner_id || '', // [FIX] RLS 소유자 ID (isMine 판별용)
      display_user_id: p.display_user_id ?? prev?.display_user_id ?? null, // [FIX] 표시용 유저 ID (MapContainer isMine 판별용)
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: { id: displayUserId, name: userName, avatar: userAvatar }, // [FIX] display_user_id 우선 사용
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
      hot_since: hotSince,
      link_url: isAd ? (p.link_url ?? prev?.link_url ?? '') : undefined,
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
      const { data, error } = await supabase.rpc('get_trending_posts', { limit_count: 20 });
      if (!error && data) {
        const mapped = data.map((p: any) => ({ ...mapRawToPost(p), likes_per_hour: Number(p.likes_per_hour ?? 0) }));
        const trending = mapped.slice(0, 20).map((p: any, i: number) => ({ ...p, rank: i + 1 }));
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

    const boundsKey = `${sw.lat.toFixed(4)}|${sw.lng.toFixed(4)}|${ne.lat.toFixed(4)}|${ne.lng.toFixed(4)}|${currentZoom}`;
    if (boundsKey === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = boundsKey;

    let cancelled = false;

    const doFetch = async () => {
      try {
        // 화면 밖 포스팅도 인디케이터에 표시하기 위해 bounds를 2배로 확장해서 fetch
        const latPad = (ne.lat - sw.lat) * 0.8;
        const lngPad = (ne.lng - sw.lng) * 0.8;
        const expandedSw = { lat: sw.lat - latPad, lng: sw.lng - lngPad };
        const expandedNe = { lat: ne.lat + latPad, lng: ne.lng + lngPad };
        const raw = await fetchPostsInBounds(expandedSw, expandedNe, currentZoom, center);
        if (cancelled) return;

        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));

          // DB에서 반환된 포스트 ID 집합
          const fetchedIds = new Set(raw.map((r: any) => String(r.id)));

          // 현재 bounds 안에 있는 일반 포스트 중 DB에서 돌아오지 않은 것은 삭제된 것으로 제거
          // (광고 마커는 ads 테이블에서 별도 관리하므로 제외)
          existingMap.forEach((post, id) => {
            if (String(id).startsWith('ad-map-marker-')) return;
            if (post.lat == null || post.lng == null) return;
            const inBounds =
              post.lat >= Math.min(sw.lat, ne.lat) &&
              post.lat <= Math.max(sw.lat, ne.lat) &&
              post.lng >= Math.min(sw.lng, ne.lng) &&
              post.lng <= Math.max(sw.lng, ne.lng);
            if (inBounds && !fetchedIds.has(id)) {
              existingMap.delete(id);
            }
          });

          // DB에서 반환된 포스트 추가/갱신
          raw.forEach((r: any) => {
            if (String(r.id).startsWith('ad-map-marker-')) return;
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

  // ── 화면 밖 방향별 포스트 수 (DB COUNT 쿼리) ──────────────────
  useEffect(() => {
    if (!mapData?.bounds || currentZoom >= 7) return;
    let cancelled = false;
    fetchOffScreenCounts(mapData.bounds).then(counts => {
      if (!cancelled) setOffScreenCounts(counts);
    });
    return () => { cancelled = true; };
  }, [mapData?.bounds?.sw?.lat, mapData?.bounds?.sw?.lng, mapData?.bounds?.ne?.lat, mapData?.bounds?.ne?.lng, currentZoom]);

  // ── map_marker 광고들을 allPosts에 주입 ──────────────────────
  // ads 테이블의 ad_type='map_marker' 광고들을 모두 지도 마커로 표시.
  // 각 광고는 'ad-map-marker-{id}' 형태의 고유 ID로 관리.
  // mapMarkerNow가 바뀌면(시간 전환 타이머) 재실행되어 start/end_date 반영.
  useEffect(() => {
    const AD_POST_PREFIX = 'ad-map-marker-';

    const getLocation = (lat: number, lng: number): Promise<string> => {
      return new Promise(resolve => {
        const kakao = (window as any).kakao;
        if (!kakao?.maps?.services) {
          resolve(resolveOfflineLocationName(lat, lng));
          return;
        }
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.coord2Address(lng, lat, (result: any, status: any) => {
          if (status === kakao.maps.services.Status.OK) {
            const addr = result[0].address;
            const city = addr.region_1depth_name || '';
            const gu = addr.region_2depth_name || '';
            const dong = addr.region_3depth_name || '';
            resolve([city, gu, dong].filter(Boolean).join(' '));
          } else {
            resolve(resolveOfflineLocationName(lat, lng));
          }
        });
      });
    };

    // 현재 활성 광고 ID 목록 계산
    const activeAdIds = new Set<string>();

    const promises = mapMarkerAds.map(async (mapMarkerAd) => {
      const AD_POST_ID = `${AD_POST_PREFIX}${mapMarkerAd.id}`;

      if (!mapMarkerAd.is_active || mapMarkerAd.lat == null || mapMarkerAd.lng == null) {
        return null;
      }

      const slot = resolveActiveSlot(mapMarkerAd, mapMarkerNow);

      // 만료 후 구인 슬롯이면 마커 제거
      if (slot.isRecruitment) return null;

      // 기간 밖(image_url도 없고 isPending도 아님)이면 마커 제거
      if (!slot.image_url && !slot.isPending) return null;

      activeAdIds.add(AD_POST_ID);

      const lat = mapMarkerAd.lat!;
      const lng = mapMarkerAd.lng!;
      const locationName = await getLocation(lat, lng);

      const displayImage = slot.isPending
        ? (mapMarkerAd.brand_logo_url || mapMarkerAd.image_url || '')
        : slot.image_url;

      // 광고 시작일(start_date)이 있으면 그 날짜, 없으면 new Date(0)(1970년 = 맨 뒤)
      // updated_at은 최근 날짜일 수 있어 사용하지 않음 (모두보기 정렬 시 맨 앞에 오는 문제 방지)
      const adCreatedAt = mapMarkerAd.start_date
        ? new Date(mapMarkerAd.start_date)
        : new Date(0);

      const adPost: Post = {
        id: AD_POST_ID,
        user_id: 'ad',
        owner_id: 'ad',
        display_user_id: null,
        isAd: true,
        isAdPending: slot.isPending,
        isGif: false,
        isInfluencer: false,
        user: { id: 'ad', name: slot.brand_name || mapMarkerAd.brand_name || '광고', avatar: slot.brand_logo_url || mapMarkerAd.brand_logo_url || '' },
        content: slot.isPending ? '광고 준비 중' : (slot.title || ''),
        location: locationName,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        likes: 0,
        commentsCount: 0,
        comments: [],
        image: displayImage,
        image_url: displayImage,
        images: displayImage ? [displayImage] : [],
        isLiked: false,
        category: 'food',
        createdAt: adCreatedAt,
        borderType: 'none',
        link_url: slot.link_url || mapMarkerAd.link_url || '',
      };
      return adPost;
    });

    Promise.all(promises).then(results => {
      const newAdPosts = results.filter((p): p is Post => p !== null);
      const newAdIds = new Set(newAdPosts.map(p => p.id));

      setAllPosts(prev => {
        // 사라지는 광고 마커에 애니메이션 트리거
        prev.forEach(p => {
          if (p.id.startsWith(AD_POST_PREFIX) && !newAdIds.has(p.id)) {
            window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id: p.id } }));
          }
        });

        // 기존 ad-map-marker- 접두사 포스트 중 사라지는 것은 애니메이션 후 제거 (450ms 대기)
        const disappearingIds = prev
          .filter(p => p.id.startsWith(AD_POST_PREFIX) && !newAdIds.has(p.id))
          .map(p => p.id);

        if (disappearingIds.length > 0) {
          setTimeout(() => {
            setAllPosts(current => current.filter(p => !disappearingIds.includes(p.id)));
          }, 480);
          // 사라지는 마커는 아직 남겨두고, 새 마커만 추가
          const withoutNewAdSlots = prev.filter(p => !p.id.startsWith(AD_POST_PREFIX) || disappearingIds.includes(p.id));
          return [...newAdPosts, ...withoutNewAdSlots];
        }

        const withoutOldAds = prev.filter(p => !p.id.startsWith(AD_POST_PREFIX));
        return [...newAdPosts, ...withoutOldAds];
      });
    });
  }, [mapMarkerAds, mapMarkerNow]);

  // ── displayedMarkers: allPosts에서 카테고리 필터만 적용 ──────
  // bounds 필터 없음 - 카카오 CustomOverlay가 화면 밖 마커를 자동으로 숨김
  // 레벨 7 이상 마커 제거는 MapContainer 내부 zoom_changed 핸들러가 직접 처리하므로
  // 여기서 setDisplayedMarkers([])를 하면 줌인 시 마커 복원 타이밍 충돌이 발생함
  useEffect(() => {
    const filtered = allPosts.filter(post => {
      if (!post || post.lat == null || post.lng == null) return false;
      if (blockedIds.has(post.user?.id)) return false;

      // 광고 마커는 카테고리 필터 무관하게 항상 표시
      if (post.isAd) return true;

      if (selectedCategories.includes('mine')) {
        return !!(authUser && post.user?.id === authUser.id);
      }
      if (selectedCategories.includes('all')) return true;

      const isHot = post.borderType === 'popular';
      const isInfluencer = post.isInfluencer || ['silver', 'gold', 'diamond'].includes(post.borderType || '');
      return selectedCategories.includes(post.category || 'none') ||
        (selectedCategories.includes('hot') && isHot) ||
        (selectedCategories.includes('influencer') && isInfluencer);
    });

    // 중복 제거
    const unique = Array.from(new Map(filtered.map(p => [p.id, p])).values());
    setDisplayedMarkers(unique);
  }, [allPosts, selectedCategories, blockedIds, authUser]);

  // spreadMarkersRef를 displayedMarkers로 동기화 (focusPostOnMap에서 참조용)
  useEffect(() => {
    spreadMarkersRef.current = displayedMarkers;
  }, [displayedMarkers]);

  // 위치 선택 모드 ref 동기화 (handleMapChange stale closure 방지)
  useEffect(() => { isSelectingLocationRef.current = isSelectingLocation; }, [isSelectingLocation]);
  useEffect(() => { isSelectingAdLocationRef.current = isSelectingAdLocation; }, [isSelectingAdLocation]);

  // currentZoom ref 동기화
  useEffect(() => {
    currentZoomRef.current = currentZoom;
  }, [currentZoom]);

  // 트렌딩 포스트 div의 실제 bottom 위치 측정 (ResizeObserver)
  useEffect(() => {
    const measure = () => {
      if (trendingDivRef.current) {
        const rect = trendingDivRef.current.getBoundingClientRect();
        setTrendingBottom(rect.bottom);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trendingDivRef.current) ro.observe(trendingDivRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [isPostListOpen, isSearchOpen]);

  // ── visibleMarkers: displayedMarkers 그대로 사용 (분산 없음) ──────
  // 카카오맵 CustomOverlay는 화면 밖 마커를 자동으로 렌더링하지 않으므로
  // bounds 필터링을 React 레벨에서 하면 드래그 시 마커가 사라지는 버그 발생

  // viewport 안 전체 포스트 수 (모두보기 배지용) - 광고 포함
  // 원래 좌표 기준으로 계산 - displayedMarkers 사용
  const viewportPostCount = useMemo(() => {
    if (!mapData?.bounds) return displayedMarkers.length;
    const { sw, ne } = mapData.bounds;
    return displayedMarkers.filter(m =>
      m.lat != null && m.lng != null &&
      m.lat >= sw.lat && m.lat <= ne.lat &&
      m.lng >= sw.lng && m.lng <= ne.lng
    ).length;
  }, [displayedMarkers, mapData?.bounds]);

  // 배지 숫자: viewport 안 전체 포스트 수
  const displayedPostCount = viewportPostCount;

  // 새로고침 버튼 비활성화 조건용
  const visiblePostCount = viewportPostCount;

  // ── 지도 변경 핸들러 ─────────────────────────────────────────
  // ref를 사용해 stale closure 완전 방지
  const handleMapChange = useCallback((data: any) => {
    // mapDataRef는 즉시 업데이트 (throttle 전에도 최신값 유지)
    mapDataRef.current = data;
    if (data.level !== undefined) {
      currentZoomRef.current = data.level;
      mapCache.lastZoom = data.level;
    }
    // lastCenter는 throttle 없이 즉시 저장 (Write 페이지 이동 시 최신 좌표 보장)
    if (data.center) {
      mapCache.lastCenter = data.center;
    }
    // 위치 선택 모드일 때 즉시 ref 업데이트 (throttle 전에도 최신 좌표 보장)
    if (isSelectingLocationRef.current && data.center) {
      tempSelectedLocationRef.current = data.center;
    }
    if (isSelectingAdLocationRef.current && data.center) {
      tempAdLocationRef.current = data.center;
    }

    if (throttleTimer.current) clearTimeout(throttleTimer.current);
    throttleTimer.current = setTimeout(() => {
      // currentZoom과 mapData를 동시에 업데이트하여 bounds 불일치 방지
      if (data.level !== undefined) {
        setCurrentZoom(data.level);
      }
      setMapData(data);
      if (isSelectingLocationRef.current) setTempSelectedLocation(data.center);
      if (isSelectingAdLocationRef.current) {
        setTempAdLocation(data.center);
        tempAdLocationRef.current = data.center;
      }
      throttleTimer.current = null;
    }, 300);
  }, []);

  // ── 포스트 포커스 ────────────────────────────────────────────
  const focusPostOnMap = useCallback((post: Post, center?: { lat: number; lng: number }) => {
    if (post.lat == null || post.lng == null) return;

    // setAllPosts 전에 미리 보호 시작 - React 리렌더 시 innerHTML 교체 방지
    window.dispatchEvent(new CustomEvent('pre-highlight-marker', { detail: { id: post.id } }));

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

    // 원래 좌표(분산 없음)로 지도 이동
    const targetCenter = center || { lat: post.lat, lng: post.lng };

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
    // 광고 마커는 posts 테이블에 없으므로 DB fetch 스킵
    if (lightPost.isAd) return;
    try {
      // [Optimized] select('*') → 필요한 컬럼만. profiles JOIN은 상세 진입 시점이므로 유지
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, display_user_id, user_name, user_avatar, is_seed_data, hot_since, profiles:user_id(nickname, avatar_url, followers)')
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
      setAllPosts(prev => {
        const existingMap = new Map(prev.map(p => [p.id, p]));

        // DB에서 반환된 포스트 ID 집합
        const fetchedIds = new Set(raw.map((r: any) => String(r.id)));

        // 현재 bounds 안에 있는 일반 포스트 중 DB에서 돌아오지 않은 것은 삭제된 것으로 제거
        existingMap.forEach((post, id) => {
          if (String(id).startsWith('ad-map-marker-')) return;
          if (post.lat == null || post.lng == null) return;
          const inBounds =
            post.lat >= Math.min(sw.lat, ne.lat) &&
            post.lat <= Math.max(sw.lat, ne.lat) &&
            post.lng >= Math.min(sw.lng, ne.lng) &&
            post.lng <= Math.max(sw.lng, ne.lng);
          if (inBounds && !fetchedIds.has(id)) {
            existingMap.delete(id);
          }
        });

        // 광고 마커는 ads 테이블에서 별도 관리 — 새로고침으로 덮어쓰지 않음
        raw.forEach((r: any) => {
          if (String(r.id).startsWith('ad-map-marker-')) return;
          const prevPost = existingMap.get(r.id) || null;
          existingMap.set(r.id, mapRawToPost(r, prevPost));
        });

        const combined = Array.from(existingMap.values()).slice(0, 5000);
        mapCache.posts = combined;
        return combined;
      });
    }

    setIsRefreshing(false);
    showSuccess('데이터를 새로고침했습니다.');
  }, [fetchGlobalTrending]);

  // ── 현재 위치 ────────────────────────────────────────────────
  const moveToCurrentLocation = useCallback(async (showToast = true) => {
    // route state로 위치가 이미 지정된 경우 geolocation으로 덮어쓰지 않음
    if (locationLockedRef.current) return;

    const toastId = showToast ? showLoading('현재 위치를 확인 중입니다...') : null;

    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

    if (isNative) {
      // 네이티브 앱(iOS/Android): Capacitor Geolocation 사용
      try {
        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location === 'denied') {
          if (toastId) dismissToast(toastId);
          if (showToast) showError('위치 권한이 거부되었습니다. 기기 설정에서 위치 권한을 허용해주세요.');
          if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
          return;
        }
        if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
          const requested = await Geolocation.requestPermissions();
          if (requested.location === 'denied') {
            if (toastId) dismissToast(toastId);
            if (showToast) showError('위치 권한이 거부되었습니다. 기기 설정에서 위치 권한을 허용해주세요.');
            if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
            return;
          }
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
        if (pos?.coords) {
          setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (toastId) dismissToast(toastId);
          if (showToast) showSuccess('현재 위치로 이동했습니다.');
        }
      } catch (err: any) {
        if (toastId) dismissToast(toastId);
        const code = err?.code ?? err?.message ?? '';
        if (showToast) {
          if (String(code).includes('1') || String(code).toLowerCase().includes('denied') || String(code).toLowerCase().includes('permission')) {
            showError('위치 권한이 없습니다. 기기 설정에서 위치 권한을 허용해주세요.');
          } else if (String(code).includes('3') || String(code).toLowerCase().includes('timeout')) {
            showError('위치 확인 시간이 초과되었습니다. GPS를 켜고 다시 시도해주세요.');
          } else {
            showError('위치 정보를 가져올 수 없습니다. GPS 및 위치 권한을 확인해주세요.');
          }
        }
        if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
      }
    } else {
      // 웹 브라우저: navigator.geolocation 직접 사용
      if (!navigator.geolocation) {
        if (toastId) dismissToast(toastId);
        if (showToast) showError('이 브라우저는 위치 정보를 지원하지 않습니다.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (toastId) dismissToast(toastId);
          if (showToast) showSuccess('현재 위치로 이동했습니다.');
        },
        (err) => {
          if (toastId) dismissToast(toastId);
          if (showToast) {
            if (err.code === 1) {
              showError('위치 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘을 눌러 위치 권한을 허용해주세요.');
            } else if (err.code === 3) {
              showError('위치 확인 시간이 초과되었습니다. 다시 시도해주세요.');
            } else {
              showError('위치 정보를 가져올 수 없습니다. GPS 및 위치 권한을 확인해주세요.');
            }
          }
          if (mapCache.lastCenter) setMapCenter(mapCache.lastCenter);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  }, []);

  const handleCurrentLocation = () => moveToCurrentLocation(true);

  // ── 앱 시작 시 현재 위치로 자동 이동 (최초 1회만) ──────────
  // initialFocusRef가 있으면 (Profile 등에서 위치보기로 진입) geolocation 건너뜀
  // 실제 지도 이동/마커 highlight는 아래 routeState useEffect에서 focusPostOnMap이 처리 (부드러운 이동 + 정확히 1번 핑)
  // 하단 메뉴 지도 탭을 눌러 재진입할 때는 위치 이동 안 함 (sessionStorage 플래그로 구분)
  useEffect(() => {
    if (initialFocusRef.current) {
      // sessionStorage 정리만 수행 (이동/highlight는 routeState useEffect에서)
      sessionStorage.removeItem('pendingMapFocus');
      return;
    }
    const alreadyMoved = sessionStorage.getItem('initialLocationMoved');
    if (alreadyMoved) return;
    sessionStorage.setItem('initialLocationMoved', '1');
    moveToCurrentLocation(false);
  }, []);

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
      if (!post) return; // post가 undefined인 경우 방어
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
      if (routeState.post && routeState.post.lat != null && routeState.post.lng != null) {
        locationLockedRef.current = true;
        focusPostOnMap(routeState.post, { lat: routeState.post.lat, lng: routeState.post.lng });
        setTimeout(() => { locationLockedRef.current = false; }, 5000);
      } else if (routeState.center && routeState.center.lat != null) {
        locationLockedRef.current = true;
        setMapCenter(routeState.center);
        setTimeout(() => { locationLockedRef.current = false; }, 5000);
      } else {
        handleCurrentLocation();
      }
    } else if (routeState.post) {
      locationLockedRef.current = true;
      if (routeState.zoom != null) {
        setCurrentZoom(routeState.zoom);
        currentZoomRef.current = routeState.zoom;
      }
      focusPostOnMap(routeState.post, routeState.center);
      setTimeout(() => { locationLockedRef.current = false; }, 5000);
    } else if (routeState.center) {
      locationLockedRef.current = true;
      setSelectedPostId(null);
      if (routeState.zoom != null) {
        setCurrentZoom(routeState.zoom);
        currentZoomRef.current = routeState.zoom;
      }
      setMapCenter(routeState.center);
      setTimeout(() => { locationLockedRef.current = false; }, 5000);
    }
    // initialFocusRef는 한 번 사용 후 클리어
    if (initialFocusRef.current) {
      initialFocusRef.current = null;
    }
    if (routeState.startSelection) {
      setIsPostListOpen(false);
      const initialLoc = mapCache.lastCenter;
      tempSelectedLocationRef.current = initialLoc;
      setTimeout(() => { setIsSelectingLocation(true); setTempSelectedLocation(initialLoc); }, 500);
    }
    if (routeState.startAdLocationSelection) {
      setIsPostListOpen(false);
      setTempAdLocation(mapCache.lastCenter || null);
      setTimeout(() => {
        setIsSelectingAdLocation(true);
      }, 300);
    }
    if (routeState.adMarkerSaved && routeState.center) {
      setMapCenter(routeState.center);
      setCurrentZoom(4);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('highlight-marker', { detail: { id: 'ad-map-marker', duration: 3000 } }));
      }, 1000);
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
        {/* 화면 밖 마커 방향 표시 - overflow-hidden 밖에 fixed로 배치 */}
        {!isSelectingLocation && !isSelectingAdLocation && currentZoom < 7 && (
          <div className="fixed inset-0 z-[25] pointer-events-none" style={{ top: 'env(safe-area-inset-top)', bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px))' }}>
            <OffScreenMarkerIndicator
              posts={displayedMarkers}
              bounds={mapData?.bounds || null}
              mapCenter={mapData?.center || mapCenter || null}
              onNavigate={(post) => focusPostOnMap(post, { lat: post.lat!, lng: post.lng! })}
              onPanToDirection={(dir) => {
                const b = mapData?.bounds;
                const c = mapData?.center || mapCenter;
                if (!b || !c) return;
                const latSpan = b.ne.lat - b.sw.lat;
                const lngSpan = b.ne.lng - b.sw.lng;
                const panLat = { top: latSpan * 0.8, bottom: -latSpan * 0.8, left: 0, right: 0 }[dir];
                const panLng = { top: 0, bottom: 0, left: -lngSpan * 0.8, right: lngSpan * 0.8 }[dir];
                setMapCenter({ lat: c.lat + panLat, lng: c.lng + panLng });
              }}
              topOffset={trendingBottom}
              bottomOffset={bottomNavHeight}
              dbCounts={offScreenCounts}
            />
          </div>
        )}

        <div ref={mapAreaRef} className="flex-1 relative overflow-hidden flex flex-col">
          {/* 모두보기 카메라 셔터 애니메이션 - 지도 영역 안에만 표시 */}
          <ShutterOverlay ref={shutterRef} />
          <div className="absolute inset-0 z-0">
            <MapContainer
              posts={displayedMarkers}
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
              <div className="fixed inset-0 z-[3000] pointer-events-none">
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
                      <Button onClick={() => { setIsSelectingLocation(false); setTempSelectedLocation(null); tempSelectedLocationRef.current = null; setTimeout(() => navigate('/write', { state: { fromLocationSelection: true } }), 100); }} variant="secondary" className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600">
                        <X className="w-4 h-4 mr-2" /> 취소
                      </Button>
                      <Button onClick={() => { const loc = tempSelectedLocationRef.current || mapDataRef.current?.center || mapCache.lastCenter; setIsSelectingLocation(false); setTimeout(() => navigate('/write', { state: { location: loc, fromLocationSelection: true } }), 100); }} className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                        <Check className="w-4 h-4 mr-2" /> 이 위치로 선택
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 광고 마커 위치 선택 모드 */}
          <AnimatePresence>
            {isSelectingAdLocation && (
              <div className="fixed inset-0 z-[3000] pointer-events-none">
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative mb-12">
                    <div className="relative w-12 h-12">
                      <div className="absolute top-0 left-0 w-12 h-12 bg-violet-600 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl" />
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
                  <div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-violet-100 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-violet-600 rounded-full animate-pulse" />
                      <p className="text-sm font-black text-gray-900">광고 마커를 표시할 위치를 선택하세요</p>
                    </div>
                    <div className="flex w-full gap-3">
                      <Button
                        onClick={() => {
                          setIsSelectingAdLocation(false);
                          setTempAdLocation(null);
                          setTimeout(() => navigate('/settings/admin-ads'), 100);
                        }}
                        variant="secondary"
                        className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"
                      >
                        <X className="w-4 h-4 mr-2" /> 취소
                      </Button>
                      <Button
                        onClick={() => {
                          // ref에서 읽어야 stale closure 없이 최신 좌표 사용 가능
                          const loc = tempAdLocationRef.current || tempAdLocation || mapCache.lastCenter;
                          if (loc) {
                            setIsSelectingAdLocation(false);
                            isSelectingAdLocationRef.current = false;
                            // adId도 함께 전달 (어떤 마커에 위치를 적용할지)
                            const targetAdId = sessionStorage.getItem('adLocationTargetId') || 'new';
                            sessionStorage.removeItem('adLocationTargetId');
                            sessionStorage.setItem('adLocationPending', JSON.stringify({ lat: loc.lat, lng: loc.lng, adId: targetAdId }));
                            setTimeout(() => navigate('/settings/admin-ads'), 100);
                          }
                        }}
                        className="flex-1 h-12 rounded-2xl font-bold bg-violet-600 text-white shadow-lg shadow-violet-100"
                      >
                        <Check className="w-4 h-4 mr-2" /> 이 위치로 선택
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {!isSelectingLocation && !isSelectingAdLocation && (
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
                <button onClick={handleRefresh} disabled={isRefreshing || visiblePostCount <= MAX_VISIBLE_MARKERS} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-40 disabled:grayscale border border-indigo-100">
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} />
                  <span className="text-[9px] font-black mt-1">새로고침</span>
                </button>
                <div className="relative">
                  {displayedPostCount > 0 && currentZoom < 7 && <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />}
                  <button
                    ref={viewAllBtnRef}
                    onClick={() => {
                      if (displayedPostCount > 0 && currentZoom < 7) {
                        // 포스트 목록 미리 계산
                        const adIds = displayedMarkers.filter(p => p.isAd).map(p => p.id);
                        setPostListOpenedViewedIds(new Set([...viewedIds, ...adIds]));
                        const bounds = mapData?.bounds;
                        const boundsFiltered = bounds
                          ? displayedMarkers.filter(m =>
                              m.lat != null && m.lng != null &&
                              m.lat >= bounds.sw.lat && m.lat <= bounds.ne.lat &&
                              m.lng >= bounds.sw.lng && m.lng <= bounds.ne.lng
                            )
                          : displayedMarkers;
                        // 일반 포스팅만 시간 순 정렬
                        const normalPosts = boundsFiltered.filter(p => !p.isAd);
                        const adPosts = boundsFiltered.filter(p => p.isAd);
                        const sorted = [...normalPosts].sort((a, b) => {
                          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
                          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
                          return bTime - aTime;
                        });
                        const unseen = sorted.filter(p => !viewedIds.has(p.id));
                        const seen = sorted.filter(p => viewedIds.has(p.id));
                        const normalList = [...unseen, ...seen];

                        // 광고를 랜덤 위치에 삽입
                        // start_date가 있는 광고는 해당 날짜에 맞는 위치, 없는 광고는 완전 랜덤
                        const finalList = [...normalList];
                        adPosts.forEach(ad => {
                          const insertAt = Math.floor(Math.random() * (finalList.length + 1));
                          finalList.splice(insertAt, 0, ad);
                        });
                        setPostListInitialPosts(finalList);

                        // 플래시 애니메이션 - state 변경 없이 ref로 직접 실행
                        shutterRef.current?.trigger(() => {
                          setIsPostListOpen(true);
                        });
                      }
                    }}
                    disabled={currentZoom >= 7 || displayedPostCount === 0}
                    className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 overflow-hidden relative", (currentZoom >= 7 || displayedPostCount === 0) && "opacity-50 grayscale bg-slate-800/40 shadow-none")}
                  >
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
                    <span className="text-[10px] font-black mt-1 relative z-10">여기 보기</span>
                  </button>
                  {displayedPostCount > 0 && currentZoom < 7 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">
                      {displayedPostCount}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={handleCategorySelect} onClose={() => setIsCategoryOpen(false)} />

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

      {!isPostListOpen && !isSearchOpen && (
        <div
          ref={trendingDivRef}
          className={cn(
            "fixed top-[calc(env(safe-area-inset-top,0px)+74px)] left-4 right-4 z-[50] pointer-events-none transition-all duration-300",
            isCategoryOpen && "opacity-50 blur-[1px]",
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
      )}

      <AnimatePresence>
        {isPostListOpen && (
          <PostListOverlay
            key="post-list-overlay"
            isOpen={isPostListOpen}
            onClose={() => setIsPostListOpen(false)}
            initialPosts={postListInitialPosts}
            mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
            currentBounds={mapData?.bounds || { sw: { lat: 33, lng: 124 }, ne: { lat: 39, lng: 132 } }}
            selectedCategories={selectedCategories}
            authUserId={authUser?.id}
            onDeletePost={handlePostDeleted}
            openedViewedIds={postListOpenedViewedIds}
            viewedIds={viewedIds}
            markAsViewed={markAsViewed}
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
        mapCenter={mapData?.center || mapCache.lastCenter}
      />
    </>
  );
};

export default Index;