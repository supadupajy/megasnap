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
  const location = useLocation();
  const navigate = useNavigate();
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

  const [allPosts, setAllPosts] = useState<Post[]>(mapCache.posts);
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
  setAllPosts((prev) => {
    if (prev.some((item) => item.id === post.id)) return prev;
    const combined = [post, ...prev];
    mapCache.posts = combined;
    return combined;
  });
  setSelectedPostId(null);
  setSearchResultLocation(null);
  if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);

  // ✅ 하이라이트 초기화 및 지도 이동 시작
  setHighlightedPostId(null);
  setMapCenter(center || { lat: post.lat, lng: post.lng });

  // ✅ 하이라이트 이벤트 발송 시간 조정
  highlightTimeoutRef.current = window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('highlight-marker', { 
      detail: { id: post.id, duration: 2500 } 
    }));
    highlightTimeoutRef.current = null;
  }, 1100);
}, []);

  const mapDbToPost = useCallback(async (rawPost: any): Promise<Post> => {
    if (!rawPost || !rawPost.id) return null as any;
    try {
      const { data: p, error: postError } = await supabase.from('posts').select('*').eq('id', rawPost.id).single();
      if (postError || !p) throw postError || new Error('Post not found');

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
      
      let userName = p.user_name || '탐험가';
      let userAvatar = p.user_avatar || '';
      if (p.user_id) {
        const { data: profileData } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', p.user_id).maybeSingle();
        if (profileData) { userName = profileData.nickname || userName; userAvatar = profileData.avatar_url || userAvatar; }
      }

      return {
        id: p.id, isAd, isGif: false, isInfluencer: ['gold', 'diamond'].includes(borderType),
        user: { id: p.user_id || '', name: userName, avatar: userAvatar },
        content: contentText.replace(/^\[AD\]\s*/, '') || '',
        location: p.location_name || '알 수 없는 장소',
        lat: p.latitude, lng: p.longitude, likes: likesCount, commentsCount: 0, comments: [],
        image: finalImage, images: validImages, youtubeUrl: p.youtube_url, videoUrl: p.video_url,
        category: p.category || 'none', isLiked: false, createdAt: new Date(p.created_at), borderType
      };
    } catch (err) { return null as any; }
  }, []);

  const fetchGlobalTrending = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*').limit(100);
      if (!error && data) {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        const mapped = await Promise.all(shuffled.map(mapDbToPost));
        setGlobalTrendingPosts(mapped.filter(p => p !== null).slice(0, 20).map((p, idx) => ({ ...p, rank: idx + 1 })));
      }
    } catch (err) { console.error(err); }
  }, [mapDbToPost]);

  useEffect(() => { if (authUser) fetchGlobalTrending(); }, [authUser, fetchGlobalTrending]);

  const syncPostsWithSupabase = useCallback(async (forceBounds?: any, forceZoom?: number) => {
    const targetBounds = forceBounds || mapData?.bounds;
    if (!targetBounds || isSyncing.current) return;
    isSyncing.current = true;
    const { sw, ne } = targetBounds;
    const center = mapData?.center;
    const zoomToUse = forceZoom ?? currentZoom;
    try {
      const dbPosts = await fetchPostsInBounds(sw, ne, zoomToUse, center);
      const validDbIds = new Set(dbPosts.map(p => p.id));
      const mappedPosts: Post[] = await Promise.all(dbPosts.map(p => mapDbToPost(p)));
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
        const existingIds = new Set(prev.map(p => p.id));
        const combined = [...mappedPosts.filter(p => !existingIds.has(p.id)), ...prev].slice(0, 3000);
        mapCache.posts = combined;
        return combined;
      });
    } catch (err) { console.error(err); } finally { isSyncing.current = false; }
  }, [mapData, currentZoom, mapDbToPost]);

  useEffect(() => { if (mapData) syncPostsWithSupabase(); }, [mapData, syncPostsWithSupabase]);

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
    if (currentZoom >= 9) { if (displayedMarkers.length > 0) setDisplayedMarkers([]); return; }
    
    const { sw, ne } = mapData.bounds;
    const center = mapData.center; // ✅ 지도의 중심점
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;

    // ✅ [거리 기반 가중치 정렬] 현재 지도의 중심과 각 포스트의 거리를 계산하여 가까운 순으로 표시
    const uniquePosts = Array.from(new Map(allPosts.filter(post => {
      if (!post || post.lat === null || post.lng === null || blockedIds.has(post.user.id)) return false;
      const inBounds = post.lat >= Math.min(sw.lat, ne.lat) && post.lat <= Math.max(sw.lat, ne.lat) && post.lng >= Math.min(sw.lng, ne.lng) && post.lng <= Math.max(sw.lng, ne.lng);
      if (!inBounds) return false;
      if (post.isAd) return true;
      if (timeValue < 100 && (now - post.createdAt.getTime()) > timeLimitMs) return false;
      if (selectedCategories.includes('mine')) return authUser && post.user.id === authUser.id;
      if (selectedCategories.includes('all')) return true;
      return selectedCategories.includes(post.category || 'none') || (selectedCategories.includes('hot') && post.borderType === 'popular') || (selectedCategories.includes('influencer') && ['gold', 'diamond'].includes(post.borderType || 'none'));
    }).map(p => {
      // ✅ 거리 계산 (간이 유클리드 거리)
      const dist = Math.sqrt(Math.pow(p.lat - center.lat, 2) + Math.pow(p.lng - center.lng, 2));
      return [p.id, { ...p, _dist: dist }];
    })).values());

    // ✅ 가까운 거리 순으로 정렬하여 displayedMarkers 업데이트
    // 이렇게 하면 '여기 보기' 클릭 시 중심점 기준 가까운 포스팅이 먼저 나타납니다.
    const sortedPosts = (uniquePosts as any[]).sort((a, b) => a._dist - b._dist);
    
    setDisplayedMarkers(prev => {
      if (prev.length === sortedPosts.length && prev.every((p, i) => p.id === sortedPosts[i].id)) return prev;
      return sortedPosts;
    });
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
    setSelectedPostId(lightPost.id);
    if (lightPost.user.name !== '...') return;
    try {
      const { data, error } = await supabase.from('posts').select('*').eq('id', lightPost.id).single();
      if (!error && data) {
        const full = await mapDbToPost(data);
        if (full) {
          setAllPosts(prev => prev.map(p => p.id === full.id ? full : p));
          setDisplayedMarkers(prev => prev.map(p => p.id === full.id ? full : p));
        }
      }
    } catch (err) { console.error(err); }
  }, [mapDbToPost]);

  const handleCurrentLocation = async () => {
    const toastId = showLoading('현재 위치를 찾는 중...');
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      dismissToast(toastId); showSuccess('현재 위치로 이동했습니다.');
    } catch (err) { dismissToast(toastId); showError('위치 정보를 가져올 수 없습니다.'); }
  };

  useEffect(() => {
    if (!authUser) return;

    // ✅ [REALTIME] 포스트 테이블 실시간 구독 설정 (INSERT & DELETE)
    const channel = supabase
      .channel('public:posts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          console.log('[Realtime] New post detected:', payload.new);
          const newRawPost = payload.new;
          
          const mappedPost = await mapDbToPost(newRawPost);
          if (!mappedPost) return;

          if (mappedPost.user.id !== authUser.id) {
            triggerConfetti();
          }

          setAllPosts(prev => {
            if (prev.some(p => p.id === mappedPost.id)) return prev;
            const combined = [{ ...mappedPost, isNewRealtime: true }, ...prev];
            mapCache.posts = combined;
            return combined;
          });
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
          const deletedId = payload.old.id;
          console.log('[Realtime] Post deleted:', deletedId);

          // ✅ [FADE OUT] 마커 삭제 애니메이션 트리거 (MapContainer에서 처리)
          window.dispatchEvent(new CustomEvent('animate-marker-delete', { 
            detail: { id: deletedId } 
          }));

          // 애니메이션 시간(약 400~500ms) 후 상태에서 실제 제거
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
      supabase.removeChannel(channel);
    };
  }, [authUser, mapData, mapDbToPost, triggerConfetti]);

  useEffect(() => {
    const handleFocusPost = (e: any) => {
      const { post, lat, lng } = e.detail;
      setIsPostListOpen(false); focusPostOnMap(post, { lat, lng });
      setTimeout(() => setSelectedPostId(post.id), 300);
    };
    window.addEventListener('focus-post', handleFocusPost);
    return () => window.removeEventListener('focus-post', handleFocusPost);
  }, [focusPostOnMap]);

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
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="relative w-full h-screen overflow-hidden bg-gray-50">
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
  onMapClick={() => setSearchResultLocation(null)}
