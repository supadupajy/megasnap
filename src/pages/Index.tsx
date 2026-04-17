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
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Check, X, MapPin } from 'lucide-react';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabasePosts } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  const { data: supabasePosts = [], refetch: refetchSupabase } = useSupabasePosts();
  
  const [allPosts, setAllPosts] = useState<Post[]>(mapCache.posts);
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  
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
  const [timeValue, setTimeValue] = useState(12);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  // 위치 선택 모드 관련 상태
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [finalSelectedLocation, setFinalSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const TILE_SIZE = 0.02;
  const MAX_MARKERS = 60; 
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    if (supabasePosts.length > 0) {
      setAllPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueReal = supabasePosts.filter(p => !existingIds.has(p.id));
        return [...uniqueReal, ...prev];
      });
    }
  }, [supabasePosts]);

  useEffect(() => {
    mapCache.posts = allPosts;
  }, [allPosts]);

  const handleMapChange = useCallback((data: any) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
      
      // 위치 선택 모드일 때 지도의 중심 좌표를 실시간으로 tempSelectedLocation에 반영
      if (isSelectingLocation) {
        setTempSelectedLocation(data.center);
      }
    }, 30); 
  }, [isSelectingLocation]);

  const filteredAllPosts = useMemo(() => {
    return allPosts.filter(p => !blockedIds.has(p.user.id));
  }, [allPosts, blockedIds]);

  const trendingPosts = useMemo(() => {
    return filteredAllPosts
      .filter(p => !p.isAd)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 20)
      .map((p, index) => ({ ...p, rank: index + 1 }));
  }, [filteredAllPosts]);

  useEffect(() => {
    if (location.state?.filterUserId) {
      const userId = location.state.filterUserId;
      const finalUserId = userId === 'me' ? authUser?.id : userId;
      setTargetUserId(finalUserId || null);
      setSelectedCategories([userId === 'me' ? 'mine' : 'user_filter']);
    } else if (location.state?.post) {
      const incomingPost = location.state.post;
      if (blockedIds.has(incomingPost.user.id)) return;

      setAllPosts(prev => {
        if (prev.some(p => p.id === incomingPost.id)) return prev;
        return [incomingPost, ...prev];
      });

      setMapCenter({ lat: incomingPost.lat, lng: incomingPost.lng });
      
      const pingTimer = setTimeout(() => {
        setHighlightedPostId(incomingPost.id);
        setTimeout(() => setHighlightedPostId(null), 3000);
      }, 1500);
      
      return () => clearTimeout(pingTimer);
    } else if (location.state?.center) {
      setMapCenter(location.state.center);
    }
  }, [location.state, blockedIds, authUser]);

  useEffect(() => {
    if (!mapData?.bounds) return;
    const { sw, ne } = mapData.bounds;
    
    const startLat = Math.floor((sw.lat - TILE_SIZE) / TILE_SIZE);
    const endLat = Math.ceil((ne.lat + TILE_SIZE) / TILE_SIZE);
    const startLng = Math.floor((sw.lng - TILE_SIZE) / TILE_SIZE);
    const endLng = Math.ceil((ne.lng + TILE_SIZE) / TILE_SIZE);

    const newPosts: Post[] = [];
    let tilesAdded = false;

    for (let latIdx = startLat; latIdx <= endLat; latIdx++) {
      for (let lngIdx = startLng; lngIdx <= endLng; lngIdx++) {
        const tileKey = `${latIdx},${lngIdx}`;
        if (!mapCache.populatedTiles.has(tileKey)) {
          mapCache.populatedTiles.add(tileKey);
          tilesAdded = true;
          const tileCenterLat = (latIdx + 0.5) * TILE_SIZE;
          const tileCenterLng = (lngIdx + 0.5) * TILE_SIZE;
          newPosts.push(...createMockPosts(tileCenterLat, tileCenterLng, 8));
        }
      }
    }

    if (tilesAdded) {
      setAllPosts(prev => [...prev, ...newPosts]);
    }
  }, [mapData]);

  useEffect(() => {
    if (!mapData?.bounds) return;
    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;

    const inBoundsCandidates = allPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      
      if (!isWithinBounds) return false;

      const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
      
      const isMe = authUser && post.user.id === authUser.id;
      const isTargetUser = post.user.id === targetUserId;

      let matchesCategory = false;
      if (selectedCategories.includes('mine')) {
        matchesCategory = !!isMe;
      } else if (selectedCategories.includes('user_filter')) {
        matchesCategory = !!isTargetUser;
      } else if (selectedCategories.includes('all')) {
        matchesCategory = true;
      } else {
        matchesCategory = selectedCategories.includes(post.category || 'none') ||
                          (selectedCategories.includes('hot') && post.borderType === 'popular') ||
                          (selectedCategories.includes('influencer') && post.isInfluencer);
      }

      const isNotBlocked = !blockedIds.has(post.user.id);
      return isWithinTime && matchesCategory && isNotBlocked;
    });

    const currentDisplayedIds = new Set(displayedMarkers.map(m => m.id));
    const stillInBounds = inBoundsCandidates.filter(m => currentDisplayedIds.has(m.id));
    const newlyInBounds = inBoundsCandidates.filter(m => !currentDisplayedIds.has(m.id));
    
    newlyInBounds.sort((a, b) => {
      const scoreA = (a.isInfluencer ? 1000 : 0) + (a.borderType === 'popular' ? 500 : 0) + a.likes;
      const scoreB = (b.isInfluencer ? 1000 : 0) + (b.borderType === 'popular' ? 500 : 0) + b.likes;
      return scoreB - scoreA;
    });

    const combined = [...stillInBounds, ...newlyInBounds].slice(0, MAX_MARKERS);
    setDisplayedMarkers(combined);
  }, [mapData, timeValue, selectedCategories, allPosts, blockedIds, targetUserId, authUser]);

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
    await refetchSupabase();
    setIsRefreshing(false);
  }, [refetchSupabase]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
    setTimeout(() => {
      setHighlightedPostId(post.id);
      setTimeout(() => setHighlightedPostId(null), 3000);
    }, 1500);
  }, []);

  const handleCurrentLocation = () => {
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
  };

  const handlePlaceSelect = (place: any) => {
    setMapCenter({ lat: place.lat, lng: place.lng });
  };

  const handleViewAllClick = () => {
    if (displayedMarkers.length > 0) {
      setIsPostListOpen(true);
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setAllPosts(prev => [newPost, ...prev]);
    setMapCenter({ lat: newPost.lat, lng: newPost.lng });
    setFinalSelectedLocation(null); 
    setTimeout(() => {
      setHighlightedPostId(newPost.id);
      setTimeout(() => setHighlightedPostId(null), 3000);
    }, 1500);
  };

  const handleMapClick = useCallback((loc: { lat: number; lng: number }) => {
    // 이제 클릭으로 위치를 선택하지 않으므로 로직 제거
  }, []);

  const confirmLocationSelection = () => {
    if (tempSelectedLocation) {
      setFinalSelectedLocation(tempSelectedLocation);
      setIsSelectingLocation(false);
      setTimeout(() => {
        setIsWriteOpen(true);
      }, 100);
    }
  };

  const cancelLocationSelection = () => {
    setIsSelectingLocation(false);
    setTempSelectedLocation(null);
    setTimeout(() => {
      setIsWriteOpen(true);
    }, 100);
  };

  const startLocationSelection = () => {
    setIsWriteOpen(false);
    setTimeout(() => {
      setIsSelectingLocation(true);
      // 진입 시 현재 지도의 중심점을 초기 선택 위치로 설정
      if (mapData?.center) {
        setTempSelectedLocation(mapData.center);
      } else {
        setTempSelectedLocation(mapCache.lastCenter);
      }
    }, 500);
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-screen overflow-hidden bg-gray-50"
      >
        <div className="absolute inset-0 z-0">
          <MapContainer 
            posts={displayedMarkers}
            viewedPostIds={viewedIds}
            highlightedPostId={highlightedPostId}
            onMarkerClick={(p) => setSelectedPostId(p.id)}
            onMapChange={handleMapChange}
            onMapClick={handleMapClick}
            center={mapCenter}
          />

          {/* 위치 선택 모드 전용 중앙 고정 핀 UI */}
          <AnimatePresence>
            {isSelectingLocation && (
              <>
                {/* 중앙 고정 핀 */}
                <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[50]">
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="relative mb-12" // 핀의 끝점이 중앙에 오도록 보정
                  >
                    <div className="relative w-12 h-12">
                      {/* 뾰족한 부분이 아래를 향하도록 수정: rounded-bl-none + rotate-45 */}
                      <div className="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-bl-none rotate-45 border-4 border-white shadow-2xl" />
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10" />
                    </div>
                    {/* 핀 아래 그림자 */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full" />
                  </motion.div>
                </div>

                {/* 하단 컨트롤 바 */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-32 left-0 right-0 px-6 z-[100] flex flex-col gap-4"
                >
                  <div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-indigo-100 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                      <p className="text-sm font-black text-gray-900">지도를 움직여 위치를 맞추세요</p>
                    </div>
                    
                    <div className="flex w-full gap-3">
                      <Button 
                        onClick={cancelLocationSelection}
                        variant="secondary"
                        className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"
                      >
                        <X className="w-4 h-4 mr-2" /> 취소
                      </Button>
                      <Button 
                        onClick={confirmLocationSelection}
                        className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                      >
                        <Check className="w-4 h-4 mr-2" /> 이 위치로 선택
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isTrendingExpanded && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsTrendingExpanded(false)}
                className="fixed inset-0 z-30 bg-black/5 backdrop-blur-[1px]"
              />
            )}
          </AnimatePresence>

          {!isSelectingLocation && (
            <>
              <div className={cn(
                "absolute top-24 left-0 right-0 px-4 flex items-start justify-between pointer-events-none transition-all duration-300",
                isTrendingExpanded ? "z-40" : "z-10"
              )}>
                <div className="w-full shrink-0 pointer-events-auto">
                  <TrendingPosts 
                    posts={trendingPosts}
                    isExpanded={isTrendingExpanded}
                    onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
                    onPostClick={handleTrendingPostClick}
                  />
                </div>
              </div>

              <div className="absolute bottom-32 left-4 z-20 flex flex-col gap-2">
                <button 
                  onClick={() => setIsCategoryOpen(true)}
                  className={cn(
                    "w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500",
                    !selectedCategories.includes('all') && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600"
                  )}
                >
                  <Layers className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"
                >
                  <Search className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleCurrentLocation}
                  className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"
                >
                  <Navigation className="w-6 h-6 fill-white" />
                </button>
              </div>

              <div className="absolute bottom-32 right-4 z-20 flex flex-col items-center gap-4">
                <button 
                  onClick={handleRefresh} 
                  disabled={isRefreshing} 
                  className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100"
                >
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} />
                  <span className="text-[9px] font-black mt-1">재검색</span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 -m-2 bg-indigo-400/30 rounded-[28px] animate-ping-small pointer-events-none" />
                  
                  <button 
                    onClick={handleViewAllClick} 
                    disabled={displayedMarkers.length === 0} 
                    className={cn(
                      "w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all disabled:opacity-50 border-2 border-white/20 group overflow-hidden relative"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="shine-overlay absolute inset-0 pointer-events-none" />
                    <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
                    <span className="text-[10px] font-black mt-1 relative z-10">모두 보기</span>
                  </button>
                  
                  {displayedMarkers.length > 0 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">
                      {displayedMarkers.length}
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {!isTrendingExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <TimeSlider value={timeValue} onChange={setTimeValue} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>

      <CategoryMenu 
        isOpen={isCategoryOpen}
        selectedCategories={selectedCategories}
        onSelect={setSelectedCategories}
        onClose={() => setIsCategoryOpen(false)}
        targetUserId={targetUserId}
      />

      {selectedPostId && (
        <PostDetail 
          posts={displayedMarkers} 
          initialIndex={displayedMarkers.findIndex(p => p.id === selectedPostId)}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
          onViewPost={markAsViewed}
          onLikeToggle={handleLikeToggle}
          onLocationClick={(lat, lng) => {
            const post = allPosts.find(p => p.lat === lat && p.lng === lng);
            if (post) {
              setHighlightedPostId(post.id);
              setTimeout(() => setHighlightedPostId(null), 3000);
            }
            setMapCenter({ lat, lng });
            setSelectedPostId(null);
          }}
        />
      )}
      <PlaceSearch 
        key={isSearchOpen ? 'open' : 'closed'}
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelect={handlePlaceSelect} 
      />
      <WritePost 
        isOpen={isWriteOpen} 
        onClose={() => setIsWriteOpen(false)} 
        initialLocation={finalSelectedLocation}
        onPostCreated={handlePostCreated}
        onStartLocationSelection={startLocationSelection}
      />
      <PostListOverlay 
        isOpen={isPostListOpen}
        onClose={() => setIsPostListOpen(false)}
        initialPosts={displayedMarkers}
        mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
      />
      
      {/* Index 페이지 전용 BottomNav 추가 */}
      {!isSelectingLocation && (
        <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      )}
    </>
  );
};

export default Index;