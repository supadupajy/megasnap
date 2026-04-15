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
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Sparkles, Activity } from 'lucide-react';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [showDensity, setShowDensity] = useState(false);

  const TILE_SIZE = 0.02;
  const MAX_POPULAR_COUNT = 3;

  useEffect(() => {
    mapCache.posts = allPosts;
  }, [allPosts]);

  useEffect(() => {
    if (mapCenter) {
      mapCache.lastCenter = mapCenter;
    }
  }, [mapCenter]);

  // 차단된 사용자를 제외한 전체 포스트
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
    if (location.state?.post) {
      const incomingPost = location.state.post;
      if (blockedIds.has(incomingPost.user.id)) return;

      setAllPosts(prev => {
        if (prev.some(p => p.id === incomingPost.id)) return prev;
        return [incomingPost, ...prev];
      });
      setMapCenter({ lat: incomingPost.lat, lng: incomingPost.lng });
      
      const pingTimer = setTimeout(() => {
        setHighlightedPostId(incomingPost.id);
        setTimeout(() => setHighlightedPostId(null), 3500);
      }, 1000);
      
      return () => clearTimeout(pingTimer);
    } else if (location.state?.center) {
      setMapCenter(location.state.center);
    }
  }, [location.state, blockedIds]);

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

    const updatedAllPosts = tilesAdded ? [...allPosts, ...newPosts] : allPosts;
    if (tilesAdded) setAllPosts(updatedAllPosts);

    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;

    // 마커 개수 랜덤화 (25~35개)
    const targetMarkerCount = Math.floor(Math.random() * 11) + 25;

    // 차단된 사용자 필터링 포함 및 멀티 카테고리 필터링
    const inBoundsPool = updatedAllPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
      
      // 멀티 카테고리 로직
      const matchesCategory = selectedCategories.includes('all') || 
                              selectedCategories.includes(post.category || 'none') ||
                              (selectedCategories.includes('hot') && post.borderType === 'popular') ||
                              (selectedCategories.includes('influencer') && post.isInfluencer) ||
                              (selectedCategories.includes('mine') && post.user.id === 'me');

      const isNotBlocked = !blockedIds.has(post.user.id);
      return isWithinBounds && isWithinTime && matchesCategory && isNotBlocked;
    });

    const stillVisible = displayedMarkers.filter(p => {
      const isWithinBounds = p.lat >= sw.lat && p.lat <= ne.lat && p.lng >= sw.lng && p.lng <= ne.lng;
      const isWithinTime = p.isAd || (now - p.createdAt.getTime()) <= timeLimitMs;
      const matchesCategory = selectedCategories.includes('all') || 
                              selectedCategories.includes(p.category || 'none') ||
                              (selectedCategories.includes('hot') && p.borderType === 'popular') ||
                              (selectedCategories.includes('influencer') && p.isInfluencer) ||
                              (selectedCategories.includes('mine') && p.user.id === 'me');
      const isNotBlocked = !blockedIds.has(p.user.id);
      return isWithinBounds && isWithinTime && matchesCategory && isNotBlocked;
    });

    const ROWS = 6;
    const COLS = 5;
    const latStep = (ne.lat - sw.lat) / ROWS;
    const lngStep = (ne.lng - sw.lng) / COLS;

    const occupiedCells = new Set();
    let currentPopularCount = 0;

    stillVisible.forEach(p => {
      const r = Math.min(Math.floor((p.lat - sw.lat) / latStep), ROWS - 1);
      const c = Math.min(Math.floor((p.lng - sw.lng) / lngStep), COLS - 1);
      occupiedCells.add(`${r}-${c}`);
      if (p.borderType === 'popular') currentPopularCount++;
    });

    const nextMarkers = [...stillVisible];

    if (highlightedPostId) {
      const hPost = updatedAllPosts.find(p => p.id === highlightedPostId);
      if (hPost && !nextMarkers.some(m => m.id === hPost.id) && !blockedIds.has(hPost.user.id)) {
        nextMarkers.push(hPost);
      }
    }

    const candidates = inBoundsPool.filter(p => !nextMarkers.some(m => m.id === p.id));

    const getScore = (p: Post) => {
      let score = Math.random() * 100;
      if (p.isInfluencer) score += 15; 
      if (p.borderType === 'popular') score += 10;
      if (p.isAd) score += 5;
      score += Math.log10(p.likes + 1) * 2;
      return score;
    };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (nextMarkers.length >= targetMarkerCount) break;
        if (!occupiedCells.has(`${r}-${c}`)) {
          const cellSw = { lat: sw.lat + r * latStep, lng: sw.lng + c * lngStep };
          const cellNe = { lat: sw.lat + (r + 1) * latStep, lng: sw.lng + (c + 1) * lngStep };
          
          let cellCandidates = candidates.filter(p => 
            p.lat >= cellSw.lat && p.lat < cellNe.lat &&
            p.lng >= cellSw.lng && p.lng < cellNe.lng &&
            !nextMarkers.some(m => m.id === p.id)
          );

          if (currentPopularCount >= MAX_POPULAR_COUNT) {
            cellCandidates = cellCandidates.filter(p => p.borderType !== 'popular');
          }

          if (cellCandidates.length > 0) {
            const best = cellCandidates.sort((a, b) => getScore(b) - getScore(a))[0];
            nextMarkers.push(best);
            occupiedCells.add(`${r}-${c}`);
            if (best.borderType === 'popular') currentPopularCount++;
          }
        }
      }
      if (nextMarkers.length >= targetMarkerCount) break;
    }

    if (nextMarkers.length < targetMarkerCount) {
      let remainingCandidates = candidates.filter(p => !nextMarkers.some(m => m.id === p.id));
      if (currentPopularCount >= MAX_POPULAR_COUNT) {
        remainingCandidates = remainingCandidates.filter(p => p.borderType !== 'popular');
      }
      const sortedRemaining = remainingCandidates.sort((a, b) => getScore(b) - getScore(a));
      for (const p of sortedRemaining) {
        if (nextMarkers.length >= targetMarkerCount) break;
        if (p.borderType === 'popular' && currentPopularCount >= MAX_POPULAR_COUNT) continue;
        nextMarkers.push(p);
        if (p.borderType === 'popular') currentPopularCount++;
      }
    }

    setDisplayedMarkers(nextMarkers);
  }, [mapData, timeValue, selectedCategories, allPosts, highlightedPostId, blockedIds]);

  const handleLikeToggle = useCallback((postId: string) => {
    const update = (prev: Post[]) => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    });
    setAllPosts(update);
    setDisplayedMarkers(update);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    mapCache.populatedTiles.clear();
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      setTimeout(() => {
        const centerLat = (ne.lat + sw.lat) / 2;
        const centerLng = (ne.lng + sw.lng) / 2;
        const refreshedPosts = createMockPosts(centerLat, centerLng, 80);
        setAllPosts(refreshedPosts);
        setDisplayedMarkers([]); 
        setIsRefreshing(false);
      }, 600);
    } else {
      setIsRefreshing(false);
    }
  }, [mapData]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
    
    setTimeout(() => {
      setHighlightedPostId(post.id);
      setTimeout(() => setHighlightedPostId(null), 3500);
    }, 1000);
  }, []);

  const handleCurrentLocation = () => {
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
  };

  const handlePlaceSelect = (place: any) => {
    setMapCenter({ lat: place.lat, lng: place.lng });
  };

  const handleViewAllClick = () => {
    if (displayedMarkers.length > 0) {
      navigate('/post-list', { 
        state: { 
          posts: displayedMarkers,
          center: mapCenter || { lat: 37.5665, lng: 126.9780 }
        } 
      });
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setAllPosts(prev => [newPost, ...prev]);
    setMapCenter({ lat: newPost.lat, lng: newPost.lng });
    
    setTimeout(() => {
      setHighlightedPostId(newPost.id);
      setTimeout(() => setHighlightedPostId(null), 3500);
    }, 1000);
  };

  return (
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
          onMapChange={setMapData}
          onMapWriteClick={(loc) => {
            setPendingLocation(loc);
            setIsWriteOpen(true);
          }} 
          center={mapCenter}
          showDensity={showDensity}
        />

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
            onClick={() => setShowDensity(!showDensity)}
            className={cn(
              "w-12 h-12 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-90 transition-all border",
              showDensity 
                ? "bg-red-500 text-white border-red-400" 
                : "bg-white text-gray-600 border-gray-100"
            )}
          >
            <Activity className={cn("w-5 h-5", showDensity && "animate-pulse")} />
            <span className="text-[8px] font-black mt-0.5">밀집도</span>
          </button>
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
            <button 
              onClick={handleViewAllClick} 
              disabled={displayedMarkers.length === 0} 
              className={cn(
                "w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all disabled:opacity-50 border-2 border-white/20 group overflow-hidden",
                displayedMarkers.length > 0 && "animate-bounce-subtle"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
              <span className="text-[10px] font-black mt-1 relative z-10">모두 보기</span>
            </button>
            
            {/* 숫자 배지 */}
            {displayedMarkers.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300">
                {displayedMarkers.length}
              </div>
            )}
            
            {/* 펄스 효과 */}
            {displayedMarkers.length > 0 && (
              <div className="absolute inset-0 -z-10 bg-indigo-400/30 rounded-[24px] animate-ping" />
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
      </div>

      <CategoryMenu 
        isOpen={isCategoryOpen}
        selectedCategories={selectedCategories}
        onSelect={setSelectedCategories}
        onClose={() => setIsCategoryOpen(false)}
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
              setTimeout(() => setHighlightedPostId(null), 3500);
            }
            setMapCenter({ lat, lng });
            setSelectedPostId(null);
          }}
        />
      )}
      <PlaceSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelect={handlePlaceSelect} 
      />
      <WritePost 
        isOpen={isWriteOpen} 
        onClose={() => setIsWriteOpen(false)} 
        initialLocation={pendingLocation}
        onPostCreated={handlePostCreated}
      />
    </motion.div>
  );
};

export default Index;