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
import { RefreshCw, LayoutGrid, Navigation, Search, Layers } from 'lucide-react';
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

  const TILE_SIZE = 0.02;
  const MAX_MARKERS = 45; 

  useEffect(() => {
    mapCache.posts = allPosts;
  }, [allPosts]);

  useEffect(() => {
    if (mapData?.center) {
      mapCache.lastCenter = mapData.center;
    }
  }, [mapData]);

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
        setTimeout(() => setHighlightedPostId(null), 3000);
      }, 1000);
      
      return () => clearTimeout(pingTimer);
    } else if (location.state?.center) {
      setMapCenter(location.state.center);
    }
  }, [location.state, blockedIds]);

  // 마커 업데이트 로직: 가장자리 생성 및 소멸
  useEffect(() => {
    if (!mapData?.bounds || !mapData?.center) return;
    const { sw, ne } = mapData.bounds;
    const center = mapData.center;
    
    // 1. 새로운 타일 데이터 생성
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

    // 2. 현재 화면에 유지할 마커 필터링 (화면 밖으로 나가면 제거)
    const stillInBounds = displayedMarkers.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
      const isNotBlocked = !blockedIds.has(post.user.id);
      return isWithinBounds && isWithinTime && isNotBlocked;
    });

    // 3. 부족한 마커를 채우기 위한 후보군 추출
    if (stillInBounds.length < MAX_MARKERS) {
      const displayedIds = new Set(stillInBounds.map(m => m.id));
      
      const candidates = updatedAllPosts.filter(post => {
        if (displayedIds.has(post.id)) return false;
        
        const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                               post.lng >= sw.lng && post.lng <= ne.lng;
        const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
        
        const matchesCategory = selectedCategories.includes('all') || 
                                selectedCategories.includes(post.category || 'none') ||
                                (selectedCategories.includes('hot') && post.borderType === 'popular') ||
                                (selectedCategories.includes('influencer') && post.isInfluencer) ||
                                (selectedCategories.includes('mine') && post.user.id === 'me');

        const isNotBlocked = !blockedIds.has(post.user.id);
        return isWithinBounds && isWithinTime && matchesCategory && isNotBlocked;
      });

      // 4. "가장자리 생성" 핵심 로직: 중심에서 가장 먼(가장자리에 가까운) 후보부터 선택
      const sortedByEdge = candidates.sort((a, b) => {
        const distA = Math.pow(a.lat - center.lat, 2) + Math.pow(a.lng - center.lng, 2);
        const distB = Math.pow(b.lat - center.lat, 2) + Math.pow(b.lng - center.lng, 2);
        return distB - distA; // 먼 순서대로 (가장자리 우선)
      });

      const neededCount = MAX_MARKERS - stillInBounds.length;
      const toAdd = sortedByEdge.slice(0, neededCount);
      
      const finalMarkers = [...stillInBounds, ...toAdd];
      
      // 상태 업데이트 (ID 리스트가 변했을 때만)
      const nextIds = finalMarkers.map(m => m.id).sort().join(',');
      const prevIds = displayedMarkers.map(m => m.id).sort().join(',');
      
      if (nextIds !== prevIds) {
        setDisplayedMarkers(finalMarkers);
      }
    } else if (stillInBounds.length !== displayedMarkers.length) {
      // 화면 밖으로 나간 마커만 제거된 경우
      setDisplayedMarkers(stillInBounds);
    }
  }, [mapData, timeValue, selectedCategories, allPosts, blockedIds]);

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
      setTimeout(() => setHighlightedPostId(null), 3000);
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
          center: mapCache.lastCenter || mapCenter || { lat: 37.5665, lng: 126.9780 }
        } 
      });
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setAllPosts(prev => [newPost, ...prev]);
    setMapCenter({ lat: newPost.lat, lng: newPost.lng });
    
    setTimeout(() => {
      setHighlightedPostId(newPost.id);
      setTimeout(() => setHighlightedPostId(null), 3000);
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
                "w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all disabled:opacity-50 border-2 border-white/20 group overflow-hidden"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
              <span className="text-[10px] font-black mt-1 relative z-10">모두 보기</span>
            </button>
            
            {displayedMarkers.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300">
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
              setTimeout(() => setHighlightedPostId(null), 3000);
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