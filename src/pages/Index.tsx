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

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const handleCloseOverlay = () => {
      console.log('[Index] Received close signal from native back button');
      if (isPostListOpen) {
        setIsPostListOpen(false);
      }
    };
    window.addEventListener('close-post-list-overlay', handleCloseOverlay);
    return () => window.removeEventListener('close-post-list-overlay', handleCloseOverlay);
  }, [isPostListOpen]);

  useEffect(() => {
    const currentState = window.history.state || {};
    if (currentState.isPostListOpen !== isPostListOpen) {
      window.history.replaceState({ 
        ...currentState, 
        isPostListOpen,
        usr: { ...currentState.usr, isPostListOpen }
      }, '');
    }
  }, [isPostListOpen]);

  useEffect(() => {
    const handleOpenWrite = () => setIsWriteOpen((prev) => !prev);
    window.addEventListener('open-write-post', handleOpenWrite);
    return () => window.removeEventListener('open-write-post', handleOpenWrite);
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

  const mapDbToPost = useCallback(async (rawPost: any): Promise<Post> => {
    if (!rawPost || !rawPost.id) return null as any;
    try {
      const p = await sanitizeYoutubeMedia(rawPost);
      const isAd = p.content?.trim().startsWith('[AD]');
      const borderType = isAd ? 'none' : getTierFromId(p.id);
      let finalImage = null;
      if (p.youtube_url) finalImage = getYoutubeThumbnail(p.youtube_url);
      else if (p.image_url && (p.image_url.startsWith('http') || p.image_url.startsWith('data:'))) finalImage = p.image_url;
      return {
        id: p.id,
        isAd,
        isGif: false,
        isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
        user: { id: p.user_id || '', name: p.user_name || '탐험가', avatar: p.user_avatar || '' },
        content: p.content?.replace(/^\[AD\]\s*/, '') || '',
        location: p.location_name || '알 수 없는 장소',
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
    } catch (err) { return null as any; }
  }, []);

  const fetchGlobalTrending = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*').order('likes', { ascending: false }).limit(50);
      if (!error && data) {
        const mapped = await Promise.all(data.map(mapDbToPost));
        const filtered = mapped.filter(p => p && !p.isAd).slice(0, 20);
        const ranked = filtered.map((p, idx) => ({ ...p, rank: idx + 1 }));
        setGlobalTrendingPosts(ranked);
      }
    } catch (err) { console.error(err); }
  }, [mapDbToPost]);

  useEffect(() => { fetchGlobalTrending(); }, [fetchGlobalTrending]);

  const syncPostsWithSupabase = useCallback(async (forceBounds?: any, forceZoom?: number) => {
    const targetBounds = forceBounds || mapData?.bounds;
    if (!targetBounds) return;
    if (isSyncing.current && !forceBounds) return;
    isSyncing.current = true;
    const { sw, ne } = targetBounds;
    const center = mapData?.center;
    const zoomToUse = forceZoom ?? currentZoom;
    try {
      const dbPosts = await fetchPostsInBounds(sw, ne, zoomToUse, center);
      const mappedPosts: Post[] = dbPosts.map(p => ({
        id: p.id,
        isAd: false,
        isGif: false,
        isInfluencer: false,
        user: { id: '', name: '...', avatar: '' },
        content: '',
        location: '...',
        lat: p.latitude,
        lng: p.longitude,
        likes: Number(p.likes || 0),
        commentsCount: 0,
        comments: [],
        image: p.image_url,
        videoUrl: p.video_url,
        youtubeUrl: p.youtube_url,
        category: p.category || 'none',
        isLiked: false,
        createdAt: new Date(p.created_at),
        borderType: 'none',
      }));
      setAllPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newUnique = mappedPosts.filter(p => !existingIds.has(p.id));
        if (newUnique.length === 0 && !forceBounds) return prev;
        const combined = [...newUnique, ...prev].slice(0, 3000);
        mapCache.posts = combined;
        return combined;
      });
    } catch (err) { console.error(err); } finally { isSyncing.current = false; }
  }, [mapData, currentZoom]);

  const handleMapChange = useCallback((data: any) => {
    if (!isSelectingLocation) { setFinalSelectedLocation(null); postDraftStore.clear(); }
    const zoomChanged = data.level !== undefined && data.level !== currentZoom;
    if (zoomChanged) {
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      setMapData(data);
      setCurrentZoom(data.level);
      mapCache.lastCenter = data.center;
      mapCache.lastZoom = data.level;
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      setFinalSelectedLocation(null);
      setTimeout(() => { syncPostsWithSupabase(data.bounds, data.level); }, 50);
      return;
    }
    if (throttleTimer.current) return;
    throttleTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
      if (data.level !== undefined) { setCurrentZoom(data.level); mapCache.lastZoom = data.level; }
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      throttleTimer.current = null;
    }, 100); 
  }, [isSelectingLocation, currentZoom, syncPostsWithSupabase]);

  useEffect(() => { if (mapData) syncPostsWithSupabase(); }, [mapData, syncPostsWithSupabase]);

  useEffect(() => {
    if (!mapData?.bounds) return;
    if (currentZoom >= 9) { if (displayedMarkers.length > 0) setDisplayedMarkers([]); return; }
    const { sw, ne } = mapData.bounds;
    const latPadding = Math.abs(ne.lat - sw.lat) * 0.6;
    const lngPadding = Math.abs(ne.lng - sw.lng) * 1.2;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    const inBoundsCandidates = allPosts.filter(post => {
      if (!post || post.lat === null || post.lng === null) return false;
      if (blockedIds.has(post.user.id)) return false;
      const isInExtendedBounds = post.lat >= (Math.min(sw.lat, ne.lat) - latPadding) && post.lat <= (Math.max(sw.lat, ne.lat) + latPadding) && post.lng >= (Math.min(sw.lng, ne.lng) - lngPadding) && post.lng <= (Math.max(sw.lng, ne.lng) + lngPadding);
      if (!isInExtendedBounds) return false;
      if (post.isAd) return true;
      if (timeValue < 100 && (now - post.createdAt.getTime()) > timeLimitMs) return false;
      let matches = false;
      if (selectedCategories.includes('mine')) matches = authUser && post.user.id === authUser.id;
      else if (selectedCategories.includes('all')) matches = true;
      else matches = selectedCategories.includes(post.category || 'none') || (selectedCategories.includes('hot') && post.borderType === 'popular') || (selectedCategories.includes('influencer') && post.isInfluencer);
      return matches;
    });
    const uniquePosts = Array.from(new Map(inBoundsCandidates.map(p => [p.id, p])).values());
    setDisplayedMarkers(prev => {
      if (prev.length === uniquePosts.length && prev.every((p, i) => p.id === uniquePosts[i].id)) return prev;
      return uniquePosts;
    });
  }, [mapData?.bounds, timeValue, selectedCategories, allPosts, blockedIds, authUser, currentZoom, displayedMarkers.length]);

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
        const mapped = await Promise.all(dbPosts.map(mapDbToPost));
        setAllPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = mapped.filter(p => p && !existingIds.has(p.id));
          const combined = [...newUnique, ...prev];
          mapCache.posts = combined;
          return combined;
        });
      } catch (err) { console.error(err); }
    }
    setIsRefreshing(false);
    showSuccess('데이터를 새로고침했습니다.');
  }, [fetchGlobalTrending, mapData, mapDbToPost]);

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
    setMapCenter(center || { lat: post.lat, lng: post.lng });
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    setHighlightedPostId(post.id);
    highlightTimeoutRef.current = window.setTimeout(() => { setHighlightedPostId(null); highlightTimeoutRef.current = null; }, 4000);
  }, []);

  const handleCurrentLocation = async () => {
    const toastId = showLoading('현재 위치를 찾는 중...');
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      setMapCenter({ lat: latitude, lng: longitude });
      dismissToast(toastId);
      showSuccess('현재 위치로 이동했습니다.');
    } catch (err: any) { dismissToast(toastId); showError('위치 정보를 가져올 수 없습니다.'); }
  };

  useEffect(() => {
    const routeState = location.state as { center?: { lat: number; lng: number }; post?: Post; filterUserId?: string; } | null;
    if (!routeState) return;
    if (routeState.filterUserId === 'me') {
      setSelectedCategories(['mine']);
      setTimeout(() => { setCurrentZoom(10); }, 500);
      if (routeState.post) focusPostOnMap(routeState.post, routeState.center);
      else if (routeState.center) setMapCenter(routeState.center);
      else handleCurrentLocation();
    }
    else if (routeState.post) focusPostOnMap(routeState.post, routeState.center);
    else if (routeState.center) { setSelectedPostId(null); setSearchResultLocation(null); setMapCenter(routeState.center); }
    navigate(location.pathname, { replace: true, state: null });
  }, [focusPostOnMap, location.pathname, location.state, navigate]);

  const handleTrendingPostClick = useCallback((post: Post) => { setIsTrendingExpanded(false); focusPostOnMap(post); }, [focusPostOnMap]);
  const handlePlaceSelect = (place: any) => { setMapCenter({ lat: place.lat, lng: place.lng }); setSearchResultLocation({ lat: place.lat, lng: place.lng }); };
  const handleMapClick = () => { if (searchResultLocation) setSearchResultLocation(null); };

  const handleViewAllClick = useCallback(async () => { 
    if (displayedMarkers.length > 0 && currentZoom < 9) {
      setIsPostListOpen(true);
      const currentIds = displayedMarkers.map(p => p.id);
      
      try {
        const { data, error } = await supabase.from('posts').select('*').in('id', currentIds);
        
        if (!error && data) {
          const mapped = await Promise.all(data.map(p => mapDbToPost(p)));
          const validMapped = mapped.filter(p => p !== null);
          
          setAllPosts(prev => {
            const postMap = new Map(prev.map(p => [p.id, p]));
            
            validMapped.forEach(p => {
              postMap.set(p.id, p);
            });
            
            const updatedList = Array.from(postMap.values());
            mapCache.posts = updatedList;
            return updatedList;
          });
        }
      } catch (err) { 
        console.error('[Index] ViewAll Error:', err); 
      }
    } 
  }, [displayedMarkers, currentZoom, mapDbToPost]);

  const handlePostCreated = (newPost: any) => {
    setAllPosts(prev => [newPost, ...prev]);
    setDisplayedMarkers(prev => [newPost, ...prev]);
    if (newPost.lat && newPost.lng) { setMapCenter({ lat: newPost.lat, lng: newPost.lng }); setCurrentZoom(6); }
    setIsWriteOpen(false);
  };

  const handlePostDeleted = useCallback((id: string) => {
    setAllPosts(prev => prev.filter(p => p.id !== id));
    setDisplayedMarkers(prev => prev.filter(p => p.id !== id));
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
          <MapContainer posts={displayedMarkers} viewedPostIds={viewedIds} highlightedPostId={highlightedPostId} onMarkerClick={(p) => setSelectedPostId(p.id)} onMapChange={handleMapChange} onMapClick={handleMapClick} center={mapCenter} level={currentZoom} searchResultLocation={searchResultLocation} />
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
                  <button onClick={handleViewAllClick} disabled={displayedMarkers.length === 0 || currentZoom >= 9} className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 group overflow-hidden relative", (displayedMarkers.length === 0 || currentZoom >= 9) && "opacity-50 grayscale cursor-not-allowed bg-slate-800/40 border-white/10 shadow-none")}>
                    <LayoutGrid className={cn("w-7 h-7 stroke-[3px] relative z-10", (displayedMarkers.length === 0 || currentZoom >= 9) && "text-white/40")} />
                    <span className={cn("text-[10px] font-black mt-1 relative z-10", (displayedMarkers.length === 0 || currentZoom >= 9) && "text-white/40")}>여기 보기</span>
                  </button>
                  {displayedMarkers.length > 0 && currentZoom < 9 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">{displayedMarkers.length}</div>
                  )}
                </div>
              </div>
              <div className={cn("absolute bottom-6 left-0 right-0 z-10 flex justify-center transition-all duration-500 ease-out", (isTrendingExpanded || isPostListOpen) ? "opacity-0 translate-y-8 pointer-events-none" : "opacity-100 translate-y-0 pointer-events-auto")}><TimeSlider value={timeValue} onChange={setTimeValue} /></div>
            </>
          )}
        </div>
      </motion.div>
      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} />
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
            onLocationClick={(lat, lng) => { setMapCenter({ lat, lng }); setSelectedPostId(null); }}
          />
        )}
      </AnimatePresence>
      <PlaceSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handlePlaceSelect} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} initialLocation={finalSelectedLocation} onPostCreated={handlePostCreated} onStartLocationSelection={startLocationSelection} onLocationReset={() => setFinalSelectedLocation(null)} />
      <PostListOverlay 
        isOpen={isPostListOpen} 
        onClose={() => setIsPostListOpen(false)} 
        initialPosts={displayedMarkers.map(m => allPosts.find(p => p.id === m.id) || m)} 
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