"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import TimeSlider from '@/components/TimeSlider';
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
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

const fireConfetti = (options: any) => {
  try {
    const f = (window as any).confetti || confetti;
    if (f) f(options);
  } catch (e) {
    console.error('[Confetti] Fire error:', e);
  }
};

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  
  const [showCssConfetti, setShowCssConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<any[]>([]);

  const triggerConfetti = useCallback(() => {
    try {
      fireConfetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.65 },
        zIndex: 999999,
        colors: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#22d3ee'],
        scalar: 1.0
      });

      const duration = 1.2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 25, spread: 360, ticks: 60, zIndex: 999999, scalar: 0.8 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 20 * (timeLeft / duration);
        fireConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#4F46E5', '#F59E0B'] });
        fireConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#10B981', '#EF4444'] });
      }, 300);

      const pieces = Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.5}s`,
        color: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#22d3ee'][Math.floor(Math.random() * 5)]
      }));
      setConfettiPieces(pieces);
      setShowCssConfetti(true);
      setTimeout(() => setShowCssConfetti(false), 3000);
    } catch (e) { console.error('[Confetti] Confetti error:', e); }
  }, []);

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [globalTrendingPosts, setGlobalTrendingPosts] = useState<Post[]>([]);
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 5);
  
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPostListOpen, setIsPostListOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(48); 
  const { session } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const isFirstLoadRequested = useRef(false);

  // ✅ [NEW] 이전 요청 위치를 저장하여 미세한 이동 시 중복 요청 방지
  const lastRequestRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  useEffect(() => {
    if (session?.user) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [session]);

  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResultLocation, setSearchResultLocation] = useState<{ lat: number; lng: number } | null>(null);

  const throttleTimer = useRef<any>(null);
  const isSyncing = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  // ✅ 지도 이동 완료 후 적용할 하이라이트 id 예약
  const focusPostOnMap = useCallback((post: Post, center?: { lat: number; lng: number }) => {
    if (post.lat === null || post.lng === null) return;
    
    // ✅ [FIX] 리스트에서 클릭한 포스트가 현재 지도 데이터(allPosts)에 없는 경우, 
    // 즉시 추가하여 MapContainer가 마커를 생성할 수 있도록 보장합니다.
    setAllPosts((prev) => {
      const exists = prev.some((item) => item.id === post.id);
      if (exists) return prev;
      
      const newPost = { ...post };
      const combined = [newPost, ...prev];
      mapCache.posts = combined;
      return combined;
    });

    setSelectedPostId(null);
    setSearchResultLocation(null);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);

    // ✅ 하이라이트 초기화 및 지도 이동 시작
    setHighlightedPostId(null);
    setMapCenter(center || { lat: post.lat, lng: post.lng });

    // ✅ [FIX] 핑 효과(하이라이트) 이벤트 발송 시간을 지도 이동 애니메이션 완료 시점(약 1.2s)에 맞춰 조정
    // 처음 클릭 시에도 마커가 생성된 후 충분한 시간이 흐른 뒤 실행되도록 1500ms로 설정
    highlightTimeoutRef.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('highlight-marker', { 
        detail: { id: post.id, duration: 2500 } 
      }));
      highlightTimeoutRef.current = null;
    }, 1500);
  }, []);

  const mapDbToPost = useCallback(async (rawPost: any): Promise<Post> => {
    if (!rawPost || !rawPost.id) return null as any;
    try {
      // ✅ [OPTIMIZATION] 이제 fetchPostsInBounds에서 모든 정보를 가져오므로, 
      // 추가적인 서버 요청(single() 조회 등)을 모두 제거하여 서버 부하를 줄입니다.
      const p = rawPost;

      const contentText = p.content || '';
      const isAd = contentText.trim().startsWith('[AD]');
      const likesCount = Number(p.likes || 0);
      const BROKEN_IDS = ["photo-1548199973-03cbf5292374"];
      const HIGH_RES_FALLBACK = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90";

      const sanitizeUrl = (url: any) => {
        if (!url || typeof url !== 'string') return HIGH_RES_FALLBACK + "&sig=" + p.id;
        const clean = url.trim();
        if (clean.includes('supabase.co/storage')) return clean;
        if (clean.includes('unsplash.com')) {
          const pexelsPool = ["https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg", "https://images.pexels.com/photos/2349141/pexels-photo-2349141.jpeg", "https://images.pexels.com/photos/1486337/pexels-photo-1486337.jpeg"];
          let h = 0;
          for(let i = 0; i < p.id.length; i++) h = Math.imul(31, h) + p.id.charCodeAt(i) | 0;
          return pexelsPool[Math.abs(h) % pexelsPool.length];
        }
        if (BROKEN_IDS.some(id => clean.includes(id)) || !clean.startsWith('http')) return HIGH_RES_FALLBACK + "&sig=" + p.id;
        return clean;
      };

      let finalImage = sanitizeUrl(p.image_url);
      if (p.image_url && p.image_url.includes('supabase.co/storage')) finalImage = p.image_url;
      else if (p.youtube_url && (!finalImage || finalImage.includes('pexels.com'))) {
        const thumb = getYoutubeThumbnail(p.youtube_url);
        if (thumb) finalImage = thumb;
      }
      
      const validImages = Array.isArray(p.images) && p.images.length > 0 ? p.images.map(img => img.includes('supabase.co/storage') ? img : sanitizeUrl(img)) : [finalImage];
      let borderType: 'diamond' | 'gold' | 'silver' | 'popular' | 'none' = 'none';
      if (Number(likesCount) >= 9000) borderType = 'popular';
      else if (!isAd) {
        let h = 0;
        const idStr = p.id.toString();
        for(let i = 0; i < idStr.length; i++) h = Math.imul(31, h) + idStr.charCodeAt(i) | 0;
        const val = Math.abs(h % 1000) / 1000;
        if (val < 0.03) borderType = 'diamond'; else if (val < 0.08) borderType = 'gold';
      }
      
      // [CRITICAL FIX] is_seed_data인 경우 DB의 user_name을 절대 prof로 덮어쓰지 않음
      const isSeed = p.is_seed_data === true || p.is_seed_data === 'true';
      const userName = isSeed
        ? (p.user_name || '탐험가')
        : (p.user_name || p.profiles?.nickname || '탐험가');
      const userAvatar = isSeed
        ? (p.user_avatar || '')
        : (p.user_avatar || p.profiles?.avatar_url || '');

    return {
        id: p.id, isAd, isGif: false, isInfluencer: ['gold', 'diamond'].includes(borderType),
        user: { id: p.user_id || '', name: userName, avatar: userAvatar },
        content: contentText.replace(/^\[AD\]\s*/, '') || '',
        location: p.location_name || '알 수 없는 장소',
        lat: p.latitude, lng: p.longitude, likes: likesCount, commentsCount: 0, comments: [],
        image: finalImage, images: validImages, youtubeUrl: p.youtube_url, videoUrl: p.video_url,
        category: p.category || 'none', isLiked: false, createdAt: new Date(p.created_at), borderType
      };
    } catch (err) { 
      console.error('[Index] mapDbToPost error:', err);
      return null as any; 
    }
  }, []);

  const fetchGlobalTrending = useCallback(async () => {
    try {
      // ✅ [OPTIMIZATION] 'posts' 전체 조회를 방지하기 위해 명확한 정렬과 제한(limit)을 사용합니다.
      // 또한, 최근 7일 이내의 인기 게시물만 가져오도록 조건을 추가할 수 있습니다.
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            nickname,
            avatar_url
          )
        `)
        .gt('created_at', sevenDaysAgo.toISOString()) // 최근 7일 데이터로 제한
        .order('likes', { ascending: false }) // 좋아요 순으로 정렬
        .limit(50); // 100개에서 50개로 줄여 데이터 전송량 최적화

      if (!error && data) {
        const normalizedData = data.map(p => ({
          ...p,
          // [CRITICAL FIX] 시드 데이터는 user_name 우선, 아닐 때만 profiles.nickname 사용
          user_name: (p.is_seed_data || p.user_name) ? p.user_name : (p.profiles?.nickname || '탐험가'),
          user_avatar: (p.is_seed_data || p.user_avatar) ? p.user_avatar : (p.profiles?.avatar_url || '')
        }));

        const mappedRaw = await Promise.all(normalizedData.map(mapDbToPost));
        const validMapped = mappedRaw.filter(p => p !== null && p.id);
        
        const sorted = [...validMapped].sort((a, b) => b.likes - a.likes);
        const trending = sorted.slice(0, 20).map((p, idx) => ({ ...p, rank: idx + 1 }));
        
        setGlobalTrendingPosts(trending);
        
        // setAllPosts 내부 로직은 유지하되, 무한 리렌더링을 유발할 수 있는 조건을 체크
      }
    } catch (err) { 
      console.error('[Trending] Fetch error:', err); 
    } finally {
      setIsInitialLoadDone(true);
    }
  }, [mapDbToPost]);

  // ✅ [FIX] fetchGlobalTrending이 불필요하게 자주 호출되지 않도록 마운트 시 1회만 실행되도록 보장
  useEffect(() => { 
    fetchGlobalTrending(); 
  }, []); // 의존성 배열에서 fetchGlobalTrending을 제거하거나, 내부에서 한 번만 실행되도록 관리

  const syncPostsWithSupabase = useCallback(async (forceBounds?: any, forceZoom?: number) => {
    const targetBounds = forceBounds || mapData?.bounds;
    const center = mapData?.center;
    const zoomToUse = forceZoom ?? currentZoom;

    // ✅ [FIX] 초기 로딩 중에도 firstLoadRequested가 true이면 요청을 허용하도록 로직 수정
    if (!targetBounds || !center || isSyncing.current) return;
    if (!isInitialLoadDone && !isFirstLoadRequested.current) return;

    if (lastRequestRef.current) {
      const { lat: lastLat, lng: lastLng, zoom: lastZoom } = lastRequestRef.current;
      const latDiff = Math.abs(center.lat - lastLat);
      const lngDiff = Math.abs(center.lng - lastLng);
      
      // 줌 레벨이 같고, 이동 거리가 매우 작으면(약 10~20m 이내) 요청 스킵
      if (zoomToUse === lastZoom && latDiff < 0.0001 && lngDiff < 0.0001) {
        return;
      }
    }

    isSyncing.current = true;
    lastRequestRef.current = { lat: center.lat, lng: center.lng, zoom: zoomToUse };

    const { sw, ne } = targetBounds;
    try {
      const dbPosts = await fetchPostsInBounds(sw, ne, zoomToUse, center);
      const validDbIds = new Set(dbPosts.map(p => p.id));
      
      // ✅ [OPTIMIZATION] 마커용 데이터는 최소한의 매핑만 수행 (Full mapping은 상세 페이지에서 수행)
      const mappedPosts: Post[] = dbPosts.map(p => {
        const isAd = p.content?.trim().startsWith('[AD]') || false;
        let borderType: any = 'none';
        if (Number(p.likes) >= 9000) borderType = 'popular';
        else if (!isAd) {
          // ✅ [FIX] 마커 렌더링을 위해 borderType 계산 로직 동기화 (ID 기반 해시)
          let h = 0;
          const idStr = p.id.toString();
          for(let i = 0; i < idStr.length; i++) h = Math.imul(31, h) + idStr.charCodeAt(i) | 0;
          const val = Math.abs(h % 1000) / 1000;
          if (val < 0.03) borderType = 'diamond'; else if (val < 0.08) borderType = 'gold';
        }
        
        return {
          id: p.id,
          isAd,
          isGif: false,
          lat: p.latitude,
          lng: p.longitude,
          latitude: p.latitude,
          longitude: p.longitude,
          likes: Number(p.likes || 0),
          image: p.image_url || '',
          image_url: p.image_url || '',
          youtubeUrl: p.youtube_url,
          videoUrl: p.video_url,
          category: p.category || 'none',
          createdAt: new Date(p.created_at),
          borderType,
          isInfluencer: ['gold', 'diamond'].includes(borderType),
          // [FIX] DB에 저장된 user_name/user_avatar를 즉시 활용 (지연 로딩 제거)
          user: {
            id: p.user_id,
            name: p.user_name || '탐험가',
            avatar: p.user_avatar || ''
          },
          is_seed_data: p.is_seed_data,
          content: p.content || '',
          location: p.location_name || '',
          images: p.image_url ? [p.image_url] : [],
          isLiked: false,
          commentsCount: 0,
          comments: []
        };
      });

      setAllPosts(prev => {
        const postsToDelete: Post[] = prev.filter(p => {
          const inBounds = p.lat >= Math.min(sw.lat, ne.lat) && p.lat <= Math.max(sw.lat, ne.lat) && p.lng >= Math.min(sw.lng, ne.lng) && p.lng <= Math.max(sw.lng, ne.lng);
          return inBounds && !validDbIds.has(p.id) && !p.isNewRealtime;
        });
        if (postsToDelete.length > 0) {
          postsToDelete.forEach(p => window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id: p.id } })));
          setTimeout(() => {
            const deletedIds = new Set(postsToDelete.map(p => p.id));
            setAllPosts(current => current.filter(p => !deletedIds.has(p.id)));
            setDisplayedMarkers(current => current.filter(p => !deletedIds.has(p.id)));
          }, 450);
        }
        
        // ✅ [FIX] mappedPosts가 최소 정보만 가지고 있으므로, 
        // 기존에 이미 Full 정보를 가지고 있던 포스트가 덮어씌워지지 않도록 merge 로직 개선
        const mergedPosts = mappedPosts.map(newP => {
          const existing = prev.find(p => p.id === newP.id);
          // 기존 데이터가 더 상세한 정보를 가지고 있다면 유지하되, user 정보는 newP의 것이 우선
          if (existing && existing.content) {
            return { ...existing, ...newP, content: existing.content, location: existing.location };
          }
          return newP;
        });

        const existingIds = new Set(prev.map(p => p.id));
        const combined = [...mergedPosts.filter(p => !existingIds.has(p.id)), ...prev].slice(0, 3000);
        mapCache.posts = combined;
        return combined;
      });
    } catch (err) { console.error(err); } finally { isSyncing.current = false; }
  }, [mapData, currentZoom, mapDbToPost]);

  useEffect(() => { 
    if (mapData && isInitialLoadDone) {
      syncPostsWithSupabase(); 
    } else if (mapData && !isInitialLoadDone && !isFirstLoadRequested.current) {
      // ✅ [FIX] 맵 데이터는 준비되었으나 초기 데이터 로딩(인기 포스팅)이 진행 중인 경우,
      // 최초 한 번은 즉시 현재 영역의 데이터를 가져오도록 강제 실행합니다.
      isFirstLoadRequested.current = true;
      syncPostsWithSupabase(mapData.bounds, currentZoom);
    }
  }, [mapData, isInitialLoadDone, syncPostsWithSupabase, currentZoom]);

  const handleMapChange = useCallback((data: any) => {
    const zoomChanged = data.level !== undefined && data.level !== currentZoom;
    if (zoomChanged) {
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      setMapData(data); setCurrentZoom(data.level);
      mapCache.lastCenter = data.center; mapCache.lastZoom = data.level;
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      setTimeout(() => { syncPostsWithSupabase(data.bounds, data.level); }, 50);
      return;
    }
    if (throttleTimer.current) return;
    throttleTimer.current = setTimeout(() => {
      setMapData(data); mapCache.lastCenter = data.center;
      if (data.level !== undefined) { setCurrentZoom(data.level); mapCache.lastZoom = data.level; }
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      throttleTimer.current = null;
    }, 100);
  }, [isSelectingLocation, currentZoom, syncPostsWithSupabase]);

  useEffect(() => {
    if (!mapData?.bounds) return;
    if (currentZoom >= 11) { if (displayedMarkers.length > 0) setDisplayedMarkers([]); return; }
    
    const { sw, ne } = mapData.bounds;
    const center = mapData.center;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;

    // ✅ 필터링 및 거리순 정렬 로직 최적화
      const uniquePosts = Array.from(new Map(allPosts.filter(post => {
      if (!post || post.lat === null || post.lng === null || blockedIds.has(post.user.id)) return false;
      
      const margin = 0.002;
      const inBounds = post.lat >= Math.min(sw.lat, ne.lat) - margin &&
                       post.lat <= Math.max(sw.lat, ne.lat) + margin &&
                       post.lng >= Math.min(sw.lng, ne.lng) - margin &&
                       post.lng <= Math.max(sw.lng, ne.lng) + margin;
      
      if (!inBounds) return false;
      
      const postTime = new Date(post.createdAt).getTime();
      const isWithinTime = (now - postTime) <= timeLimitMs;
      
      if (!isWithinTime) return false;
      
      if (selectedCategories.includes('mine')) return authUser && post.user.id === authUser.id;
      
      // ✅ [FIX] 카테고리 필터 로직: 'hot'이나 'influencer'가 선택되었을 때의 조건을 명확히 합니다.
      const isHot = post.borderType === 'popular' || post.likes >= 9000;
      const isInfluencer = post.isInfluencer || ['gold', 'diamond'].includes(post.borderType || 'none');
      const isAd = post.isAd;

      if (selectedCategories.includes('all')) return true;

      return selectedCategories.includes(post.category || 'none') ||
             (selectedCategories.includes('hot') && isHot) ||
             (selectedCategories.includes('influencer') && isInfluencer) ||
             isAd; // 광고는 항상 노출되거나 'all'에서 노출되도록 보장
    }).map(p => {
      const dist = Math.sqrt(Math.pow(p.lat - center.lat, 2) + Math.pow(p.lng - center.lng, 2));
      return [p.id, { ...p, _dist: dist }];
    })).values());

    const sortedPosts = (uniquePosts as any[]).sort((a, b) => a._dist - b._dist);
    
    setDisplayedMarkers(sortedPosts);
  }, [mapData?.bounds, mapData?.center, timeValue, selectedCategories, allPosts, blockedIds, authUser, currentZoom]);

  const handleLikeToggle = useCallback((postId: string) => {
    const updater = (post: Post) => post.id === postId ? { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 } : post;
    setAllPosts(prev => prev.map(updater));
    setGlobalTrendingPosts(prev => prev.map(updater));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true); await fetchGlobalTrending();
    if (mapData?.bounds) {
      const dbPosts = await fetchPostsInBounds(mapData.bounds.sw, mapData.bounds.ne);
      const mapped = await Promise.all(dbPosts.map(mapDbToPost));
      setAllPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        const combined = [...mapped.filter(p => p && !ids.has(p.id)), ...prev];
        mapCache.posts = combined; return combined;
      });
    }
    setIsRefreshing(false); showSuccess('데이터를 새로고침했습니다.');
  }, [fetchGlobalTrending, mapData, mapDbToPost]);

  const handleMarkerClick = useCallback(async (lightPost: Post) => {
    // 1. 즉시 ID 설정하여 모달 오픈 시도 (UI는 즉시 응답)
    setSelectedPostId(lightPost.id);
    
    // 2. [FIX] 지도의 마커 정보(lightPost)는 최소 데이터만 있으므로, 
    // 상세 정보가 필요한 시점(클릭 시)에만 서버에서 조인된 전체 데이터를 가져옵니다.
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            nickname,
            avatar_url
          )
        `)
        .eq('id', lightPost.id)
        .single();
        
      if (!error && data) {
        // [CRITICAL FIX] 시드 데이터(is_seed_data) 또는 user_name이 저장되어 있으면 그것을 우선 사용
        const normalizedData = {
          ...data,
          user_name: (data.is_seed_data || data.user_name) ? data.user_name : (data.profiles?.nickname || '탐험가'),
          user_avatar: (data.is_seed_data || data.user_avatar) ? data.user_avatar : (data.profiles?.avatar_url || '')
        };

        const full = await mapDbToPost(normalizedData);
        if (full) {
          setAllPosts(prev => {
            const index = prev.findIndex(p => p.id === full.id);
            if (index === -1) return [full, ...prev];
            const next = [...prev];
            next[index] = full;
            return next;
          });
          
          setDisplayedMarkers(prev => {
            const index = prev.findIndex(p => p.id === full.id);
            if (index === -1) return prev;
            const next = [...prev];
            next[index] = full;
            return next;
          });
        }
      }
    } catch (err) { 
      console.error('[Index] Failed to fetch full post data on click:', err); 
    }
  }, [mapDbToPost]);

  const handleCurrentLocation = async () => {
    // 이미 찾는 중이면 중복 실행 방지
    if (isRefreshing) return;
    
    const toastId = showLoading('현재 위치를 확인 중입니다...');
    try {
      // ✅ [FIX] 타임아웃을 더 짧게 잡고, 실패 시 즉시 중단하여 시스템 부하를 줄입니다.
      const pos = await Geolocation.getCurrentPosition({ 
        enableHighAccuracy: false, 
        timeout: 8000,             // 8초로 단축 (너무 오래 기다리지 않게 함)
        maximumAge: 60000          // 1분 이내의 캐시 정보 적극 활용
      });
      
      if (pos && pos.coords) {
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        dismissToast(toastId); 
        showSuccess('현재 위치로 이동했습니다.');
      }
    } catch (err: any) { 
      // ✅ [CLEANUP] 반복적인 시스템 에러 메시지는 콘솔에 한 번만 요약해서 출력
      console.warn('[Geolocation] 위치 정보를 사용할 수 없는 환경입니다. (Error Code 2)');
      dismissToast(toastId); 
      
      // 사용자에게 브라우저 설정을 확인하도록 안내
      showError('위치 정보를 사용할 수 없습니다. 브라우저의 위치 권한과 GPS 설정을 확인해주세요.');
      
      // 실패 시 마지막 위치로 부드럽게 복구
      if (mapCache.lastCenter) {
        setMapCenter(mapCache.lastCenter);
      }
    }
  };

  // ✅ [REALTIME] 포스트 테이블 실시간 구독 설정 (INSERT & DELETE)
  const channelIdRef = useRef(`posts-channel-${Math.random().toString(36).substring(7)}`);

  // ✅ [OPTIMIZATION] 의존성 배열 최소화를 위한 refs
  const mapDbToPostRef = useRef(mapDbToPost);
  const triggerConfettiRef = useRef(triggerConfetti);

  // refs 업데이트
  useEffect(() => {
    mapDbToPostRef.current = mapDbToPost;
    triggerConfettiRef.current = triggerConfetti;
  }, [mapDbToPost, triggerConfetti]);

  useEffect(() => {
    // ✅ [OPTIMIZATION] authUser 외의 의존성을 제거하여 불필요한 구독 재시작 방지
    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'posts' 
        },
        async (payload) => {
          console.log('[Index] Realtime INSERT:', payload);
          // ref를 통해 최신 함수 참조
          const newPost = await mapDbToPostRef.current(payload.new);
          if (newPost) {
            setAllPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              const updated = [newPost, ...prev];
              mapCache.posts = updated;
              return updated;
            });
            
            setDisplayedMarkers(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });

            if (newPost.user_id === authUser?.id) {
              triggerConfettiRef.current();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'posts' 
        },
        (payload) => {
          console.log('[Index] Realtime DELETE:', payload);
          const deletedId = payload.old.id;
          
          window.dispatchEvent(new CustomEvent('animate-marker-delete', { 
            detail: { id: deletedId } 
          }));

          setTimeout(() => {
            setAllPosts(prev => {
              const filtered = prev.filter(p => p.id !== deletedId);
              mapCache.posts = filtered;
              return filtered;
            });
            setDisplayedMarkers(prev => prev.filter(p => p.id !== deletedId));
          }, 450);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]); // ✅ authUser.id만 의존성으로 유지 (불필요한 재구독 방지)

  useEffect(() => {
    const handleFocusPost = (e: any) => {
      const { post, lat, lng } = e.detail;
      setIsPostListOpen(false); 
      
      // ✅ [FIX] '여기보기'를 통해 위치 정보를 불러올 때도 상세 데이터를 동기화하기 위해 handleMarkerClick 활용
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
    
    // ✅ [FIX] 포스팅 후 설정: 전체보기 모드 유지 + 줌 레벨 5로 고정
    if (routeState.filterUserId === 'me') {
      // 내 포스팅 필터를 적용하지 않고 'all'로 설정하여 전체보기 모드 유지
      setSelectedCategories(['all']); 
      // 지도의 줌 레벨을 디폴트인 5로 설정
      setTimeout(() => setCurrentZoom(5), 500);
      
      if (routeState.post) {
        // 등록된 포스트의 좌표로 이동
        focusPostOnMap(routeState.post, { lat: routeState.post.lat, lng: routeState.post.lng });
      } else {
        handleCurrentLocation();
      }
    } 
    // 그 외 일반적인 포스트 포커스 처리
    else if (routeState.post) {
      focusPostOnMap(routeState.post, routeState.center);
    }
    else if (routeState.center) { 
      setSelectedPostId(null); 
      setMapCenter(routeState.center); 
    }
    
    if (routeState.startSelection) { 
      setIsPostListOpen(false); 
      setTimeout(() => { 
        setIsSelectingLocation(true); 
        setTempSelectedLocation(mapData?.center || mapCache.lastCenter); 
      }, 500); 
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [focusPostOnMap, location, navigate, triggerConfetti, mapData]);

  // ✅ [FIX] 리스트에서 포스팅 클릭 시 즉시 하이라이트 트리거 (지도 이동 중이라도 마커가 이미 있다면 표시)
  const handleTrendingPostClick = useCallback((post: Post) => {
    setIsTrendingExpanded(false);
    focusPostOnMap(post);
    
    // 마커가 이미 맵에 존재할 가능성이 높으므로 즉시 한 번 더 트리거 (보조용)
    window.dispatchEvent(new CustomEvent('highlight-marker', { 
      detail: { id: post.id, duration: 2500 } 
    }));
  }, [focusPostOnMap]);

  const handlePostDeleted = useCallback((id: string) => {
    setSelectedPostId(null);
    window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id } }));
    setTimeout(() => {
      setAllPosts(prev => { const f = prev.filter(p => p.id !== id); mapCache.posts = f; return f; });
      setDisplayedMarkers(prev => prev.filter(p => p.id !== id));
    }, 400);
  }, []);

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
          {/* Map is background */}
          <div className="absolute inset-0 z-0">
            <MapContainer
              posts={displayedMarkers}
              viewedPostIds={viewedIds}
              highlightedPostId={highlightedPostId}
              onMarkerClick={handleMarkerClick}
              onMapChange={handleMapChange}
              center={mapCenter}
              level={currentZoom}
              searchResultLocation={searchResultLocation}
              onMapClick={(location) => {
                setSearchResultLocation(null);
              }}
            />
          </div>

          <AnimatePresence>
            {isSelectingLocation && (
              <div className="fixed inset-0 z-[120] pointer-events-none">
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    className="relative mb-12"
                  >
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
                      <Button 
                        onClick={() => { setIsSelectingLocation(false); setTempSelectedLocation(null); setTimeout(() => navigate('/write', { state: { fromLocationSelection: true } }), 100); }} 
                        variant="secondary" 
                        className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"
                      >
                        <X className="w-4 h-4 mr-2" /> 취소
                      </Button>
                      <Button 
                        onClick={() => { if (tempSelectedLocation) { setIsSelectingLocation(false); setTimeout(() => navigate('/write', { state: { location: tempSelectedLocation, fromLocationSelection: true } }), 100); } }} 
                        className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                      >
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
              {/* 하단 버튼들: z-index를 상대적으로 낮게 유지하여 리스트에 가려지도록 함 */}
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
                  {displayedMarkers.length > 0 && currentZoom < 9 && <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />}
                  <button onClick={() => { if (displayedMarkers.length > 0 && currentZoom < 9) setIsPostListOpen(true); }} disabled={displayedMarkers.length === 0 || currentZoom >= 9} className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 overflow-hidden relative", (displayedMarkers.length === 0 || currentZoom >= 9) && "opacity-50 grayscale bg-slate-800/40 shadow-none")}>
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" /><span className="text-[10px] font-black mt-1 relative z-10">여기 보기</span>
                  </button>
                  {displayedMarkers.length > 0 && currentZoom < 9 && <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">{displayedMarkers.length}</div>}
                </div>
              </div>
              
              {/* 타임슬라이더: 하단바에 거의 붙도록 bottom 조정 (기존 4 -> 0) */}
              <div className={cn("absolute bottom-0 left-0 right-0 z-10 flex justify-center transition-all duration-500 ease-out pb-[env(safe-area-inset-bottom)]", (isTrendingExpanded || isPostListOpen) ? "opacity-0 translate-y-8 pointer-events-none" : "opacity-100 translate-y-0 pointer-events-auto")}>
                <div className="mb-2">
                  <TimeSlider value={timeValue} onChange={setTimeValue} />
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} />
      
      {/* 실시간 인기 포스팅 리스트 - 상단 헤더 바로 밑으로 이동 (여백 추가) */}
      <AnimatePresence>
        {!isPostListOpen && !isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-[calc(env(safe-area-inset-top,0px)+74px)] left-4 right-4 z-[50] pointer-events-none transition-all duration-300",
              isCategoryOpen && "opacity-50 blur-[1px]"
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPostListOpen && (
          <PostListOverlay 
            key="post-list-overlay" 
            isOpen={isPostListOpen} 
            onClose={() => setIsPostListOpen(false)} 
            initialPosts={displayedMarkers.map(m => allPosts.find(p => p.id === m.id) || m)} 
            mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }} 
            currentBounds={mapData?.bounds || { 
              sw: { lat: 33, lng: 124 }, 
              ne: { lat: 39, lng: 132 } 
            }}
            selectedCategories={selectedCategories} 
            timeValueHours={timeValue} 
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
              const post = allPosts.find(p => p.lat === lat && p.lng === lng);
              if (post) {
                focusPostOnMap(post, { lat, lng });
              } else {
                setMapCenter({ lat, lng }); 
              }
              setSelectedPostId(null); 
            }} 
          />
        )}
      </AnimatePresence>
      <PlaceSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={p => { setMapCenter({ lat: p.lat, lng: p.lng }); setSearchResultLocation({ lat: p.lat, lng: p.lng }); }} />
    </>
  );
};

export default Index;