"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TimeSlider from '@/components/TimeSlider';
import PlaceSearch from '@/components/PlaceSearch';
import CategoryMenu from '@/components/CategoryMenu';
import PostListOverlay from '@/components/PostListOverlay';
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Check, X, Loader2, Database } from 'lucide-react';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabasePosts, fetchPostsInBounds } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, profile, refreshProfile } = useAuth();
  
  const [allPosts, setAllPosts] = useState<Post[]>(mapCache.posts);
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  const [currentZoom, setCurrentZoom] = useState(6);
  
  const [maxCounts, setMaxCounts] = useState<Record<number, number>>({
    6: 28,
    7: 105,
    8: 325
  });

  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPostListOpen, setIsPostListOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(24); 
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [finalSelectedLocation, setFinalSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResultLocation, setSearchResultLocation] = useState<{ lat: number; lng: number } | null>(null);

  const throttleTimer = useRef<any>(null);
  const isSyncing = useRef(false);
  const hasGlobalSeeded = useRef(false);

  const KOREA_HUBS = [
    { name: '서울', lat: 37.5665, lng: 126.9780 },
    { name: '부산', lat: 35.1796, lng: 129.0756 },
    { name: '인천', lat: 37.4563, lng: 126.7052 },
    { name: '대구', lat: 35.8714, lng: 128.6014 },
    { name: '대전', lat: 36.3504, lng: 127.3845 },
    { name: '광주', lat: 35.1595, lng: 126.8526 },
    { name: '울산', lat: 35.5384, lng: 129.3114 },
    { name: '제주', lat: 33.4996, lng: 126.5312 },
    { name: '강릉', lat: 37.7519, lng: 128.8761 },
    { name: '전주', lat: 35.8242, lng: 127.1480 }
  ];

  const handleMapChange = useCallback((data: any) => {
    if (throttleTimer.current) return;
    throttleTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
      if (data.level !== undefined && data.level !== currentZoom) setCurrentZoom(data.level);
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      throttleTimer.current = null;
    }, 100);
  }, [isSelectingLocation, currentZoom]);

  const syncPostsWithSupabase = useCallback(async () => {
    if (!mapData?.bounds || isSyncing.current) return;
    isSyncing.current = true;
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
      console.error('[Sync] Error:', err);
    } finally {
      isSyncing.current = false;
    }
  }, [mapData]);

  const seedGlobalData = useCallback(async (force = false) => {
    if (!authUser) return;
    if (hasGlobalSeeded.current && !force) return;
    hasGlobalSeeded.current = true;

    const toastId = showLoading('데이터베이스를 초기화하고 있습니다...');
    
    try {
      const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
      const avatarUrl = profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`;

      // 1. 프로필 생성 (반드시 성공해야 함)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authUser.id,
        nickname: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      });

      if (profileError) {
        console.error('[Seed] Profile Error:', profileError);
        throw new Error(`프로필 생성 실패: ${profileError.message}`);
      }

      // 2. 기존 데이터 확인
      if (!force) {
        const { count, error: countError } = await supabase.from('posts').select('*', { count: 'exact', head: true });
        if (!countError && count && count > 0) {
          dismissToast(toastId);
          return;
        }
      }

      // 3. 데이터 생성
      const virtualAuthors = Array.from({ length: 20 }).map((_, i) => ({
        name: `Explorer_${i + 1}`,
        avatar: `https://i.pravatar.cc/150?u=bot_${i + 1}`
      }));

      let allMockData: any[] = [];
      KOREA_HUBS.forEach(hub => {
        const mockPosts = createMockPosts(hub.lat, hub.lng, 10);
        const insertData = mockPosts.map(p => ({
          content: p.content,
          location_name: `${hub.name} 주변`,
          latitude: p.lat,
          longitude: p.lng,
          image_url: p.image,
          user_id: authUser.id,
          user_name: virtualAuthors[Math.floor(Math.random() * virtualAuthors.length)].name,
          user_avatar: virtualAuthors[Math.floor(Math.random() * virtualAuthors.length)].avatar,
          likes: p.likes,
          category: p.category,
          border_type: p.borderType,
          is_gif: p.isGif,
          is_influencer: p.isInfluencer,
          youtube_url: p.youtubeUrl,
          created_at: p.createdAt.toISOString()
        }));
        allMockData = [...allMockData, ...insertData];
      });

      // 4. 10개씩 끊어서 삽입하며 에러 체크
      for (let i = 0; i < allMockData.length; i += 10) {
        const chunk = allMockData.slice(i, i + 10);
        const { error: insertError } = await supabase.from('posts').insert(chunk);
        
        if (insertError) {
          console.error(`[Seed] Insert Error at chunk ${i/10}:`, insertError);
          throw new Error(`데이터 삽입 실패 (${i/10}): ${insertError.message}`);
        }
      }

      dismissToast(toastId);
      showSuccess('전국 100개의 테스트 데이터가 생성되었습니다! 🇰🇷');
      syncPostsWithSupabase();
    } catch (err: any) {
      console.error('[Seed] Final Error:', err);
      dismissToast(toastId);
      showError(err.message || '데이터 생성 중 오류가 발생했습니다.');
    }
  }, [authUser, profile, syncPostsWithSupabase]);

  useEffect(() => {
    if (authUser) seedGlobalData();
  }, [authUser, seedGlobalData]);

  useEffect(() => {
    syncPostsWithSupabase();
  }, [mapData, syncPostsWithSupabase]);

  useEffect(() => {
    if (!mapData?.bounds) return;
    if (currentZoom >= 9) { setDisplayedMarkers([]); return; }

    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;

    const inBoundsCandidates = allPosts.filter(post => {
      const isNotBlocked = !blockedIds.has(post.user.id);
      if (!isNotBlocked) return false;
      if (post.id === highlightedPostId) return true;
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat && post.lng >= sw.lng && post.lng <= ne.lng;
      if (!isWithinBounds) return false;
      const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
      const isMe = authUser && post.user.id === authUser.id;
      const isTargetUser = post.user.id === targetUserId;
      let matchesCategory = false;
      if (selectedCategories.includes('mine')) matchesCategory = !!isMe;
      else if (selectedCategories.includes('user_filter')) matchesCategory = !!isTargetUser;
      else if (selectedCategories.includes('all')) matchesCategory = true;
      else matchesCategory = selectedCategories.includes(post.category || 'none') || (selectedCategories.includes('hot') && post.borderType === 'popular') || (selectedCategories.includes('influencer') && post.isInfluencer);
      return isWithinTime && matchesCategory;
    });

    const displayCount = maxCounts[currentZoom] || inBoundsCandidates.length;
    const stableSort = (a: Post, b: Post) => b.likes - a.likes || a.id.localeCompare(b.id);
    const finalMarkers = inBoundsCandidates.sort(stableSort).slice(0, displayCount);
    if (highlightedPostId) {
      const highlightedPost = allPosts.find(p => p.id === highlightedPostId);
      if (highlightedPost && !finalMarkers.some(p => p.id === highlightedPostId)) finalMarkers.unshift(highlightedPost);
    }
    setDisplayedMarkers(finalMarkers);
  }, [mapData, timeValue, selectedCategories, allPosts, blockedIds, targetUserId, authUser, currentZoom, maxCounts, highlightedPostId]);

  const handleLikeToggle = useCallback((postId: string) => {
    setAllPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    mapCache.populatedTiles.clear();
    setAllPosts([]);
    await syncPostsWithSupabase();
    setIsRefreshing(false);
  }, [syncPostsWithSupabase]);

  const handleForceSeed = () => {
    seedGlobalData(true);
  };

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
    setHighlightedPostId(post.id);
    setTimeout(() => setHighlightedPostId(null), 4000);
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

  const handlePlaceSelect = (place: any) => {
    setMapCenter({ lat: place.lat, lng: place.lng });
    setSearchResultLocation({ lat: place.lat, lng: place.lng });
  };

  const handleMapClick = () => { if (searchResultLocation) setSearchResultLocation(null); };
  const handleViewAllClick = () => { if (displayedMarkers.length > 0 && currentZoom < 9) setIsPostListOpen(true); };

  const handlePostCreated = (newPost: Post) => {
    setAllPosts(prev => [newPost, ...prev]);
    setMapCenter({ lat: newPost.lat, lng: newPost.lng });
    setFinalSelectedLocation(null); 
    setTimeout(() => {
      setHighlightedPostId(newPost.id);
      setTimeout(() => setHighlightedPostId(null), 3000);
    }, 1500);
  };

  const confirmLocationSelection = () => {
    if (tempSelectedLocation) {
      setFinalSelectedLocation(tempSelectedLocation);
      setIsSelectingLocation(false);
      setTimeout(() => setIsWriteOpen(true), 100);
    }
  };

  const cancelLocationSelection = () => {
    setIsSelectingLocation(false);
    setTempSelectedLocation(null);
    setTimeout(() => setIsWriteOpen(true), 100);
  };

  const startLocationSelection = () => {
    setIsWriteOpen(false);
    setIsPostListOpen(false);
    setTimeout(() => {
      setIsSelectingLocation(true);
      setTempSelectedLocation(mapData?.center || mapCache.lastCenter);
    }, 500);
  };

  const filteredAllPosts = useMemo(() => allPosts.filter(p => !blockedIds.has(p.user.id)), [allPosts, blockedIds]);
  const trendingPosts = useMemo(() => {
    return filteredAllPosts
      .filter(p => !p.isAd)
      .sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id))
      .slice(0, 20)
      .map((p, index) => ({ ...p, rank: index + 1 }));
  }, [filteredAllPosts]);

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
            searchResultLocation={searchResultLocation}
          />

          <AnimatePresence>
            {isSelectingLocation && (
              <>
                <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[50]">
                  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative mb-12">
                    <div className="relative w-12 h-12">
                      <div className="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl" />
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10" />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full" />
                  </motion.div>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-32 left-0 right-0 px-6 z-[100] flex flex-col gap-4">
                  <div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-indigo-100 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" /><p className="text-sm font-black text-gray-900">지도를 움직여 위치를 맞추세요</p></div>
                    <div className="flex w-full gap-3">
                      <Button onClick={cancelLocationSelection} variant="secondary" className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"><X className="w-4 h-4 mr-2" /> 취소</Button>
                      <Button onClick={confirmLocationSelection} className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100"><Check className="w-4 h-4 mr-2" /> 이 위치로 선택</Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {!isSelectingLocation && (
            <>
              <div className="absolute top-[100px] right-4 z-[60]">
                <button 
                  onClick={handleForceSeed}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black shadow-xl shadow-indigo-200 active:scale-90 transition-all border-2 border-white"
                >
                  <Database className="w-4 h-4" />
                  데이터 초기화
                </button>
              </div>

              <div className={cn("absolute top-24 left-0 right-0 px-4 flex items-start justify-between pointer-events-none transition-all duration-300", isTrendingExpanded ? "z-40" : "z-10")}>
                <div className="w-full shrink-0 pointer-events-auto">
                  <TrendingPosts posts={trendingPosts} isExpanded={isTrendingExpanded} onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)} onPostClick={handleTrendingPostClick} />
                </div>
              </div>
              <div className="absolute bottom-32 left-4 z-20 flex flex-col gap-2">
                <button onClick={() => setIsCategoryOpen(true)} className={cn("w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500", !selectedCategories.includes('all') && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600")}><Layers className="w-6 h-6" /></button>
                <button onClick={() => setIsSearchOpen(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Search className="w-6 h-6" /></button>
                <button onClick={handleCurrentLocation} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Navigation className="w-6 h-6 fill-white" /></button>
              </div>
              <div className="absolute bottom-32 right-4 z-20 flex flex-col items-center gap-4">
                <button onClick={handleRefresh} disabled={isRefreshing} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100">
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} /><span className="text-[9px] font-black mt-1">재검색</span>
                </button>
                <div className="relative">
                  <div className="absolute inset-0 -m-2 bg-indigo-400/30 rounded-[28px] animate-ping-small pointer-events-none" />
                  <button onClick={handleViewAllClick} disabled={displayedMarkers.length === 0 || currentZoom >= 9} className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all disabled:opacity-50 border-2 border-white/20 group overflow-hidden relative", currentZoom >= 9 && "opacity-50 grayscale cursor-not-allowed")}>
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" /><span className="text-[10px] font-black mt-1 relative z-10">모두 보기</span>
                  </button>
                  {displayedMarkers.length > 0 && currentZoom < 9 && <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">{displayedMarkers.length}</div>}
                </div>
              </div>
              <AnimatePresence>{!isTrendingExpanded && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}><TimeSlider value={timeValue} onChange={setTimeValue} /></motion.div>}</AnimatePresence>
            </>
          )}
        </div>
      </motion.div>

      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} targetUserId={targetUserId} />
      <AnimatePresence>{selectedPostId && <PostDetail key="post-detail-modal" posts={displayedMarkers} initialIndex={displayedMarkers.findIndex(p => p.id === selectedPostId)} isOpen={true} onClose={() => setSelectedPostId(null)} onViewPost={markAsViewed} onLikeToggle={handleLikeToggle} onLocationClick={(lat, lng) => { setMapCenter({ lat, lng }); setSelectedPostId(null); }} />}</AnimatePresence>
      <PlaceSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handlePlaceSelect} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} initialLocation={finalSelectedLocation} onPostCreated={handlePostCreated} onStartLocationSelection={startLocationSelection} />
      <PostListOverlay isOpen={isPostListOpen} onClose={() => setIsPostListOpen(false)} initialPosts={displayedMarkers} mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }} />
      {!isSelectingLocation && <BottomNav onWriteClick={() => setIsWriteOpen(true)} />}
    </>
  );
};

export default Index;