/>
          <AnimatePresence>
            {isSelectingLocation && (
              <>
                <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[50]"><motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative mb-12"><div className="relative w-12 h-12"><div className="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl" /><div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10" /></div><div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full" /></motion.div></div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-32 left-0 right-0 px-6 z-[100] flex flex-col gap-4"><div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-indigo-100 flex flex-col items-center gap-3"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" /><p className="text-sm font-black text-gray-900">지도를 움직여 위치를 맞추세요</p></div><div className="flex w-full gap-3"><Button onClick={() => { setIsSelectingLocation(false); setTempSelectedLocation(null); setTimeout(() => navigate('/write', { state: { fromLocationSelection: true } }), 100); }} variant="secondary" className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"><X className="w-4 h-4 mr-2" /> 취소</Button><Button onClick={() => { if (tempSelectedLocation) { setIsSelectingLocation(false); setTimeout(() => navigate('/write', { state: { location: tempSelectedLocation, fromLocationSelection: true } }), 100); } }} className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100"><Check className="w-4 h-4 mr-2" /> 이 위치로 선택</Button></div></div></motion.div>
              </>
            )}
          </AnimatePresence>
          {!isSelectingLocation && (
            <>
              <AnimatePresence>{isTrendingExpanded && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTrendingExpanded(false)} className="fixed inset-0 bg-transparent z-[35]" />}</AnimatePresence>
              <div className={cn("absolute top-24 left-0 right-0 px-4 flex items-start justify-between pointer-events-none transition-all duration-300", isTrendingExpanded ? "z-40" : "z-10")}><div className="w-full shrink-0 pointer-events-auto"><TrendingPosts posts={globalTrendingPosts} isExpanded={isTrendingExpanded} onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)} onPostClick={p => { setIsTrendingExpanded(false); focusPostOnMap(p); }} /></div></div>
              <div className="absolute bottom-32 left-4 z-20 flex flex-col gap-2"><button onClick={() => setIsCategoryOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Layers className="w-6 h-6" /></button><button onClick={() => setIsSearchOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Search className="w-6 h-6" /></button><button onClick={handleCurrentLocation} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Navigation className="w-6 h-6 fill-white" /></button></div>
              <div className="absolute bottom-32 right-4 z-20 flex flex-col items-center gap-4">
                <button onClick={handleRefresh} disabled={isRefreshing} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100"><RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} /><span className="text-[9px] font-black mt-1">재검색</span></button>
                <div className="relative">
                  {displayedMarkers.length > 0 && currentZoom < 9 && <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />}
                  <button onClick={() => { if (displayedMarkers.length > 0 && currentZoom < 9) setIsPostListOpen(true); }} disabled={displayedMarkers.length === 0 || currentZoom >= 9} className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 overflow-hidden relative", (displayedMarkers.length === 0 || currentZoom >= 9) && "opacity-50 grayscale bg-slate-800/40 shadow-none")}>
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" /><span className="text-[10px] font-black mt-1 relative z-10">여기 보기</span>
                  </button>
                  {displayedMarkers.length > 0 && currentZoom < 9 && <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">{displayedMarkers.length}</div>}
                </div>
              </div>
              <div className={cn("absolute bottom-6 left-0 right-0 z-10 flex justify-center transition-all duration-500 ease-out", (isTrendingExpanded || isPostListOpen) ? "opacity-0 translate-y-8 pointer-events-none" : "opacity-100 translate-y-0 pointer-events-auto")}><TimeSlider value={timeValue} onChange={setTimeValue} /></div>
            </>
          )}
        </div>
      </motion.div>
      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} />
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
      <AnimatePresence>{selectedPostId && <PostDetail key="post-detail-modal" posts={allPosts} initialIndex={allPosts.findIndex(p => p.id === selectedPostId)} isOpen={true} onClose={() => setSelectedPostId(null)} onDelete={handlePostDeleted} onViewPost={markAsViewed} onLikeToggle={handleLikeToggle} onLocationClick={(lat, lng) => { setMapCenter({ lat, lng }); setSelectedPostId(null); }} />}</AnimatePresence>
      <PlaceSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={p => { setMapCenter({ lat: p.lat, lng: p.lng }); setSearchResultLocation({ lat: p.lat, lng: p.lng }); }} />
    </>
  );
};

export default Index;