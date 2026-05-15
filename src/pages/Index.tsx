"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import TrendingPosts from '@/components/TrendingPosts';
import MarkerExpiryNotice from '@/components/MarkerExpiryNotice';
import ReelsViewer from '@/components/ReelsViewer';
import PostDetail from '@/components/PostDetail';
// PlaceSearch는 PlaceSearchOverlay로 대체되어 App.tsx에 전역 마운트됨
import CategoryMenu from '@/components/CategoryMenu';
import PostListOverlay from '@/components/PostListOverlay';
import ShutterOverlay, { ShutterOverlayHandle } from '@/components/ShutterOverlay';
import OffScreenMarkerIndicator from '@/components/OffScreenMarkerIndicator';
import MapLevelIndicator from '@/components/MapLevelIndicator';
import { Navigation, Search, Check, X, MapPin, Plus } from 'lucide-react';
import { Post } from '@/types';
import { cn, getFallbackImage } from '@/lib/utils';

import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache, makeExpiredCountKey, EXPIRED_COUNT_CACHE_TTL_MS, EXPIRED_COUNT_CACHE_MAX, GHOST_POSTS_CACHE_TTL_MS, GHOST_POSTS_CACHE_MAX } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds, fetchNearestInDirection, fetchOffScreenCounts, fetchExpiredOnlyCountInBounds, fetchExpiredPostsInBounds, DirectionCounts, MarkerCluster } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { postDraftStore } from '@/utils/post-draft-store';
import { fetchLikedPostIds, toggleLikeInDb } from '@/utils/like-utils';
import { useMapMarkerAds, resolveActiveSlot } from '@/hooks/use-ad';
import { resolveOfflineLocationName } from '@/utils/offline-location';
import { formatAdministrativeAddress } from '@/utils/location-format';
import { loadKakaoMapsSdk } from '@/utils/kakao-maps';
import confetti from 'canvas-confetti';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

const fireConfetti = (options: any) => {
  try {
    const f = (window as any).confetti || confetti;
    if (f) f(options);
  } catch (e) {}
};

const formatMapAddress = (result: any, lat: number, lng: number) => {
  const addr = result?.[0]?.address;
  if (!addr) return resolveOfflineLocationName(lat, lng);

  return formatAdministrativeAddress(
    addr.region_1depth_name,
    addr.region_2depth_name,
    addr.region_3depth_name || addr.region_3depth_h_name
  ) || resolveOfflineLocationName(lat, lng);
};

const getMapAddressCacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
const MAP_ADDRESS_CACHE_STORAGE_KEY = 'map-center-address-cache';
const MAP_ADDRESS_CACHE_LIMIT = 160;
const getBoundsFetchKey = (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  zoom: number
) => `${bounds.sw.lat.toFixed(4)}|${bounds.sw.lng.toFixed(4)}|${bounds.ne.lat.toFixed(4)}|${bounds.ne.lng.toFixed(4)}|${zoom}`;

