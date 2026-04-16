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
  const [isPostListOpen, setIsPostListOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const TILE_SIZE = 0.02;
  const MAX_MARKERS = 50; 

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
    if (location.state?.filterUserId) {
      const userId = location.state.filterUserId;
      const finalUserId = userId === 'me' ? 'Dyad_Explorer' : userId;
      setTargetUserId(finalUserId);
      setSelectedCategories([userId === 'me' ? 'mine' : 'user_filter']);
      
      const currentCenter = mapCenter || { lat: 37.5665, lng: 126.9780 };
      setMapCenter(currentCenter);
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

    const inBoundsCandidates = updatedAllPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
      
      const isMe = post.user.id === 'me' || post.user.id === 'Dyad_Explorer';
      const isTargetUser = post.user.id === targetUserId || 
                          (targetUserId === 'Dyad_Explorer' && post.user.id === 'me');

      let matchesCategory = false;
      if (selectedCategories.includes('mine')) {
        matchesCategory = isMe;
      } else if (selectedCategories.includes('user_filter')) {
        matchesCategory = isTargetUser;
      } else if (selectedCategories.includes('all')) {
        matchesCategory = true;
      } else {
        matchesCategory = selectedCategories.includes(post.category || 'none') ||
                          (selectedCategories.includes('hot') && post.borderType === 'popular') ||
                          (selectedCategories.includes('influencer') && post.isInfluencer);
      }

      const isNotBlocked = !blockedIds.has(post.user.id);
      return isWithinBounds && isWithinTime && matchesCategory && isNotBlocked;
    });

    const currentlyDisplayedIds = new Set(displayedMarkers.map(m => m.id));
    const stickyMarkers = inBoundsCandidates.filter(m => currentlyDisplayedIds.has(m.id));
    
    const newCandidates = inBoundsCandidates.filter(m => !currentlyDisplayedIds.has(m.id));
    const sortedNewCandidates = newCandidates.sort((a, b) => {
      const scoreA = (a.isInfluencer ? 1000 : 0) + (a.borderType === 'popular' ? 500 : 0) + a.likes;
      const scoreB = (b.isInfluencer ? 1000 : 0) + (b.borderType === 'popular' ? 500 : 0) + b.likes;
      return scoreB - scoreA;
    });

    const combined = [...stickyMarkers, ...sortedNewCandidates].slice(0, MAX_MARKERS);
    
    const nextIds = combined.map(m => m.id).sort().join(',');
    const prevIds = displayedMarkers.map(m => m.id).sort().join(',');
    
    if (nextIds !== prevIds) {
      setDisplayedMarkers(combined);
    }
  }, [mapData, timeValue, selectedCategories, allPosts, blockedIds, targetUserId]);

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
      setIsPostListOpen(true);
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
            onMapChange={setMapData}
            onMapWriteClick={(loc) => {
              setPendingLocation(loc);
              setIsWriteOpen(true);
            }} 
            center={mapCenter}
          />

          {/* Trending Posts Backdrop */}
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
              <motion.div 
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.4, 0.2, 0.4]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute inset-0 bg-indigo-400 rounded-[24px] blur-xl"
              />

              <button 
                onClick={handleViewAllClick} 
                disabled={displayedMarkers.length === 0} 
                className={cn(
                  "w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white active:scale-95 transition-all disabled:opacity-50 border-2 border-white/20 group overflow-hidden relative z-10 shadow-[0_15px_30px_rgba(79,70,229,0.4)]"
                )}
              >
                <motion.div 
                  animate={{ 
                    scale: [1, 1.08, 1]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                }}
                className="absolute inset-0 bg-indigo-600 z-0"
              />

              <motion.div 
                animate={{ 
                  left: ["-100%", "200%"] 
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "linear",
                  repeatDelay: 1
                }}
                className="absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-25deg] z-20"
              />
              
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
              
              <div className="relative z-30 flex flex-col items-center justify-center">
                <LayoutGrid className="w-7 h-7 stroke-[3px]" />
                <span className="text-[10px] font-black mt-1">모두 보기</span>
              </div>
            </button>
            
            {displayedMarkers.length > 0 && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg z-40"
              >
                {displayedMarkers.length}
              </motion.div>
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
    </motion.div>

    {/* Overlays outside motion.div to avoid fixed positioning bugs on mobile */}
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
    <PostListOverlay 
      isOpen={isPostListOpen}
      onClose={() => setIsPostListOpen(false)}
      initialPosts={displayedMarkers}
      mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
    />
  </>
  );
};

export default Index;