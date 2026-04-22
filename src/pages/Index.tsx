"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TimeSlider from '@/components/TimeSlider';
import PlaceSearch from '@/components/PlaceSearch';
import CategoryMenu from '@/components/CategoryMenu';
import PostListOverlay from '@/components/PostListOverlay';
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Check, X, Loader2 } from 'lucide-react';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';
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
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop&w=800&q=80';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  const [allPosts, setAllPosts] = useState<Post[]>(mapCache.posts);
  const [globalTrendingPosts, setGlobalTrendingPosts] = useState<Post[]>([]);
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 6);
  
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
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [finalSelectedLocation, setFinalSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResultLocation, setSearchResultLocation] = useState<{ lat: number; lng: number } | null>(null);

  const throttleTimer = useRef<any>(null);
  const isSyncing = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);

  // [수정] PostListOverlay 상태를 App.tsx에 전달 (navigate 대신 직접 state 수정 시도)
  // navigate replace를 사용하면 스크린 깜빡임(Re-mount)이 발생하므로
  // transition 효과를 위해 state 관리를 최적화합니다.
  useEffect(() => {
    // navigate replace는 페이지 전체를 리렌더링하게 하여 깜빡임을 유발할 수 있음
    // history.replaceState를 사용하여 URL이나 히스토리 구조는 유지하면서 데이터만 조용히 업데이트
    const currentState = window.history.state || {};
    if (currentState.isPostListOpen !== isPostListOpen) {
      window.history.replaceState({ 
        ...currentState, 
        isPostListOpen,
        usr: { ...currentState.usr, isPostListOpen } // React Router v6 내부 구조 대응
      }, '');
    }
  }, [isPostListOpen]);

  // ✅ [FIX] isPostListOpen 변경 시 window 플래그에 즉시 동기적으로 반영
  // navigate()를 통한 location.state 업데이트는 비동기라 App.tsx backButton 리스너에서
  // 타이밍 이슈가 발생하므로, window 플래그로 교체하여 즉시 반영 보장
  useEffect(() => {
    (window as any).__isPostListOpen = isPostListOpen;
    console.log('[Index] window.__isPostListOpen set to:', isPostListOpen);
  }, [isPostListOpen]);

  // [수정] 네이티브 뒤로가기 버튼 이벤트 리스너 (App.tsx와 연동)
  useEffect(() => {
    const handleCloseOverlay = () => {
      console.log('[Index] Received close signal from native back button');
      // window.history.state를 직접 참조하여 더 정확하게 판단
      if (isPostListOpen || window.history.state?.isPostListOpen) {
        setIsPostListOpen(false);
      }
    };
    window.addEventListener('close-post-list-overlay', handleCloseOverlay);
    return () => window.removeEventListener('close-post-list-overlay', handleCloseOverlay);
  }, [isPostListOpen]);

  // ✅ [REMOVED] location.state를 통한 isPostListOpen 동기화 useEffect 제거
  // 이 방식은 navigate()의 비동기 특성으로 인해 App.tsx backButton 리스너에서
  // 항상 이전 값을 읽는 타이밍 레이스 컨디션을 유발했음
  //
  // useEffect(() => {
  //   if ((location.state as any)?.isPostListOpen !== isPostListOpen) {
  //     navigate(location.pathname, { 
  //       replace: true, 
  //       state: { ...location.state, isPostListOpen } 
  //     });
  //   }
  // }, [isPostListOpen, location.pathname, navigate]);

  // ✅ [ADD] 컴포넌트 언마운트 시 플래그 초기화
  useEffect(() => {
    return () => {
      (window as any).__isPostListOpen = false;
    };
  }, []);

  const getTierFromId = (id: string) => {
    let h = 0;
    for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
    const val = Math.abs(h % 1000) / 1000;
    if (val < 0.01) return 'diamond';
    if (val < 0.03) return 'gold';
    if (val < 0.07) return 'silver';
    if (val < 0.15) return 'popular';
    return 'none';
  };

  const mapDbToPost = async (rawPost: any): Promise<Post> => {
    if (!rawPost || !rawPost.id) {
      console.warn('⚠️ [mapDbToPost] Invalid raw post data:', rawPost);
      return null as any;
    }

    try {
      const p = await sanitizeYoutubeMedia(rawPost);
      const isAd = p.content?.trim().startsWith('[AD]');
      const borderType = isAd ? 'none' : getTierFromId(p.id);

      // 이미지 URL 최적화 로직
      let finalImage = null;
      
      if (p.youtube_url) {
        finalImage = getYoutubeThumbnail(p.youtube_url);
      } else if (p.image_url && (p.image_url.startsWith('http') || p.image_url.startsWith('data:'))) {
        // 이미 유효한 URL(Unsplash 등)이 있는 경우 그대로 사용
        finalImage = p.image_url;
      }

      return {
        id: p.id,
        isAd,
        isGif: false,
        isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
        user: { id: p.user_id, name: p.user_name, avatar: p.user_avatar },
        content: p.content?.replace(/^\[AD\]\s*/, '') || '',
        location: p.location_name,
        lat: p.latitude,
        lng: p.longitude,
        likes: Number(p.likes || 0),
        commentsCount: 0,
        comments: [],
        image: finalImage,
        youtubeUrl: p.youtube_url,
        videoUrl: p.video_url,
        category: p.category || 'none',
        isLiked: false,
        createdAt: new Date(p.created_at),
        borderType
      };
    } catch (err) {
      console.error('❌ [mapDbToPost] Error processing post:', err);
      return null as any;
    }
  };

  const fetchGlobalTrending = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('likes', { ascending: false })
        .limit(50);
      
      if (!error && data) {
        const mapped = await Promise.all(data.map(mapDbToPost));
        const filtered = mapped.filter(p => p && !p.isAd).slice(0, 20);
        const ranked = filtered.map((p, idx) => ({
          ...p,
          rank: idx + 1
        }));
        setGlobalTrendingPosts(ranked);
      }

    } catch (err) {
      console.error('[Trending] Fetch Error:', err);
    }
  }, []);

  useEffect(() => {
    fetchGlobalTrending();
  }, [fetchGlobalTrending]);

  const handleMapChange = useCallback((data: any) => {
    // 지도를 직접 조작해서 움직인 경우(isSelectingLocation이 아닐 때) 위치 선택 정보 초기화
    if (!isSelectingLocation) {
      setFinalSelectedLocation(null);
      postDraftStore.clear();
    }

    const zoomChanged = data.level !== undefined && data.level !== currentZoom;

    if (zoomChanged) {
      // 줌이 바뀌면 즉시 업데이트 (사용자 체감 중요)
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
        throttleTimer.current = null;
      }
      
      setMapData(data);
      setCurrentZoom(data.level);
      
      mapCache.lastCenter = data.center;
      mapCache.lastZoom = data.level;
      
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      setFinalSelectedLocation(null);
      
      setTimeout(() => {
        syncPostsWithSupabase(data.bounds, data.level);
      }, 100);
      return;
    }
    
    // [데이터 다이어트] 단순 이동 시 쓰로틀링 강화 (100ms -> 600ms)
    // 지도를 슥 움직이는 동안 불필요한 연속 호출 방지
    if (throttleTimer.current) return;
    throttleTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
      if (data.level !== undefined) {
        setCurrentZoom(data.level);
        mapCache.lastZoom = data.level;
      }
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      throttleTimer.current = null;
    }, 300); // 0.3초 대기 후 동기화
  }, [isSelectingLocation, currentZoom]);

  // ✅ [데이터 다이어트] 이미 불러온 마커는 다시 그리지 않도록 로직 최적화
  const syncPostsWithSupabase = useCallback(async (forceBounds?: any, forceZoom?: number) => {
    const targetBounds = forceBounds || mapData?.bounds;
    if (!targetBounds) return;
    
    if (isSyncing.current && !forceBounds) return;
    
    isSyncing.current = true;
    const { sw, ne } = targetBounds;
    const center = mapData?.center;
    const zoomToUse = forceZoom ?? currentZoom;

    try {
      // 가벼운 마커 전용 데이터를 가져옴
      const dbPosts = await fetchPostsInBounds(sw, ne, zoomToUse, center);
      
      const mappedPosts = await Promise.all(dbPosts.map(p => mapDbToPost(p)));
      const validMappedPosts = mappedPosts.filter(p => p !== null);

      setAllPosts(prev => {
        // 기존에 이미 메모리에 있는 포스트 ID들
        const existingIds = new Set(prev.map(p => p.id));
        // 정말로 새로 가져온 포스트만 선별
        const newUnique = validMappedPosts.filter(p => !existingIds.has(p.id));
        
        if (newUnique.length === 0) return prev; // 새로운 게 없으면 상태 업데이트 안 함

        if (center) {
          newUnique.sort((a, b) => {
            const distA = Math.hypot(a.lat - center.lat, a.lng - center.lng);
            const distB = Math.hypot(b.lat - center.lat, b.lng - center.lng);
            return distA - distB;
          });
        }

        // 최대 보유 마커 수를 줄여 메모리 관리
        const combined = [...newUnique, ...prev].slice(0, 2000);
        mapCache.posts = combined;
        return combined;
      });
    } catch (err) { 
      console.error('❌ [Sync] Critical Error during sync:', err); 
    } finally { 
      isSyncing.current = false; 
    }
  }, [mapData, currentZoom, mapDbToPost]);

  useEffect(() => { if (mapData) syncPostsWithSupabase(); }, [mapData, syncPostsWithSupabase]);

  useEffect(() => {
    if (!mapData?.bounds) {
      return;
    }
    
    if (currentZoom >= 9) { 
      if (displayedMarkers.length > 0) setDisplayedMarkers([]); 
      return; 
    }

    const { sw, ne } = mapData.bounds;
    
    const latPadding = Math.abs(ne.lat - sw.lat) * 0.2;
    const lngPadding = Math.abs(ne.lng - sw.lng) * 0.2;
    
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    
    const inBoundsCandidates = allPosts.filter(post => {
      if (!post) return false;
      if (post.lat === null || post.lng === null || post.lat === undefined || post.lng === undefined) return false;
      if (blockedIds.has(post.user.id)) return false;

      const isInExtendedBounds = 
        post.lat >= (Math.min(sw.lat, ne.lat) - latPadding) && 
        post.lat <= (Math.max(sw.lat, ne.lat) + latPadding) && 
        post.lng >= (Math.min(sw.lng, ne.lng) - lngPadding) && 
        post.lng <= (Math.max(sw.lng, ne.lng) + lngPadding);

      if (!isInExtendedBounds) return false;
      if (post.isAd) return true;
      
      if (timeValue < 100) {
        if ((now - post.createdAt.getTime()) > timeLimitMs) return false;
      }
      
      let matchesCategory = false;
      if (selectedCategories.includes('mine')) matchesCategory = authUser && post.user.id === authUser.id;
      else if (selectedCategories.includes('all')) matchesCategory = true;
      else matchesCategory = selectedCategories.includes(post.category || 'none') || (selectedCategories.includes('hot') && post.borderType === 'popular') || (selectedCategories.includes('influencer') && post.isInfluencer);
      
      return matchesCategory;
    });
    
    const uniquePosts = Array.from(new Map(inBoundsCandidates.map(p => [p.id, p])).values());
    
    setDisplayedMarkers(prev => {
      const prevIds = prev.map(p => p.id).sort().join(',');
      const nextIds = uniquePosts.map(p => p.id).sort().join(',');
      
      if (prevIds === nextIds) {
        return prev;
      }
      
      return uniquePosts;
    });
  }, [mapData?.bounds, timeValue, selectedCategories, allPosts, blockedIds, authUser, currentZoom]);

  const handleLikeToggle = useCallback((postId: string) => {
    setAllPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
    setGlobalTrendingPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchGlobalTrending(); 
    
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      try {
        const dbPosts = await fetchPostsInBounds(sw, ne);
        setAllPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = dbPosts.filter(p => !existingIds.has(p.id));
          const combined = [...prev, ...newUnique];
          mapCache.posts = combined;
          return combined;
        });
      } catch (err) {
        console.error('[Refresh] Sync Error:', err);
      }
    } else {
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(1000);
      if (data) {
        const mapped = await Promise.all(data.map(mapDbToPost));
        setAllPosts(mapped);
        mapCache.posts = mapped;
      }
    }

    setIsRefreshing(false);
    showSuccess('데이터를 새로고침했습니다.');
  }, [fetchGlobalTrending, mapData]);

  const focusPostOnMap = useCallback((post: Post, center?: { lat: number; lng: number }) => {
    if (post.lat === null || post.lng === null || post.lat === undefined || post.lng === undefined) return;

    setAllPosts((prev) => {
      if (prev.some((item) => item.id === post.id)) return prev;
      const combined = [post, ...prev];
      mapCache.posts = combined;
      return combined;
    });

    setSelectedPostId(null);
    setSearchResultLocation(null);
    setMapCenter(center || { lat: post.lat, lng: post.lng });

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    setHighlightedPostId(post.id);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedPostId(null);
      highlightTimeoutRef.current = null;
    }, 4000);
  }, []);

  const handleCurrentLocation = async () => {
    const toastId = showLoading('현재 위치를 찾는 중...');
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      setMapCenter({ lat: latitude, lng: longitude });
      dismissToast(toastId);
      showSuccess('현재 위치로 이동했습니다.');
    } catch (err: any) { 
      dismissToast(toastId); 
      showError('위치 정보를 가져올 수 없습니다.'); 
    }
  };

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const routeState = location.state as { 
      center?: { lat: number; lng: number }; 
      post?: Post;
      filterUserId?: string;
    } | null;
    
    if (!routeState) return;

    if (routeState.filterUserId === 'me') {
      setSelectedCategories(['mine']);
      
      setTimeout(() => {
        setCurrentZoom(10);
      }, 500);

      if (routeState.post) {
        focusPostOnMap(routeState.post, routeState.center);
      } else if (routeState.center) {
        setMapCenter(routeState.center);
      } else {
        handleCurrentLocation();
      }
    }
    else if (routeState.post) {
      focusPostOnMap(routeState.post, routeState.center);
    } 
    else if (routeState.center) {
      setSelectedPostId(null);
      setSearchResultLocation(null);
      setMapCenter(routeState.center);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [focusPostOnMap, location.pathname, location.state, navigate]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setIsTrendingExpanded(false);
    focusPostOnMap(post);
  }, [focusPostOnMap]);

  const handlePlaceSelect = (place: any) => { setMapCenter({ lat: place.lat, lng: place.lng }); setSearchResultLocation({ lat: place.lat, lng: place.lng }); };
  const handleMapClick = () => { if (searchResultLocation) setSearchResultLocation(null); };
  
  const handleViewAllClick = () => { 
    if (displayedMarkers.length > 0 && currentZoom < 9) {
      console.log('[Index] Opening PostListOverlay');
      setIsPostListOpen(true);
    } 
  };

  const handlePostCreated = (newPost: any) => {
    console.log('[Index] New post created, adding to state:', newPost);
    
    setAllPosts(prev => [newPost, ...prev]);
    setDisplayedMarkers(prev => [newPost, ...prev]);
    
    if (newPost.lat && newPost.lng) {
      setMapCenter({ lat: newPost.lat, lng: newPost.lng });
      setCurrentZoom(6);
    }

    setIsWriteOpen(false);
  };

  const handlePostDeleted = useCallback((id: string) => {
    console.log('[Index] Handling post deletion for id:', id);
    
    setAllPosts(prev => {
      const filtered = prev.filter(p => p.id !== id);
      console.log('[Index] allPosts updated, new count:', filtered.length);
      return filtered;
    });
    
    setDisplayedMarkers(prev => {
      const filtered = prev.filter(p => p.id !== id);
      console.log('[Index] displayedMarkers updated, new count:', filtered.length);
      return filtered;
    });
    
    mapCache.posts = mapCache.posts.filter(p => p.id !== id);
    
    setSelectedPostId(null);
  }, []);

  const confirmLocationSelection = () => { if (tempSelectedLocation) { setFinalSelectedLocation(tempSelectedLocation); setIsSelectingLocation(false); setTimeout(() => setIsWriteOpen(true), 100); } };
  const cancelLocationSelection = () => { setIsSelectingLocation(false); setTempSelectedLocation(null); setTimeout(() => setIsWriteOpen(true), 100); };
  const startLocationSelection = () => { setIsWriteOpen(false); setIsPostListOpen(false); setTimeout(() => { setIsSelectingLocation(true); setTempSelectedLocation(mapData?.center || mapCache.lastCenter); }, 500); };

  return (
    <>
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="relative w-full h-screen overflow-hidden bg-gray-50">
        <div className="absolute inset-0 z-0">
          <MapContainer 
            posts={displayedMarkers} 
            viewedPostIds={viewedIds} 
            highlightedPostId={highlightedPostId} 
            onMarkerClick={(p) => setSelectedPostId(p.id)} 
            onMapChange={handleMapChange} 
            onMapClick={handleMapClick} 
            center={mapCenter} 
            level={currentZoom}
            searchResultLocation={searchResultLocation} 
          />
          <AnimatePresence>
            {isSelectingLocation && (
              <>
                <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[50]"><motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative mb-12"><div className="relative w-12 h-12"><div className="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl" /><div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10" /></div><div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full" /></motion.div></div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-32 left-0 right-0 px-6 z-[100] flex flex-col gap-4"><div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-indigo-100 flex flex-col items-center gap-3"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" /><p className="text-sm font-black text-gray-900">지도를 움직여 위치를 맞추세요</p></div><div className="flex w-full gap-3"><Button onClick={cancelLocationSelection} variant="secondary" className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"><X className="w-4 h-4 mr-2" /> 취소</Button><Button onClick={confirmLocationSelection} className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100"><Check className="w-4 h-4 mr-2" /> 이 위치로 선택</Button></div></div></motion.div>
              </>
            )}
          </AnimatePresence>
          {!isSelectingLocation && (
            <>
              <AnimatePresence>{isTrendingExpanded && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTrendingExpanded(false)} className="fixed inset-0 bg-transparent z-[35]" />}</AnimatePresence>
              <div className={cn("absolute top-24 left-0 right-0 px-4 flex items-start justify-between pointer-events-none transition-all duration-300", isTrendingExpanded ? "z-40" : "z-10")}><div className="w-full shrink-0 pointer-events-auto"><TrendingPosts posts={globalTrendingPosts} isExpanded={isTrendingExpanded} onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)} onPostClick={handleTrendingPostClick} /></div></div>
              <div className="absolute bottom-32 left-4 z-20 flex flex-col gap-2"><button onClick={() => setIsCategoryOpen(true)} className={cn("w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500", !selectedCategories.includes('all') && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600")}><Layers className="w-6 h-6" /></button><button onClick={() => setIsSearchOpen(true)} className={cn("w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500", isSearchOpen && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600")}><Search className="w-6 h-6" /></button><button onClick={handleCurrentLocation} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Navigation className="w-6 h-6 fill-white" /></button></div>
              <div className="absolute bottom-32 right-4 z-20 flex flex-col items-center gap-4">
                <button onClick={handleRefresh} disabled={isRefreshing} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100">
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} />
                  <span className="text-[9px] font-black mt-1">재검색</span>
                </button>
                <div className="relative">
                  {displayedMarkers.length > 0 && currentZoom < 9 && (
                    <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />
                  )}
                  <button
                    onClick={handleViewAllClick}
                    disabled={displayedMarkers.length === 0 || currentZoom >= 9}
                    className={cn(
                      "w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 group overflow-hidden relative",
                      (displayedMarkers.length === 0 || currentZoom >= 9) && "opacity-50 grayscale cursor-not-allowed bg-slate-800/40 border-white/10 shadow-none"
                    )}
                  >
                    <LayoutGrid className={cn("w-7 h-7 stroke-[3px] relative z-10", (displayedMarkers.length === 0 || currentZoom >= 9) && "text-white/40")} />
                    <span className={cn("text-[10px] font-black mt-1 relative z-10", (displayedMarkers.length === 0 || currentZoom >= 9) && "text-white/40")}>여기 보기</span>
                  </button>

                  {displayedMarkers.length > 0 && currentZoom < 9 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">
                      {displayedMarkers.length}
                    </div>
                  )}
                </div>
              </div>
              
              <div 
                className={cn(
                  "absolute bottom-6 left-0 right-0 z-10 flex justify-center transition-all duration-500 ease-out",
                  (isTrendingExpanded || isPostListOpen) ? "opacity-0 translate-y-8 pointer-events-none" : "opacity-100 translate-y-0 pointer-events-auto"
                )}
              >
                <TimeSlider value={timeValue} onChange={setTimeValue} />
              </div>
            </>
          )}
        </div>
      </motion.div>
      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} />
      <AnimatePresence>
        {selectedPostId && (
          <PostDetail
            key="post-detail-modal"
            posts={displayedMarkers}
            initialIndex={displayedMarkers.findIndex(p => p.id === selectedPostId)}
            isOpen={true}
            onClose={() => setSelectedPostId(null)}
            onDelete={handlePostDeleted}
            onViewPost={markAsViewed}
            onLikeToggle={handleLikeToggle}
            onLocationClick={(lat, lng) => { setMapCenter({ lat, lng }); setSelectedPostId(null); }}
          />
        )}
      </AnimatePresence>

      <PlaceSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handlePlaceSelect} />
      <WritePost
        isOpen={isWriteOpen}
        onClose={() => setIsWriteOpen(false)}
        initialLocation={finalSelectedLocation}
        onPostCreated={handlePostCreated}
        onStartLocationSelection={startLocationSelection}
        onLocationReset={() => setFinalSelectedLocation(null)}
      />

      <PostListOverlay
        isOpen={isPostListOpen}
        onClose={() => setIsPostListOpen(false)}
        initialPosts={displayedMarkers}
        mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
        currentBounds={mapData?.bounds}
        selectedCategories={selectedCategories}
        timeValueHours={timeValue}
        authUserId={authUser?.id}
        onDeletePost={handlePostDeleted}
      />
    </>
  );
};

export default Index;