function clusterByAngleClient(
  points: { lat: number; lng: number }[],
  centerLat: number, centerLng: number,
  latRange: number, lngRange: number,
  angleThresholdDeg = 45
): MarkerCluster[] {
  if (points.length === 0) return [];
  const withAngle = points.map(p => {
    const dx = (p.lng - centerLng) / lngRange;
    const dy = -(p.lat - centerLat) / latRange;
    const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return { ...p, angleDeg: (angleDeg + 360) % 360 };
  });
  withAngle.sort((a, b) => a.angleDeg - b.angleDeg);
  const clusters: MarkerCluster[] = [];
  const used = new Array(withAngle.length).fill(false);
  for (let i = 0; i < withAngle.length; i++) {
    if (used[i]) continue;
    const group = [withAngle[i]];
    used[i] = true;
    for (let j = i + 1; j < withAngle.length; j++) {
      if (used[j]) continue;
      let diff = Math.abs(withAngle[j].angleDeg - withAngle[i].angleDeg);
      if (diff > 180) diff = 360 - diff;
      if (diff <= angleThresholdDeg) { group.push(withAngle[j]); used[j] = true; }
    }
    clusters.push({
      count: group.length,
      avgLat: group.reduce((s, p) => s + p.lat, 0) / group.length,
      avgLng: group.reduce((s, p) => s + p.lng, 0) / group.length,
      points: group.map(p => ({ lat: p.lat, lng: p.lng })),
    });
  }
  return clusters;
}

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, session } = useAuth();

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
      } else if (routeState?.post?.lat != null && routeState?.post?.lng != null) {
        initialFocusRef.current = {
          lat: routeState.post.lat,
          lng: routeState.post.lng,
          zoom: routeState.zoom,
          post: routeState.post,
        };
      } else {
        const stored = sessionStorage.getItem('pendingMapFocus');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.lat != null && parsed?.lng != null) {
            initialFocusRef.current = parsed;
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
  // 지도 페이지를 벗어났다가 돌아오면 메모리 캐시로 즉시 복원해 재로딩처럼 보이지 않게 함
  const restoredFromMapCacheRef = useRef(mapCache.posts.length > 0);
  const [allPosts, setAllPosts] = useState<Post[]>(() => mapCache.posts);
  const [globalTrendingPosts, setGlobalTrendingPosts] = useState<Post[]>([]);
  // 5분마다 트렌딩 fetch가 완료될 때마다 증가하는 카운터.
  // TrendingPosts에 prop으로 전달해 "순위 변동 비교 기준(prevRanks)"을
  // 데이터 시그니처가 동일하더라도 매 5분 갱신 시점에 다시 박을 수 있게 한다.
  const [trendingRefreshTick, setTrendingRefreshTick] = useState(0);
  // displayedMarkers: MapContainer에 실제로 전달되는 마커 목록
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>(() => mapCache.posts);
  const [visibleMarkerIds, setVisibleMarkerIds] = useState<Set<string> | null>(null);

  const [mapData, setMapData] = useState<any>(null);
  // 초기 mapCenter/zoom은 항상 마지막 위치(mapCache) 사용 → 카카오맵이 이전 위치에서 시작
  // routeState로 위치가 지정된 경우 focusPostOnMap에서 setMapCenter를 호출 → 부드러운 smoothMoveTo
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);

  const mapCenterRef = useRef<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  const [centerAddress, setCenterAddress] = useState(() => (
    mapCache.lastCenter
      ? resolveOfflineLocationName(mapCache.lastCenter.lat, mapCache.lastCenter.lng)
      : '위치 확인 중'
  ));
  // 인디케이터용 통합 스냅샷: bounds, dbCounts, posts를 항상 동시에 업데이트
  // → 인디케이터가 (bounds, points)를 일관된 짝으로 받아 깜빡임 방지
  const [stableSnapshot, setStableSnapshot] = useState<{
    posts: Post[];
    bounds: any;
    dbCounts: DirectionCounts | null;
  }>(() => ({ posts: mapCache.posts, bounds: mapCache.bounds, dbCounts: mapCache.dbCounts }));
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 6);
  const isMapFrozenByCommentsRef = useRef(false);
  const frozenMapViewRef = useRef<{ center?: { lat: number; lng: number }; level: number } | null>(null);
  const isPostDetailOpenRef = useRef(false);
  const isPostListOverlayOpenRef = useRef(false);
  const suppressMapChangesUntilRef = useRef(0);

  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const handleCategorySelect = useCallback((cats: string[]) => {
    setSelectedCategories(cats);
  }, []);

  // ── 팔로잉 목록 (내 친구 포스팅 필터용) ─────────────────────
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authUser?.id) {
      setFollowingIds(new Set());
      return;
    }
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authUser.id)
      .then(({ data }) => {
        if (data) {
          setFollowingIds(new Set(data.map((r: any) => r.following_id)));
        }
      });
  }, [authUser?.id]);

  // ── friends 필터 선택 시 친구 포스팅 전국 범위 fetch ──────────
  // 친구 포스팅이 현재 화면 bounds 밖에 있어도 allPosts에 주입해
  // displayedMarkers와 offScreenCounts에 반영되도록 함
  useEffect(() => {
    if (!selectedCategories.includes('friends')) return;
    if (followingIds.size === 0) return;

    const ids = Array.from(followingIds);
    let cancelled = false;

    supabase
      .from('posts')
      .select('id, latitude, longitude, location_name, category, likes, created_at, video_url, image_url, user_id, user_name, user_avatar, images, content, hot_since, profiles!posts_user_id_fkey(followers, nickname, avatar_url)')
      .in('user_id', ids)
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          data.forEach((r: any) => {
            if (!existingMap.has(r.id)) {
              existingMap.set(r.id, mapRawToPost(r, null));
            }
          });
          return Array.from(existingMap.values()).slice(0, 5000);
        });
      });

    return () => { cancelled = true; };
  }, [selectedCategories, followingIds]);

  // map_marker 광고 데이터 구독 (여러 개 지원, now: 시간 전환 시 리렌더 트리거)
  const { ads: mapMarkerAds, loading: mapMarkerAdsLoading, now: mapMarkerNow } = useMapMarkerAds();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const isTrendingExpandedRef = useRef(false);
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => mapCache.userLocation);
  const [stableViewportHeight, setStableViewportHeight] = useState(() => window.innerHeight);

  const updateUserLocationMarker = useCallback((loc: { lat: number; lng: number }) => {
    mapCache.userLocation = loc;
    setUserLocation(loc);
  }, []);

  useEffect(() => {
    const updateStableViewportHeight = () => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTextInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      if (isTextInputFocused) return;
      setStableViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', updateStableViewportHeight);
    window.addEventListener('orientationchange', updateStableViewportHeight);
    return () => {
      window.removeEventListener('resize', updateStableViewportHeight);
      window.removeEventListener('orientationchange', updateStableViewportHeight);
    };
  }, []);

  // [Optimized] profile state는 사용되지 않아 제거 (AuthProvider가 이미 관리)

  const highlightTimeoutRef = useRef<number | null>(null);
  const throttleTimer = useRef<any>(null);
  const fetchingRef = useRef(false);
  const mapDataRef = useRef<any>(null);
  const addressCacheRef = useRef<Map<string, string>>(new Map());
  const addressCacheLoadedRef = useRef(false);
  if (!addressCacheLoadedRef.current) {
    addressCacheLoadedRef.current = true;
    try {
      const stored = sessionStorage.getItem(MAP_ADDRESS_CACHE_STORAGE_KEY);
      if (stored) {
        addressCacheRef.current = new Map(JSON.parse(stored));
      }
    } catch (e) {
      addressCacheRef.current = new Map();
    }
  }
  const spreadMarkersRef = useRef<Post[]>([]);
  // route state로 위치가 지정된 경우 geolocation이 덮어쓰지 못하도록 보호
  // 초기 마운트 시 initialFocusRef가 있거나 startSelection 상태이면 즉시 잠금 (geolocation race condition 차단)
  const locationLockedRef = useRef(
    initialFocusRef.current !== null ||
    !!(location.state as any)?.startSelection ||
    !!(location.state as any)?.startAdLocationSelection
  );

  const currentZoomRef = useRef<number>(mapCache.lastZoom || 6);

  // 트렌딩/bounds fetch 캐싱 및 중복 호출 방지용 ref
  const trendingFetchedAtRef = useRef<number>(0);
  const lastBoundsKeyRef = useRef<string>(mapCache.bounds ? getBoundsFetchKey(mapCache.bounds, mapCache.lastZoom || 6) : '');

  // safe-area-inset-bottom을 JS로 읽기
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight);
  useEffect(() => {
    const update = () => {
      if ((window as any).__commentsDialogOpen) return;

      setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
      // CSS 변수가 없으면 env() 직접 계산
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
      document.body.appendChild(el);
      const h = el.getBoundingClientRect().height;
      document.body.removeChild(el);
      setSafeAreaBottom(h || 0);
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  // 인디케이터 상단 오프셋: 트렌딩 패널 접힌 상태의 높이를 최초 1회만 기록
  // 이후 패널 펼침/닫힘 애니메이션 중에도 값이 변하지 않도록 고정
  const collapsedTrendingBottomRef = useRef<number>(0);
  useEffect(() => {
    if (collapsedTrendingBottomRef.current === 0 && trendingBottom > 0) {
      collapsedTrendingBottomRef.current = trendingBottom;
    }
  }, [trendingBottom]);
  const indicatorTopOffset = (collapsedTrendingBottomRef.current || trendingBottom) + 8;
  // 인디케이터 하단 오프셋: BottomNav(64) + safe-area-inset-bottom + 위치 배너 공간
  // 물방울 마커가 하단 위치 배너와 겹치지 않도록 여유를 더 확보
  const indicatorBottomOffset = bottomNavHeight + safeAreaBottom + 56;
  const rightMarkerIndicatorTop = ((indicatorTopOffset + (viewportHeight - (indicatorBottomOffset + 8))) / 2) - 26;

  // 지도 레벨 인디케이터 위치:
  // 실시간 인기 포스팅 패널(trendingDivRef)의 아랫변과
  // 오른쪽 마커 인디케이터의 윗변 사이의 빈 공간 중앙에 배치한다.
  //
  // 좌표계 혼선을 피하기 위해 트렌딩 패널의 실제 DOM 위치(getBoundingClientRect)를 측정해서
  // viewport 절대 좌표를 직접 얻는다. (안드로이드/iOS/웹 환경 차이 무관)
  const MAP_LEVEL_INDICATOR_HEIGHT = 156;
  const [trendingBottomY, setTrendingBottomY] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = trendingDivRef.current;
      if (!el) return;
      // 트렌딩 패널이 펼쳐진 상태에서는 측정하지 않음(접힌 상태 기준 고정 유지)
      if (isTrendingExpandedRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > 0) {
        setTrendingBottomY(prev => (prev !== null && Math.abs(prev - rect.bottom) < 0.5 ? prev : rect.bottom));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trendingDivRef.current) ro.observe(trendingDivRef.current);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [viewportHeight, safeAreaBottom, isPostListOpen, isSearchOpen, isSelectingLocation, isSelectingAdLocation]);

  // PlaceSearchOverlay 닫힘 이벤트 동기화 (트렌딩 패널 노출 등 UI 상태 복귀용)
  useEffect(() => {
    const handlePlaceSearchClose = () => setIsSearchOpen(false);
    window.addEventListener('close-place-search', handlePlaceSearchClose);
    window.addEventListener('close-place-search-by-back', handlePlaceSearchClose);
    return () => {
      window.removeEventListener('close-place-search', handlePlaceSearchClose);
      window.removeEventListener('close-place-search-by-back', handlePlaceSearchClose);
    };
  }, []);

  // 위쪽 경계: 트렌딩 패널 아랫변 (실측값 우선, 없으면 trendingBottom state 기반 fallback)
  const effectiveTrendingBottomY = trendingBottomY ?? trendingBottom;
  // 아래쪽 경계: 오른쪽 마커 인디케이터 윗변
  const gapCenterY = (effectiveTrendingBottomY + rightMarkerIndicatorTop) / 2;
  const minTop = effectiveTrendingBottomY + 8;
  const maxTop = rightMarkerIndicatorTop - 8 - MAP_LEVEL_INDICATOR_HEIGHT;
  const mapLevelIndicatorTop = Math.round(
    Math.min(Math.max(gapCenterY - MAP_LEVEL_INDICATOR_HEIGHT / 2, minTop), Math.max(maxTop, minTop)),
  );

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    const handleCommentsDialogVisibility = (event: Event) => {
      const isOpen = !!(event as CustomEvent<{ open?: boolean }>).detail?.open;

      if (isOpen) {
        if (!isMapFrozenByCommentsRef.current) {
          frozenMapViewRef.current = {
            center: mapDataRef.current?.center || mapCenterRef.current || mapCache.lastCenter,
            level: currentZoomRef.current,
          };
        }
        isMapFrozenByCommentsRef.current = true;
        return;
      }

      isMapFrozenByCommentsRef.current = false;
      frozenMapViewRef.current = null;
    };

    window.addEventListener('comments-dialog-visibility', handleCommentsDialogVisibility);
    return () => window.removeEventListener('comments-dialog-visibility', handleCommentsDialogVisibility);
  }, []);

  // ── 포스트 매핑 헬퍼 ────────────────────────────────────────
  const mapRawToPost = (p: any, prev?: Post | null): Post => {
    const content = p.content !== undefined ? (p.content || '') : (prev?.content ?? '');
    const isAd = content.trim().startsWith('[AD]') || prev?.isAd || false;
    const likes = Number(p.likes ?? prev?.likes ?? 0);
    const likesPerHour = Number(p.likes_per_hour ?? prev?.likes_per_hour ?? 0);
    let borderType: any = 'none';
    const hotSince = p.hot_since ?? prev?.hot_since ?? null;
    if (likesPerHour >= 100) borderType = 'popular';
    else if (!isAd) {
      const followers = Number(p.profiles?.followers ?? 0);
      if (followers >= 10000000) borderType = 'diamond';
      else if (followers >= 1000000) borderType = 'gold';
      else if (followers >= 100000) borderType = 'silver';
    }
    const userName = p.profiles?.nickname || p.user_name || prev?.user?.name || '탐험가';
    const userAvatar = p.profiles?.avatar_url || p.user_avatar || prev?.user?.avatar || '/placeholder.svg';
    const displayUserId = p.user_id || prev?.user?.id || '';
    let img = p.image_url ?? prev?.image_url ?? getFallbackImage(String(p.id));

    if (!img) {
      img = getFallbackImage(String(p.id));
    }

    const rawImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : (prev?.images && prev.images.length > 0 ? prev.images : [img]);
    const images = isAd ? [img] : rawImages;
    const videoUrl = isAd ? undefined : (p.video_url ?? prev?.videoUrl);

    return {
      id: p.id,
      user_id: p.user_id || prev?.user_id || '',
      owner_id: p.user_id || prev?.owner_id || '',
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: { id: displayUserId, name: userName, avatar: userAvatar },
      content: content.replace(/^\[AD\]\s*/, ''),
      location: p.location_name ?? prev?.location ?? '알 수 없는 장소',
      lat: p.latitude ?? prev?.lat,
      lng: p.longitude ?? prev?.lng,
      latitude: p.latitude ?? prev?.latitude,
      longitude: p.longitude ?? prev?.longitude,
      likes,
      likes_per_hour: likesPerHour,
      commentsCount: prev?.commentsCount ?? 0,
      comments: prev?.comments ?? [],
      image: img,
      image_url: img,
      images,
      isLiked: p.isLiked ?? prev?.isLiked ?? false,
      videoUrl,
      category: isAd ? 'food' : (p.category ?? prev?.category ?? 'none'),
      createdAt: p.created_at ? new Date(p.created_at) : (prev?.createdAt ?? new Date()),
      borderType,
      hot_since: hotSince,
      link_url: isAd ? (p.link_url ?? prev?.link_url ?? '') : undefined,
    };
  };

  // ── 트렌딩 fetch ─────────────────────────────────────────────
  // [Optimized] 컬럼 축소(JOIN 제거), 5분 캐싱 + 5분 주기 자동 갱신
  const TRENDING_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5분
  const fetchGlobalTrending = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - trendingFetchedAtRef.current < TRENDING_REFRESH_INTERVAL_MS && globalTrendingPosts.length > 0) {
      return; // 5분 이내 호출이면 스킵
    }
    try {
      const { data, error } = await supabase.rpc('get_trending_posts', { limit_count: 20 });
      if (!error && data) {
        const likedIds = await fetchLikedPostIds(data.map((p: any) => p.id), authUserIdRef.current);
        const mapped = data.map((p: any) => ({ ...mapRawToPost({ ...p, isLiked: likedIds.has(String(p.id)) }), likes_per_hour: Number(p.likes_per_hour ?? 0) }));
        const trending = mapped.slice(0, 20).map((p: any, i: number) => ({ ...p, rank: i + 1 }));
        setGlobalTrendingPosts(trending);
        // 새 트렌딩 fetch 완료 신호 → TrendingPosts가 비교 기준(prevRanks)을 갱신할 수 있게 한다.
        setTrendingRefreshTick((t) => t + 1);
        trendingFetchedAtRef.current = now;
      }
    } catch (err) {
      console.error('[Trending] fetch error:', err);
    }
  }, [globalTrendingPosts.length]);

  // 마운트 시 1회 + 5분마다 자동 갱신
  // 탭이 백그라운드였다가 다시 활성화되면 마지막 fetch가 오래된 경우 즉시 갱신
  useEffect(() => {
    fetchGlobalTrending();
    const intervalId = window.setInterval(() => {
      fetchGlobalTrending();
    }, TRENDING_REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - trendingFetchedAtRef.current >= TRENDING_REFRESH_INTERVAL_MS) {
        fetchGlobalTrending();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchGlobalTrending]);

  // ── 핵심: bounds가 바뀔 때마다 해당 영역 포스트 fetch ──────
  useEffect(() => {
    if (!mapData?.bounds) return;

    const { sw, ne } = mapData.bounds;
    const center = mapData.center;

    const boundsKey = getBoundsFetchKey(mapData.bounds, currentZoom);
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

        // posts와 dbCounts(DB 모드용)를 병렬 fetch
        // → 둘 다 완료된 후 stableSnapshot 단일 업데이트 → 인디케이터가 일관된 (bounds, dbCounts) 짝으로 계산
        const needDbCounts = !useClientSideCountsRef.current;
        const [raw, dbCounts] = await Promise.all([
          fetchPostsInBounds(expandedSw, expandedNe, currentZoom, center),
          needDbCounts
            ? fetchOffScreenCounts(mapData.bounds, {
                categories: selectedCategoriesRef.current,
                userId: authUserIdRef.current,
              })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const likedIds = await fetchLikedPostIds(raw.map((r: any) => r.id), authUserIdRef.current);
        if (cancelled) return;

        // allPosts 업데이트 + stableSnapshot 단일 갱신 (React 18 automatic batching)
        setAllPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));

          const fetchedIds = new Set(raw.map((r: any) => String(r.id)));

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

          raw.forEach((r: any) => {
            if (String(r.id).startsWith('ad-map-marker-')) return;
            const prevPost = existingMap.get(r.id) || null;
            existingMap.set(r.id, mapRawToPost({ ...r, isLiked: likedIds.has(String(r.id)) }, prevPost));
          });

          const combined = Array.from(existingMap.values()).slice(0, 5000);
          mapCache.posts = combined;
          mapCache.bounds = mapData.bounds;
          mapCache.dbCounts = dbCounts;
          // bounds + dbCounts + posts 동시 업데이트
          setStableSnapshot({
            posts: combined,
            bounds: mapData.bounds,
            dbCounts,
          });
          return combined;
        });
      } catch (err) {
        if (!cancelled) console.error('[Index] fetch error:', err);
      }
    };

    doFetch();

    return () => { cancelled = true; };
  }, [mapData?.bounds?.sw?.lat, mapData?.bounds?.sw?.lng, mapData?.bounds?.ne?.lat, mapData?.bounds?.ne?.lng, currentZoom]);

  // ── 화면 밖 방향별 포스트 수 ──────────────────────────────────
  // friends/hot/influencer 필터는 클라이언트 계산(stableSnapshot.posts 기반)
  // all/카테고리/mine 필터는 DB 쿼리(stableSnapshot.dbCounts에 통합 저장)

  // 클라이언트 계산이 필요한 카테고리인지 판단
  const useClientSideCounts = useMemo(() => {
    return selectedCategories.includes('friends') ||
           selectedCategories.includes('hot') ||
           selectedCategories.includes('influencer');
  }, [selectedCategories]);

  // fetch effect 안에서 stale closure 없이 최신값을 읽기 위한 ref들
  const useClientSideCountsRef = useRef(useClientSideCounts);
  const selectedCategoriesRef = useRef(selectedCategories);
  const authUserIdRef = useRef<string | null>(authUser?.id || null);
  useEffect(() => { useClientSideCountsRef.current = useClientSideCounts; }, [useClientSideCounts]);
  useEffect(() => { selectedCategoriesRef.current = selectedCategories; }, [selectedCategories]);
  useEffect(() => { authUserIdRef.current = authUser?.id || null; }, [authUser?.id]);

  useEffect(() => {
    if (!restoredFromMapCacheRef.current) {
      lastBoundsKeyRef.current = '';
    }

    const syncLikedState = async () => {
      const userId = authUser?.id;
      if (!userId) {
        const clearLiked = (post: Post) => ({ ...post, isLiked: false });
        setAllPosts(prev => prev.map(clearLiked));
        setGlobalTrendingPosts(prev => prev.map(clearLiked));
        return;
      }

      const ids = Array.from(new Set([...allPosts, ...globalTrendingPosts].map(post => post.id)));
      const likedIds = await fetchLikedPostIds(ids, userId);
      const applyLiked = (post: Post) => ({ ...post, isLiked: likedIds.has(String(post.id)) });
      setAllPosts(prev => prev.map(applyLiked));
      setGlobalTrendingPosts(prev => prev.map(applyLiked));
    };

    syncLikedState();
  }, [authUser?.id]);

  // 클라이언트 계산: stableSnapshot 기반 (posts + bounds 항상 동기화)
  const clientOffScreenCounts = useMemo((): DirectionCounts | null => {
    const { posts: stablePosts, bounds: stableBounds } = stableSnapshot;
    if (!stableBounds) return null;
    if (!useClientSideCounts) return null;

    const { sw, ne } = stableBounds;
    const centerLat = (sw.lat + ne.lat) / 2;
    const centerLng = (sw.lng + ne.lng) / 2;
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;

    let top = 0, bottom = 0, left = 0, right = 0;
    let topSumLat = 0, topSumLng = 0, bottomSumLat = 0, bottomSumLng = 0;
    let leftSumLat = 0, leftSumLng = 0, rightSumLat = 0, rightSumLng = 0;
    const offScreenPoints: { lat: number; lng: number }[] = [];

    // 마커 24시간 만료 룰: 만료된 포스트는 인디케이터 카운트/이동 대상에서 제외
    const MARKER_LIFESPAN_MS_LOCAL = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    // stablePosts에서 카테고리 필터 적용 (displayedMarkers 대신)
    const filteredStable = stablePosts.filter((post: any) => {
      if (!post || post.lat == null || post.lng == null) return false;
      if (blockedIds.has(post.user?.id)) return false;
      if (post.isAd) return false;
      // 24시간 만료 체크 (광고는 위에서 이미 제외됨)
      const createdMs = post.createdAt instanceof Date
        ? post.createdAt.getTime()
        : (post.createdAt ? new Date(post.createdAt).getTime() : NaN);
      if (Number.isFinite(createdMs) && nowMs - createdMs >= MARKER_LIFESPAN_MS_LOCAL) return false;
      if (selectedCategories.includes('friends')) return !!(post.user?.id && followingIds.has(post.user.id));
      if (selectedCategories.includes('mine')) return !!(authUser && post.user?.id === authUser.id);
      if (selectedCategories.includes('all')) return true;
      const isHot = post.borderType === 'popular';
      const isInfluencer = post.isInfluencer || ['silver', 'gold', 'diamond'].includes(post.borderType || '');
      return selectedCategories.includes(post.category || 'none') ||
        (selectedCategories.includes('hot') && isHot) ||
        (selectedCategories.includes('influencer') && isInfluencer);
    });

    filteredStable.forEach((post: any) => {
      if (post.lat == null || post.lng == null) return;
      if (post.isAd) return;
      const lat = post.lat;
      const lng = post.lng;
      if (lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng) return;

      offScreenPoints.push({ lat, lng });

      const dLat = (lat - centerLat) / latRange;
      const dLng = (lng - centerLng) / lngRange;
      if      (dLat >= 0 && dLat >= Math.abs(dLng))           { top++;    topSumLat    += lat; topSumLng    += lng; }
      else if (dLat < 0  && Math.abs(dLat) > Math.abs(dLng))  { bottom++; bottomSumLat += lat; bottomSumLng += lng; }
      else if (dLng < 0  && Math.abs(dLng) >= Math.abs(dLat)) { left++;   leftSumLat   += lat; leftSumLng   += lng; }
      else                                                      { right++;  rightSumLat  += lat; rightSumLng  += lng; }
    });

    const clusters = clusterByAngleClient(offScreenPoints, centerLat, centerLng, latRange, lngRange);

    return {
      clusters,
      top, bottom, left, right,
      hasTop: top > 0, hasBottom: bottom > 0, hasLeft: left > 0, hasRight: right > 0,
      topAvgLat:    top    > 0 ? topSumLat    / top    : centerLat,
      topAvgLng:    top    > 0 ? topSumLng    / top    : centerLng,
      bottomAvgLat: bottom > 0 ? bottomSumLat / bottom : centerLat,
      bottomAvgLng: bottom > 0 ? bottomSumLng / bottom : centerLng,
      leftAvgLat:   left   > 0 ? leftSumLat   / left   : centerLat,
      leftAvgLng:   left   > 0 ? leftSumLng   / left   : centerLng,
      rightAvgLat:  right  > 0 ? rightSumLat  / right  : centerLat,
      rightAvgLng:  right  > 0 ? rightSumLng  / right  : centerLng,
      topPoints: offScreenPoints.filter(p => { const dLat=(p.lat-centerLat)/latRange, dLng=(p.lng-centerLng)/lngRange; return dLat>=0&&dLat>=Math.abs(dLng); }),
      bottomPoints: offScreenPoints.filter(p => { const dLat=(p.lat-centerLat)/latRange, dLng=(p.lng-centerLng)/lngRange; return dLat<0&&Math.abs(dLat)>Math.abs(dLng); }),
      leftPoints: offScreenPoints.filter(p => { const dLat=(p.lat-centerLat)/latRange, dLng=(p.lng-centerLng)/lngRange; return dLng<0&&Math.abs(dLng)>=Math.abs(dLat); }),
      rightPoints: offScreenPoints.filter(p => { const dLat=(p.lat-centerLat)/latRange, dLng=(p.lng-centerLng)/lngRange; return dLng>=0&&dLng>Math.abs(dLat); }),
    };
  }, [stableSnapshot, currentZoom, useClientSideCounts, blockedIds, selectedCategories, authUser, followingIds]);

  // 카테고리/사용자 필터만 변경된 경우 dbCounts 재계산
  // (bounds 변경에 의한 dbCounts는 메인 fetch effect에서 stableSnapshot에 통합 업데이트됨)
  useEffect(() => {
    if (useClientSideCounts) return;
    const b = stableSnapshot.bounds;
    if (!b) return;

    let cancelled = false;
    const fetchCounts = async () => {
      const counts = await fetchOffScreenCounts(b, {
        categories: selectedCategories,
        userId: authUser?.id || null,
      });
      if (!cancelled) {
        setStableSnapshot(s => {
          if (s.bounds !== b) return s;
          mapCache.bounds = b;
          mapCache.dbCounts = counts;
          return { ...s, dbCounts: counts };
        });
      }
    };
    fetchCounts();
    return () => { cancelled = true; };
  }, [selectedCategories, authUser?.id, useClientSideCounts]);

  // 클라이언트 모드일 땐 dbCounts가 사용되지 않으므로 클리어할 필요 없음
  // (인디케이터는 useClientSideCounts ? clientOffScreenCounts : stableSnapshot.dbCounts 로 분기)

  // ── map_marker 광고들을 allPosts에 주입 ──────────────────────
  // ads 테이블의 ad_type='map_marker' 광고들을 모두 지도 마커로 표시.
  // 각 광고는 'ad-map-marker-{id}' 형태의 고유 ID로 관리.
  // mapMarkerNow가 바뀌면(시간 전환 타이머) 재실행되어 start/end_date 반영.
  useEffect(() => {
    if (mapMarkerAdsLoading) return;

    const AD_POST_PREFIX = 'ad-map-marker-';

    const getLocation = async (lat: number, lng: number): Promise<string> => {
      try {
        await loadKakaoMapsSdk();
      } catch (e) {
        return resolveOfflineLocationName(lat, lng);
      }

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
            resolve(formatAdministrativeAddress(
              addr.region_1depth_name,
              addr.region_2depth_name,
              addr.region_3depth_name
            ));
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
        ? (mapMarkerAd.image_url || mapMarkerAd.brand_logo_url || '')
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
            setAllPosts(current => {
              const next = current.filter(p => !disappearingIds.includes(p.id));
              mapCache.posts = next;
              return next;
            });
          }, 480);
          // 사라지는 마커는 아직 남겨두고, 새 마커만 추가
          const withoutNewAdSlots = prev.filter(p => !p.id.startsWith(AD_POST_PREFIX) || disappearingIds.includes(p.id));
          const next = [...newAdPosts, ...withoutNewAdSlots];
          mapCache.posts = next;
          return next;
        }

        const withoutOldAds = prev.filter(p => !p.id.startsWith(AD_POST_PREFIX));
        const next = [...newAdPosts, ...withoutOldAds];
        mapCache.posts = next;
        return next;
      });
    });
  }, [mapMarkerAds, mapMarkerAdsLoading, mapMarkerNow]);

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

      if (selectedCategories.includes('friends')) {
        return !!(post.user?.id && followingIds.has(post.user.id));
      }
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
  }, [allPosts, selectedCategories, blockedIds, authUser, followingIds]);

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

  useEffect(() => {
    if (selectedPostId) {
      isPostDetailOpenRef.current = true;
      return;
    }

    if (isPostDetailOpenRef.current) {
      suppressMapChangesUntilRef.current = Date.now() + 700;
    }
    isPostDetailOpenRef.current = false;
  }, [selectedPostId]);

  useEffect(() => {
    if (isPostListOpen) {
      isPostListOverlayOpenRef.current = true;
      return;
    }

    if (isPostListOverlayOpenRef.current) {
      suppressMapChangesUntilRef.current = Date.now() + 700;
    }
    isPostListOverlayOpenRef.current = false;
  }, [isPostListOpen]);

  // 트렌딩 포스트 div의 실제 bottom 위치 측정
  // 펼침 애니메이션 중 ResizeObserver → setState → 전체 리렌더가 반복되지 않도록
  // 접힌 상태에서만 측정값을 상태에 반영한다.
  useEffect(() => {
    const measure = () => {
      if (!trendingDivRef.current) return;
      if (isTrendingExpandedRef.current) return;

      const rect = trendingDivRef.current.getBoundingClientRect();
      const nextBottom = Math.round(rect.bottom);
      setTrendingBottom(prev => (Math.abs(prev - nextBottom) < 1 ? prev : nextBottom));
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (trendingDivRef.current) ro.observe(trendingDivRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isPostListOpen, isSearchOpen, isTrendingExpanded]);


  // ── visibleMarkers: displayedMarkers 그대로 사용 (분산 없음) ──────
  // 카카오맵 CustomOverlay는 화면 밖 마커를 자동으로 렌더링하지 않으므로
  // bounds 필터링을 React 레벨에서 하면 드래그 시 마커가 사라지는 버그 발생

  // 지도에 실제 CustomOverlay로 표시 중인 마커 목록 (여기보기 배지/목록용)
  const mapVisibleMarkers = useMemo(() => {
    if (!visibleMarkerIds) {
      if (!mapData?.bounds) return displayedMarkers;
      const { sw, ne } = mapData.bounds;
      return displayedMarkers.filter(m =>
        m.lat != null && m.lng != null &&
        m.lat >= Math.min(sw.lat, ne.lat) && m.lat <= Math.max(sw.lat, ne.lat) &&
        m.lng >= Math.min(sw.lng, ne.lng) && m.lng <= Math.max(sw.lng, ne.lng)
      );
    }
    return displayedMarkers.filter(marker => visibleMarkerIds.has(String(marker.id)));
  }, [displayedMarkers, mapData?.bounds, visibleMarkerIds]);

  const displayedPostCount = mapVisibleMarkers.length;

  // ── "지도엔 안 보이지만 24h 지난 포스트가 있는" 영역 감지 ───────
  // 조건:
  // 1) 화면에 24h 내 신규 마커가 하나라도 있으면 토스트를 띄우지 않는다.
  // 2) 신규 마커가 0개이고 24h 지난 포스트가 화면 영역 안에 있으면
  //    그 상태가 유지되는 동안 토스트를 계속 노출한다 (사용자가 다른 영역으로 이동/줌하면 자동 해제).
  //
  // ⚠ 깜빡임 방지: mapData.bounds(throttled)와 visibleMarkerIds(즉시) 두 state가
  //    독립적으로 업데이트되어 짧은 순간 displayedPostCount===0이 잘못 평가되는
  //    구간이 생긴다. 그래서 displayedPostCount===0 상태를 곧바로 신뢰하지 않고
  //    400ms 동안 유지될 때에만 쿼리/표시를 진행한다.
  //
  // ⚠ DB 부하 방어: 같은 영역(양자화된 bounds + 필터 시그니처)은 60초 TTL 캐시로
  //   재쿼리를 막는다. 페이지 재진입/미세 패닝 시 DB hit을 거의 0으로 만든다.
  const [expiredOnlyCount, setExpiredOnlyCount] = useState(0);
  const expiredCheckTokenRef = useRef(0);

  // ── 고스트(만료) 마커: 현재 bounds 안의 24시간 지난 포스트 상위 30개 ──
  // MapContainer는 회색 작은 점("잔상")으로 표시한다. 정상 마커와 공존.
  //
  // 캐싱 정책: 양자화된 bounds + 필터 시그니처를 키로 결과를 메모리에 저장한다.
  // 같은 영역에서 다시 effect가 실행되면(탭 전환 후 재진입, 미세 패닝 등)
  // DB 쿼리 없이 캐시된 동일한 데이터(같은 객체 참조)를 그대로 사용해
  // 마커 재렌더/재로딩이 발생하지 않도록 한다.
  const [ghostPosts, setGhostPosts] = useState<any[]>(mapCache.lastGhostPosts);
  const ghostFetchTokenRef = useRef(0);

  useEffect(() => {
    if (currentZoom >= 7 || !mapData?.bounds) {
      if (ghostPosts.length > 0) {
        setGhostPosts([]);
        mapCache.lastGhostPosts = [];
      }
      return;
    }
    const bounds = mapData.bounds;
    const cacheKey = makeExpiredCountKey(bounds, {
      categories: selectedCategoriesRef.current,
      userId: authUserIdRef.current,
      followingIds: Array.from(followingIds),
    });

    // 1) 캐시 히트 — DB 쿼리 없이 동일한 배열 참조를 즉시 사용 (마커 재렌더 방지)
    const cached = mapCache.ghostPostsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < GHOST_POSTS_CACHE_TTL_MS) {
      // 참조가 같으면 setState가 리렌더를 트리거하지 않도록 비교
      if (ghostPosts !== cached.posts) {
        setGhostPosts(cached.posts);
        mapCache.lastGhostPosts = cached.posts;
      }
      return;
    }

    const myToken = ++ghostFetchTokenRef.current;
    // 100ms 디바운스 — 빠른 패닝/줌 중 과도한 호출은 막되, 정상 표시 지연은 최소화
    const timer = window.setTimeout(async () => {
      const list = await fetchExpiredPostsInBounds(bounds, {
        limit: 30,
        categories: selectedCategoriesRef.current,
        userId: authUserIdRef.current,
        followingIds: Array.from(followingIds),
      });
      if (myToken !== ghostFetchTokenRef.current) return;

      // 캐시에 저장 + LRU-ish eviction
      mapCache.ghostPostsCache.set(cacheKey, { posts: list, timestamp: Date.now() });
      if (mapCache.ghostPostsCache.size > GHOST_POSTS_CACHE_MAX) {
        const oldestKey = mapCache.ghostPostsCache.keys().next().value;
        if (oldestKey !== undefined) mapCache.ghostPostsCache.delete(oldestKey);
      }
      mapCache.lastGhostPosts = list;
      setGhostPosts(list);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [mapData?.bounds, currentZoom, selectedCategories, authUser?.id, followingIds]);

  useEffect(() => {
    // 줌 아웃이거나 bounds가 없으면 즉시 0으로 리셋
    if (currentZoom >= 7 || !mapData?.bounds) {
      setExpiredOnlyCount(0);
      return;
    }

    // 신규 마커가 보이면 즉시 0으로 리셋 (깜빡임 없이 토스트 사라짐)
    if (displayedPostCount > 0) {
      setExpiredOnlyCount(0);
      return;
    }

    const bounds = mapData.bounds;
    const cacheKey = makeExpiredCountKey(bounds, {
      categories: selectedCategoriesRef.current,
      userId: authUserIdRef.current,
      followingIds: Array.from(followingIds),
    });

    // 1) 캐시 히트 — DB 쿼리 없이 즉시 반환
    //    단, '마커 0개' 상태가 진짜인지 확신하기 어려운 시점일 수 있어 짧은 grace period(200ms)를 둠
    const cached = mapCache.expiredCountCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < EXPIRED_COUNT_CACHE_TTL_MS) {
      const myToken = ++expiredCheckTokenRef.current;
      const t = window.setTimeout(() => {
        if (myToken !== expiredCheckTokenRef.current) return;
        setExpiredOnlyCount(cached.count);
      }, 200);
      return () => window.clearTimeout(t);
    }

    const myToken = ++expiredCheckTokenRef.current;

    // 2) 캐시 미스 — 400ms grace period 후에도 여전히 displayedPostCount===0이면
    //    그제서야 DB 쿼리. 짧은 깜빡임 0 상태는 자동으로 무시됨.
    //    같은 영역 재방문은 캐시 히트(위 분기)로 처리.
    const timer = window.setTimeout(async () => {
      const count = await fetchExpiredOnlyCountInBounds(bounds, {
        categories: selectedCategoriesRef.current,
        userId: authUserIdRef.current,
        followingIds: Array.from(followingIds),
      });
      if (myToken !== expiredCheckTokenRef.current) return;

      // 캐시 저장 + LRU-ish eviction
      mapCache.expiredCountCache.set(cacheKey, { count, timestamp: Date.now() });
      if (mapCache.expiredCountCache.size > EXPIRED_COUNT_CACHE_MAX) {
        const oldestKey = mapCache.expiredCountCache.keys().next().value;
        if (oldestKey !== undefined) mapCache.expiredCountCache.delete(oldestKey);
      }
      setExpiredOnlyCount(count);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [mapData?.bounds, currentZoom, displayedPostCount, selectedCategories, authUser?.id, followingIds]);

  const handleVisibleMarkerIdsChange = useCallback((ids: string[]) => {
    setVisibleMarkerIds(prev => {
      if (prev && prev.size === ids.length && ids.every(id => prev.has(id))) return prev;
      return new Set(ids);
    });
  }, []);

  // ── 지도 변경 핸들러 ─────────────────────────────────────────
  // ref를 사용해 stale closure 완전 방지
  const mapChangeCalledRef = useRef(false);

  const handleMapChange = useCallback((data: any) => {
    if (
      !isSelectingLocationRef.current &&
      !isSelectingAdLocationRef.current &&
      (isMapFrozenByCommentsRef.current || isPostDetailOpenRef.current || isPostListOverlayOpenRef.current || Date.now() < suppressMapChangesUntilRef.current)
    ) {
      return;
    }

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

    // 최초 호출은 throttle 없이 즉시 처리 → 앱 시작 시 마커 즉시 로딩
    if (!mapChangeCalledRef.current) {
      mapChangeCalledRef.current = true;
      if (data.level !== undefined) setCurrentZoom(data.level);
      setMapData(data);
      return;
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

  useEffect(() => {
    const center = mapData?.center || mapCenter || mapCache.lastCenter;
    if (!center?.lat || !center?.lng) return;

    const cacheKey = getMapAddressCacheKey(center.lat, center.lng);
    const cachedAddress = addressCacheRef.current.get(cacheKey);
    if (cachedAddress) {
      setCenterAddress(cachedAddress);
      return;
    }

    const saveAddressCache = (address: string) => {
      addressCacheRef.current.set(cacheKey, address);
      const entries = Array.from(addressCacheRef.current.entries()).slice(-MAP_ADDRESS_CACHE_LIMIT);
      addressCacheRef.current = new Map(entries);
      try {
        sessionStorage.setItem(MAP_ADDRESS_CACHE_STORAGE_KEY, JSON.stringify(entries));
      } catch (e) {}
    };

    const fallback = resolveOfflineLocationName(center.lat, center.lng);
    let cancelled = false;
    const timer = setTimeout(() => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.services) {
        if (!cancelled) {
          saveAddressCache(fallback);
          setCenterAddress(fallback);
        }
        return;
      }

      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(center.lng, center.lat, (result: any, status: any) => {
        if (cancelled) return;
        const address = status === kakao.maps.services.Status.OK
          ? formatMapAddress(result, center.lat, center.lng)
          : fallback;
        saveAddressCache(address);
        setCenterAddress(address);
      });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapData?.center?.lat, mapData?.center?.lng, mapCenter?.lat, mapCenter?.lng]);

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
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles:user_id(nickname, avatar_url, followers)')
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

  // ── 현재 위치 ────────────────────────────────────────────────
  const refreshUserLocationMarker = useCallback(async () => {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

    if (isNative) {
      try {
        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location === 'denied') return;
        if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
          const requested = await Geolocation.requestPermissions();
          if (requested.location === 'denied') return;
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
        if (pos?.coords) {
          updateUserLocationMarker({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch (e) {}
      return;
    }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateUserLocationMarker({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [updateUserLocationMarker]);

  const moveToCurrentLocation = useCallback(async (showToast = true, force = false) => {
    // route state로 위치가 이미 지정된 경우 자동 geolocation으로 덮어쓰지 않음
    // 단, 사용자가 현재위치 버튼을 직접 누른 경우에는 명시적 동작이므로 허용
    if (!force && locationLockedRef.current) return;

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
          window.setTimeout(() => {
            window.dispatchEvent(new Event('request-push-permission-now'));
          }, 250);

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
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMapCenter(loc);
          updateUserLocationMarker(loc);
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
      const tryGetPosition = (retryCount = 0) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setMapCenter(loc);
            updateUserLocationMarker(loc);
            if (toastId) dismissToast(toastId);
            if (showToast) showSuccess('현재 위치로 이동했습니다.');
          },
          (err) => {
            // POSITION_UNAVAILABLE (code 2): iOS kCLErrorLocationUnknown 등 일시적 실패
            // → 최대 2회 재시도 후 포기
            if (err.code === 2 && retryCount < 2) {
              setTimeout(() => tryGetPosition(retryCount + 1), 1500);
              return;
            }
            if (toastId) dismissToast(toastId);
            if (showToast) {
              if (err.code === 1) {
                showError('위치 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘을 눌러 위치 권한을 허용해주세요.');
              } else if (err.code === 2) {
                showError('위치를 확인할 수 없습니다. GPS를 켜거나 잠시 후 다시 시도해주세요.');
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
      };
      tryGetPosition();
    }
  }, [updateUserLocationMarker]);

  const handleCurrentLocation = () => moveToCurrentLocation(true, true);

  // ── 앱 시작 시 현재 위치 확인 ───────────────────────────────
  // 지도 페이지로 다시 돌아올 때는 지도 중심은 유지하되, 현재 위치 마커만 즉시 복원/갱신한다.
  useEffect(() => {
    if (mapCache.didInitialAutoLocate) {
      if (mapCache.keepPosition) mapCache.keepPosition = false;
      refreshUserLocationMarker();
      return;
    }
    mapCache.didInitialAutoLocate = true;

    if (initialFocusRef.current) {
      sessionStorage.removeItem('pendingMapFocus');
      refreshUserLocationMarker();
      return;
    }
    // 위치 선택 모드 진입 시 현재 위치로 자동 이동하지 않음 (보고 있던 지도 유지)
    if (locationLockedRef.current) {
      refreshUserLocationMarker();
      return;
    }
    // Write 페이지 등에서 돌아올 때 현재 위치로 자동이동하지 않음 (보고 있던 지도 유지)
    if (mapCache.keepPosition) {
      mapCache.keepPosition = false;
      refreshUserLocationMarker();
      return;
    }
    moveToCurrentLocation(false);
  }, [moveToCurrentLocation, refreshUserLocationMarker]);

  // ── 좋아요 토글 ──────────────────────────────────────────────
  const handleLikeToggle = useCallback((postId: string) => {
    if (!authUser?.id) return;
    // Optimistic UI: 즉시 상태 반영
    let currentlyLiked = false;
    const updater = (p: Post) => {
      if (p.id !== postId) return p;
      currentlyLiked = p.isLiked;
      return { ...p, isLiked: !p.isLiked, likes: !p.isLiked ? p.likes + 1 : Math.max(0, p.likes - 1) };
    };
    setAllPosts(prev => prev.map(updater));
    setGlobalTrendingPosts(prev => prev.map(updater));
    // DB 쓰기 (트리거가 posts.likes 자동 동기화)
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        // 실패 시 롤백
        const rollback = (p: Post) => p.id === postId
          ? { ...p, isLiked: currentlyLiked, likes: currentlyLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
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
    // 실시간 인기 포스팅 리스트에서도 즉시 제거
    setGlobalTrendingPosts(prev => prev.filter(p => p.id !== id));
  }, []);

  const handlePostUpdated = useCallback((id: string, content: string) => {
    const updateContent = (post: Post) => post.id === id ? { ...post, content } : post;
    setAllPosts(prev => {
      const updated = prev.map(updateContent);
      mapCache.posts = updated;
      return updated;
    });
    setGlobalTrendingPosts(prev => prev.map(updateContent));
  }, []);

  // ── PostDetail 핸들러 (useCallback으로 stable reference 보장) ──
  // 인라인 화살표 함수로 넘기면 매 렌더마다 새 reference가 생성되어
  // PostDetail 내부 useEffect가 cleanup→re-run 되면서 history.back()이 호출되어
  // popstate 이벤트로 인해 모달이 즉시 닫히는 버그를 방지함
  const handleClosePostDetail = useCallback(() => {
    suppressMapChangesUntilRef.current = Date.now() + 700;

    // X버튼으로 닫을 때 PostDetail이 pushState한 더미 히스토리 항목을 제거
    // history.back()으로 더미 항목을 pop하되, PostDetail 내부의 isClosingByButtonRef로
    // popstate 핸들러에서 중복 onClose 호출을 방지함
    if (history.state?.postDetailOpen) {
      // PostDetail 내부에 isClosingByButtonRef 플래그를 세팅하도록 커스텀 이벤트 발송
      window.dispatchEvent(new CustomEvent('post-detail-close-by-button'));
      history.back();
    }
    setSelectedPostId(null);
  }, []);

  const handlePostLocationClick = useCallback((lat: number, lng: number) => {
    setSelectedPostId(currentId => {
      const post = allPosts.find(p => p.id === currentId) || allPosts.find(p => p.lat === lat && p.lng === lng);
      if (post) focusPostOnMap(post, { lat: post.lat, lng: post.lng });
      else setMapCenter({ lat, lng });
      return null;
    });
  }, [allPosts, focusPostOnMap]);

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
    // Index가 화면에 보이는 경로일 때만 routeState를 처리한다.
    // (Index가 persistent하게 마운트되어 있어 다른 페이지의 location 변화로도
    //  이 effect가 트리거되기 때문에, 다른 페이지의 state가 잘못 소비되지 않도록 가드.)
    const pathIsIndex =
      location.pathname === '/' ||
      !/^\/(login|auth|terms|privacy-policy|popular|nearby-posts|search|post-search|video-search|notifications|messages|chat|friends|profile|post|user-profile|settings|write|flicks)(\/|$)/.test(location.pathname);
    if (!pathIsIndex) return;
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
      if (routeState.openPostDetail) {
        setIsPostListOpen(false);
        setTimeout(() => handleMarkerClick(routeState.post), 250);
      }
      setTimeout(() => { locationLockedRef.current = false; }, 5000);
    } else if (routeState.postId) {
      locationLockedRef.current = true;
      setIsPostListOpen(false);

      void (async () => {
        try {
          const { data, error } = await supabase
            .from('posts')
            .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles:user_id(nickname, avatar_url, followers)')
            .eq('id', routeState.postId)
            .single();

          if (error || !data) {
            showError('포스팅을 찾을 수 없습니다.');
            return;
          }

          const post = mapRawToPost(data, null);
          setAllPosts(prev => {
            const idx = prev.findIndex(p => p.id === post.id);
            const next = idx === -1 ? [post, ...prev] : [...prev];
            if (idx !== -1) next[idx] = post;
            mapCache.posts = next;
            return next;
          });
          focusPostOnMap(post, { lat: post.lat, lng: post.lng });
          setSelectedPostId(post.id);
        } catch (error) {
          console.error('[Index] notification post open error:', error);
          showError('포스팅을 여는 중 오류가 발생했습니다.');
        } finally {
          setTimeout(() => { locationLockedRef.current = false; }, 5000);
        }
      })();
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
      // 위치 선택 모드 진입 시 geolocation이 지도를 덮어쓰지 못하도록 잠금
      locationLockedRef.current = true;
      const initialLoc = mapCache.lastCenter;
      tempSelectedLocationRef.current = initialLoc;
      setTimeout(() => { setIsSelectingLocation(true); setTempSelectedLocation(initialLoc); }, 500);
    }
    if (routeState.startAdLocationSelection) {
      setIsPostListOpen(false);
      const initialAdLocation = routeState.initialCenter || mapCache.lastCenter || null;
      if (initialAdLocation) {
        locationLockedRef.current = true;
        setMapCenter(initialAdLocation);
        mapCache.lastCenter = initialAdLocation;
      }
      tempAdLocationRef.current = initialAdLocation;
      setTempAdLocation(initialAdLocation);
      setTimeout(() => {
        setIsSelectingAdLocation(true);
      }, 300);
    }
    if (routeState.adMarkerSaved && routeState.center) {
      setMapCenter(routeState.center);
      setCurrentZoom(4);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('highlight-marker', { detail: { id: routeState.adMarkerId || 'ad-map-marker', duration: 3000 } }));
      }, 1000);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location]);

  // isTrendingExpanded → ref 동기화 (핸들러 클로저에서 최신값 참조)
  useEffect(() => {
    isTrendingExpandedRef.current = isTrendingExpanded;
  }, [isTrendingExpanded]);

  // 마운트 시 한 번만 등록 — isTrendingExpandedRef로 활성 여부 체크
  // (useEffect deps에 isTrendingExpanded를 넣으면 등록/해제 타이밍 gap에서 이벤트 누락)
  useEffect(() => {
    const getTrendingScrollEl = (target: EventTarget | null): HTMLElement | null =>
      (target as HTMLElement)?.closest?.('[data-trending-scroll]') as HTMLElement | null;

    const saveStartY = (e: TouchEvent) => {
      if (!isTrendingExpandedRef.current) return;
      const el = getTrendingScrollEl(e.target);
      if (el) (el as any)._tStartY = e.touches[0].clientY;
    };

    const clearStartY = () => {
      const el = document.querySelector('[data-trending-scroll]') as HTMLElement | null;
      if (el) (el as any)._tStartY = null;
    };

    const preventTouchMove = (e: TouchEvent) => {
      if (!isTrendingExpandedRef.current) return;

      const panel = (e.target as HTMLElement).closest('[data-trending-panel]');
      if (!panel) return;

      const scrollEl = panel.querySelector('[data-trending-scroll]') as HTMLElement | null;
      if (scrollEl) {
        const startY = (scrollEl as any)._tStartY;
        if (startY == null) { e.preventDefault(); return; }
        const deltaY = e.touches[0].clientY - startY;
        const atTop = scrollEl.scrollTop <= 0;
        const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;
        if (!atTop && !atBottom) return;
        if (atTop && deltaY > 0) { e.preventDefault(); return; }
        if (atBottom && deltaY < 0) { e.preventDefault(); return; }
        return;
      }
      e.preventDefault();
    };

    const preventWheel = (e: WheelEvent) => {
      if (!isTrendingExpandedRef.current) return;

      const panel = (e.target as HTMLElement).closest?.('[data-trending-panel]');
      if (!panel) return;

      const scrollEl = panel.querySelector('[data-trending-scroll]') as HTMLElement | null;
      if (scrollEl) {
        const st = scrollEl.scrollTop;
        const atTop = st <= 0;
        const atBottom = st + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;
        if (atTop && e.deltaY < 0) { e.preventDefault(); return; }
        if (atBottom && e.deltaY > 0) { e.preventDefault(); return; }
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('touchstart', saveStartY, { passive: true, capture: true });
    document.addEventListener('touchend', clearStartY, { passive: true, capture: true });
    document.addEventListener('touchcancel', clearStartY, { passive: true, capture: true });
    document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });
    document.addEventListener('wheel', preventWheel, { passive: false, capture: true });

    return () => {
      document.removeEventListener('touchstart', saveStartY, { capture: true } as any);
      document.removeEventListener('touchend', clearStartY, { capture: true } as any);
      document.removeEventListener('touchcancel', clearStartY, { capture: true } as any);
      document.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
      document.removeEventListener('wheel', preventWheel, { capture: true } as any);
    };
  }, []);

  // ── 실시간 인기 TOP20 릴스 뷰어 ──────────────────────────────
  // 트렌딩 리스트의 N위를 누르면 ReelsViewer를 ranked 모드로 열어
  // 1~20위를 순서대로 보여주고, 클릭한 순위에서 시작한다.
  const [trendingReelsInitialPost, setTrendingReelsInitialPost] = useState<Post | null>(null);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setIsTrendingExpanded(false);
    // 패널 닫힘 애니메이션이 살짝 진행된 뒤 풀스크린 뷰어를 연다
    window.setTimeout(() => {
      setTrendingReelsInitialPost(post);
    }, 180);
  }, []);

  const handleCloseTrendingReels = useCallback(() => {
    setTrendingReelsInitialPost(null);
  }, []);

  // 안드로이드 백버튼 처리 + 전역 플래그
  // 트렌딩 릴스 뷰어가 열려 있는 동안 백버튼을 누르면 뷰어를 닫는다.
  useEffect(() => {
    if (!trendingReelsInitialPost) return;
    (window as any).__isTrendingReelsOpen = true;
    const handleBackClose = () => setTrendingReelsInitialPost(null);
    window.addEventListener('close-trending-reels-by-back', handleBackClose);
    return () => {
      (window as any).__isTrendingReelsOpen = false;
      window.removeEventListener('close-trending-reels-by-back', handleBackClose);
    };
  }, [trendingReelsInitialPost]);

  return (
    <>
      {showCssConfetti && <div className="css-confetti-container">{confettiPieces.map(p => <div key={p.id} className="css-confetti-piece animate" style={{ left: p.left, animationDelay: p.delay, backgroundColor: p.color }} />)}</div>}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        className="relative w-full overflow-hidden bg-gray-50 flex flex-col"
        style={{
          height: `${stableViewportHeight}px`,
          minHeight: `${stableViewportHeight}px`,
          maxHeight: `${stableViewportHeight}px`,
          paddingTop: isSelectingLocation ? '0px' : 'env(safe-area-inset-top)',
          paddingBottom: isSelectingLocation ? '0px' : 'env(safe-area-inset-bottom)'
        }}
      >

        {/* 화면 밖 마커 방향 표시 - overflow-hidden 밖에 fixed로 배치 */}
        {/* bounds와 dbCounts는 항상 stableSnapshot에서 함께 가져와 일관성 보장 (깜빡임 방지) */}
        {!isSelectingLocation && !isSelectingAdLocation && (
          <>
            <div className="fixed inset-0 z-[25] pointer-events-none">
              <OffScreenMarkerIndicator
                bounds={stableSnapshot.bounds || null}
                onClickDirection={(dir, pts) => {
                  const c = mapDataRef.current?.center || mapCenter;
                  if (!c || pts.length === 0) return;
                  let nearest = pts[0];
                  let minDist = Infinity;
                  for (const p of pts) {
                    const d = Math.pow(p.lat - c.lat, 2) + Math.pow(p.lng - c.lng, 2);
                    if (d < minDist) { minDist = d; nearest = p; }
                  }
                  setMapCenter({ lat: nearest.lat, lng: nearest.lng });
                }}
                topOffset={indicatorTopOffset}
                bottomOffset={indicatorBottomOffset}
                dbCounts={useClientSideCounts ? clientOffScreenCounts : stableSnapshot.dbCounts}
                disableInitialAnimation={restoredFromMapCacheRef.current}
              />
            </div>
            <MapLevelIndicator
              level={currentZoom}
              minLevel={3}
              maxLevel={11}
              markerHiddenFrom={7}
              style={{ top: `${mapLevelIndicatorTop}px` }}
              onLevelChange={(lvl) => {
                setCurrentZoom(lvl);
                currentZoomRef.current = lvl;
              }}
            />
          </>
        )}

        <div ref={mapAreaRef} className="flex-1 relative overflow-hidden flex flex-col">
          {/* 모두보기 카메라 셔터 애니메이션 - 지도 영역 안에만 표시 */}
          <ShutterOverlay ref={shutterRef} />
          {/* isolate: 히트맵 캔버스의 zIndex(100)가 부모 내부에 갇히도록 새 stacking context 생성
              → 좌/우 버튼(z-20), 지도 레벨 인디케이터(z-[35]) 등이 히트맵 위로 올라옴 */}
          <div className="absolute inset-0 isolate">
            <MapContainer
              posts={displayedMarkers}
              ghostPosts={ghostPosts}
              viewedPostIds={viewedIds}
              onMarkerClick={handleMarkerClick}
              onMapChange={handleMapChange}
              onVisibleMarkerIdsChange={handleVisibleMarkerIdsChange}
              center={mapCenter}
              level={currentZoom}
              searchResultLocation={searchResultLocation}
              onMapClick={() => setSearchResultLocation(null)}
              userLocation={userLocation}
              draggable={!isTrendingExpanded}
              hideUserLocation={false}
              toastTopOffset={indicatorTopOffset}
            />

          </div>


          <AnimatePresence>
            {isSelectingLocation && (
              <div className="absolute inset-0 z-[3000] pointer-events-none">
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative" style={{ marginBottom: '58px' }}>
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
              <div className="absolute inset-0 z-[3000] pointer-events-none">
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative" style={{ marginBottom: '58px' }}>
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
              <motion.div
                initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.96 }}
                animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 8px)' }}
                className="absolute left-1/2 z-[21] flex h-8 w-[min(13.5rem,calc(100vw-11rem))] items-center justify-center gap-1.5 rounded-full border border-white/70 bg-white/72 px-2.5 shadow-[0_10px_28px_rgba(79,70,229,0.18)] backdrop-blur-2xl"
              >
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                  <MapPin className="h-2.5 w-2.5 fill-white/20" />
                </span>
                <span className="min-w-0 truncate text-[10.5px] font-black tracking-[-0.02em] text-slate-800">
                  {centerAddress}
                </span>
              </motion.div>

              <div
                style={{ bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 8px)' }}
                className={cn("absolute left-4 z-20 flex flex-col gap-2", isTrendingExpanded && "pointer-events-none")}
              >
                <button onClick={() => setIsCategoryOpen(true)} className="w-12 h-12 bg-white/30 backdrop-blur-xl text-gray-700 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="4" y1="6" x2="11" y2="6" />
                    <circle cx="13.5" cy="6" r="2" />
                    <line x1="15.5" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="7" y2="12" />
                    <circle cx="9.5" cy="12" r="2" />
                    <line x1="11.5" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="15" y2="18" />
                    <circle cx="17.5" cy="18" r="2" />
                    <line x1="19.5" y1="18" x2="20" y2="18" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setIsSearchOpen(true);
                    window.dispatchEvent(new CustomEvent('open-place-search', {
                      detail: {
                        onSelect: (p: { lat: number; lng: number }) => {
                          setMapCenter({ lat: p.lat, lng: p.lng });
                          setSearchResultLocation({ lat: p.lat, lng: p.lng });
                        }
                      }
                    }));
                  }}
                  className="w-12 h-12 bg-white/30 backdrop-blur-xl text-gray-700 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/50"
                >
                  <Search className="w-6 h-6" />
                </button>
                <button onClick={handleCurrentLocation} className="w-12 h-12 bg-white/30 backdrop-blur-xl text-gray-700 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/50"><Navigation className="w-6 h-6 fill-gray-700" /></button>
              </div>

              <div
                style={{ bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 8px)' }}
                className={cn("absolute right-4 z-20 flex flex-col items-center gap-3", isTrendingExpanded && "pointer-events-none")}
              >
                <button
                  onClick={() => navigate('/write')}
                  aria-label="사진/영상 업로드"
                  className="w-16 h-16 bg-white/30 backdrop-blur-xl text-gray-700 rounded-[24px] flex flex-col items-center justify-center shadow-lg active:scale-90 transition-all border border-white/50 gap-0.5"
                >
                  <Plus className="w-6 h-6" strokeWidth={2.6} />
                  <span className="text-[10px] font-black tracking-tight leading-none">업로드</span>
                </button>
                <div className="relative">
                  <button
                    ref={viewAllBtnRef}
                    onClick={() => {
                      // 케이스 A: 화면에 마커가 있음 → 기존 동작
                      // 케이스 B: 화면 마커는 0이지만 24h 지난 포스트가 있음 → NearbyPosts를 expired-only 모드로 진입
                      if (currentZoom >= 7) return;

                      if (displayedPostCount === 0 && expiredOnlyCount > 0) {
                        const latestMapData = mapDataRef.current || mapData;
                        const returnCenter = latestMapData?.center || mapCache.lastCenter || mapCenter || { lat: 37.5665, lng: 126.9780 };
                        const returnZoom = currentZoomRef.current || currentZoom;
                        mapCache.lastCenter = returnCenter;
                        mapCache.lastZoom = returnZoom;
                        mapCache.keepPosition = true;

                        sessionStorage.setItem('nearby-posts-payload', JSON.stringify({
                          initialPosts: [],
                          mapCenter: returnCenter,
                          currentBounds: latestMapData?.bounds || mapData?.bounds || { sw: { lat: 33, lng: 124 }, ne: { lat: 39, lng: 132 } },
                          selectedCategories,
                          openedViewedIds: Array.from(viewedIds),
                          zoom: returnZoom,
                          expiredOnly: true,
                        }));

                        shutterRef.current?.trigger(() => {
                          navigate('/nearby-posts');
                        });
                        return;
                      }

                      if (displayedPostCount > 0) {
                        // 포스트 목록 미리 계산
                        const adIds = mapVisibleMarkers.filter(p => p.isAd).map(p => p.id);
                        setPostListOpenedViewedIds(new Set([...viewedIds, ...adIds]));
                        const boundsFiltered = mapVisibleMarkers;
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
                        const latestMapData = mapDataRef.current || mapData;
                        const returnCenter = latestMapData?.center || mapCache.lastCenter || mapCenter || { lat: 37.5665, lng: 126.9780 };
                        const returnZoom = currentZoomRef.current || currentZoom;
                        mapCache.lastCenter = returnCenter;
                        mapCache.lastZoom = returnZoom;
                        mapCache.keepPosition = true;

                        sessionStorage.setItem('nearby-posts-payload', JSON.stringify({
                          initialPosts: finalList,
                          mapCenter: returnCenter,
                          currentBounds: latestMapData?.bounds || mapData?.bounds || { sw: { lat: 33, lng: 124 }, ne: { lat: 39, lng: 132 } },
                          selectedCategories,
                          openedViewedIds: Array.from(new Set([...viewedIds, ...adIds])),
                          zoom: returnZoom,
                        }));

                        // 인기 포스팅처럼 일반 라우트 페이지로 이동
                        shutterRef.current?.trigger(() => {
                          navigate('/nearby-posts');
                        });
                      }
                    }}
                    disabled={currentZoom >= 7 || (displayedPostCount === 0 && expiredOnlyCount === 0)}
                    className={cn(
                      "w-16 h-16 bg-amber-400 rounded-[24px] flex flex-col items-center justify-center text-gray-900 shadow-[0_15px_30px_rgba(251,191,36,0.45)] active:scale-95 transition-all border-2 border-white/30 overflow-hidden relative gap-0.5",
                      // 활성 상태일 때는 항상 연한 앰버 펄스 이펙트 적용
                      currentZoom < 7 && (displayedPostCount > 0 || expiredOnlyCount > 0) && "now-here-amber-pulse",
                      // 완전 비활성화 (어떤 포스트도 없음)
                      (currentZoom >= 7 || (displayedPostCount === 0 && expiredOnlyCount === 0)) && "opacity-50 grayscale bg-slate-800/40 shadow-none text-white",
                    )}
                  >
                    <span className="text-[9px] font-black tracking-widest relative z-10 leading-none text-gray-900/60">ALL</span>
                    <span className="text-[11px] font-black relative z-10 leading-tight">
                      여기 보기
                    </span>
                    <div className="flex flex-col items-center gap-[3px] mt-0.5 relative z-10">
                      <div className="w-8 h-[2px] rounded-full bg-gray-900/40" />
                      <div className="w-5 h-[2px] rounded-full bg-gray-900/25" />
                    </div>
                  </button>
                  {/* 뱃지: 항상 24h 내 표시되는 마커 수만 카운팅 (expiredOnly는 절대 카운트하지 않음) */}
                  {displayedPostCount > 0 && currentZoom < 7 && (
                    <div className="absolute -top-2 -right-2 bg-amber-300 text-gray-900 text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">
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
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[11999] bg-black/55"
            onClick={() => setIsTrendingExpanded(false)}
          >
            <div className="absolute left-0 right-0 flex flex-col items-center gap-2 pointer-events-none select-none" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>              
              <span className="text-white/80 text-sm font-bold tracking-tight drop-shadow-md">여기를 눌러도 닫혀요</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isPostListOpen && !isSearchOpen && !trendingReelsInitialPost && (
        <div
          ref={trendingDivRef}
          className={cn(
            "fixed top-[calc(env(safe-area-inset-top,0px)+74px)] left-4 right-4 z-[12000] pointer-events-none transition-opacity duration-200",
          )}
          style={{ touchAction: isTrendingExpanded ? 'none' : 'auto' }}
        >
          <div className="max-w-md mx-auto pointer-events-auto relative">
            <TrendingPosts
              posts={globalTrendingPosts}
              refreshTick={trendingRefreshTick}
              onPostClick={handleTrendingPostClick}
              isExpanded={isTrendingExpanded}
              onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
              maxHeight="calc(100dvh - env(safe-area-inset-top, 0px) - 74px - env(safe-area-inset-bottom, 0px) - 3rem - 74px)"
            />
            {/* 마커 24시간 자동 삭제 안내 -
                트렌딩 패널의 레이아웃 흐름 밖(absolute)에 배치하여 패널의 DOM
                높이에 영향을 주지 않도록 함. 이렇게 하면 지도 레벨 인디케이터
                위치 계산(trendingDivRef의 rect.bottom 기반)이 원래대로 유지되고,
                안내문은 지도 레벨 인디케이터 앞으로 자연스럽게 겹쳐 보임.
                (안내문은 10초 후 자동으로 사라짐) */}
            {!isTrendingExpanded && (
              <div className="absolute left-0 right-0 top-full">
                <MarkerExpiryNotice />
              </div>
            )}
          </div>

        </div>
      )}

      <AnimatePresence>
        {isPostListOpen && (
          <PostListOverlay
            key="post-list-overlay"
            isOpen={isPostListOpen}
            onClose={() => {
              if (history.state?.postListOverlayOpen) {
                history.replaceState({}, '');
              }
              setIsPostListOpen(false);
            }}
            initialPosts={postListInitialPosts}
            mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
            currentBounds={mapData?.bounds || { sw: { lat: 33, lng: 124 }, ne: { lat: 39, lng: 132 } }}
            selectedCategories={selectedCategories}
            authUserId={authUser?.id}
            onDeletePost={handlePostDeleted}
            onUpdatePost={handlePostUpdated}
            openedViewedIds={postListOpenedViewedIds}
            viewedIds={viewedIds}
            markAsViewed={markAsViewed}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPostId && allPosts.some(p => p.id === selectedPostId) && (
          <PostDetail
            key={`post-detail-modal-${selectedPostId}`}
            posts={allPosts}
            initialIndex={allPosts.findIndex(p => p.id === selectedPostId)}
            isOpen={true}
            onClose={handleClosePostDetail}
            onDelete={handlePostDeleted}
            onUpdate={handlePostUpdated}
            onViewPost={markAsViewed}
            onLikeToggle={handleLikeToggle}
            onLocationClick={handlePostLocationClick}
          />
        )}
      </AnimatePresence>

      {/* PlaceSearchOverlay는 App.tsx에 전역 마운트됨. 여기선 select 콜백만 처리. */}

      {/* 실시간 인기 TOP20 릴스 뷰어
          Flicks 페이지와 동일하게 Header(top)/BottomNav(bottom) 사이의 영역에
          embedded 모드로 인라인 렌더링한다. 전역 chrome(헤더/바텀네브)은 그대로 유지. */}
      {/* TrendingReels가 열렸을 때 BottomNav 알약 좌·우/아래로 지도가 비치지 않도록
          화면 하단 BottomNav 영역만 검은색으로 가리는 마스크 (영상 영역 크기는 그대로 유지). */}
      {!!trendingReelsInitialPost && (
        <div
          aria-hidden="true"
          className="bg-black pointer-events-none"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            zIndex: 11000,
          }}
        />
      )}
      {!!trendingReelsInitialPost && (
        <div
          className="bg-black"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
            // Header(z=12600), BottomNav(z=20000)보다 낮고 TrendingPosts(12000)보다 살짝 낮게
            // → Header/BottomNav가 위에 떠 있는 상태에서 본문 영역만 가린다.
            zIndex: 11000,
          }}
        >
          <ReelsViewer
            isOpen={true}
            initialPost={trendingReelsInitialPost}
            pool={globalTrendingPosts}
            mode="ranked"
            rankedPosts={globalTrendingPosts}
            onClose={handleCloseTrendingReels}
            onDelete={handlePostDeleted}
            onUpdate={handlePostUpdated}
            embedded
            showInlineCloseButton
          />
        </div>
      )}
    </>
  );
};

export default Index;