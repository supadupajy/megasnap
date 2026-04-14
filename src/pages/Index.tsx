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
import { mapCache } from '@/utils/map-cache';
import { motion } from 'framer-motion';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [allPosts, setAllPosts] = useState<Post[]>(mapCache.posts);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  
  const { viewedIds, markAsViewed } = useViewedPosts();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const TILE_SIZE = 0.02;

  useEffect(() => {
    mapCache.posts = allPosts;
  }, [allPosts]);

  useEffect(() => {
    if (mapCenter) {
      mapCache.lastCenter = mapCenter;
    }
  }, [mapCenter]);

  const trendingPosts = useMemo(() => {
    return allPosts
      .filter(p => !p.isAd)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 20)
      .map((p, index) => ({ ...p, rank: index + 1 }));
  }, [allPosts]);

  useEffect(() => {
    if (location.state?.post) {
      const incomingPost = location.state.post;
      setAllPosts(prev => {
        if (prev.some(p => p.id === incomingPost.id)) return prev;
        return [incomingPost, ...prev];
      });
      setMapCenter({ lat: incomingPost.lat, lng: incomingPost.lng });
      setHighlightedPostId(incomingPost.id);
      const timer = setTimeout(() => setHighlightedPostId(null), 3500);
      return () => clearTimeout(timer);
    } else if (location.state?.center) {
      setMapCenter(location.state.center);
    }
  }, [location.state]);

  useEffect(() => {
    if (mapData?.bounds) {
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
            const tilePosts = createMockPosts(tileCenterLat, tileCenterLng, 8);
            newPosts.push(...tilePosts);
          }
        }
      }

      if (tilesAdded) {
        setAllPosts(prev => [...prev, ...newPosts]);
      }
    }
  }, [mapData]);

  const filteredPosts = useMemo(() => {
    if (!mapData?.bounds) return [];
    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    
    const inBoundsPosts = allPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = post.isAd || (now - post.createdAt.getTime()) <= timeLimitMs;
      const isWithinCategory = selectedCategory === 'all' || post.category === selectedCategory;
      return isWithinBounds && isWithinTime && isWithinCategory;
    });

    if (inBoundsPosts.length === 0) return [];

    const ROWS = 6;
    const COLS = 5;
    const latStep = (ne.lat - sw.lat) / ROWS;
    const lngStep = (ne.lng - sw.lng) / COLS;

    const grid = new Map<string, Post>();

    inBoundsPosts.forEach(post => {
      const row = Math.min(Math.floor((post.lat - sw.lat) / latStep), ROWS - 1);
      const col = Math.min(Math.floor((post.lng - sw.lng) / lngStep), COLS - 1);
      const key = `${row}-${col}`;

      const existing = grid.get(key);
      if (!existing) {
        grid.set(key, post);
      } else {
        const getScore = (p: Post) => {
          let score = p.likes;
          if (p.isInfluencer) score += 1000000;
          if (p.borderType === 'popular') score += 500000;
          if (p.isAd) score += 100000;
          return score;
        };

        if (getScore(post) > getScore(existing)) {
          grid.set(key, post);
        }
      }
    });

    return Array.from(grid.values());
  }, [allPosts, mapData, timeValue, selectedCategory]);

  const handleLikeToggle = useCallback((postId: string) => {
    setAllPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    mapCache.populatedTiles.clear();
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      setTimeout(() => {
        const centerLat = (ne.lat + sw.lat) / 2;
        const centerLng = (ne.lng + sw.lng) / 2;
        const refreshedPosts = createMockPosts(centerLat, centerLng, 60);
        setAllPosts(refreshedPosts);
        setIsRefreshing(false);
      }, 600);
    }
  }, [mapData]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
    setHighlightedPostId(post.id);
    setTimeout(() => setHighlightedPostId(null), 3500);
  }, []);

  const handleCurrentLocation = () => {
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
  };

  const handlePlaceSelect = (place: any) => {
    setMapCenter({ lat: place.lat, lng: place.lng });
  };

  const handleViewAllClick = () => {
    if (filteredPosts.length > 0) {
      navigate('/post-list', { 
        state: { 
          posts: filteredPosts,
          center: mapCenter || { lat: 37.5665, lng: 126.9780 }
        } 
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-screen overflow-hidden bg-gray-50"
    >
      <div className="absolute inset-0 z-0">
        <MapContainer 
          posts={filteredPosts}
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
          <div className="w-64 shrink-0 pointer-events-auto">
            <TrendingPosts 
              posts={trendingPosts}
              isExpanded={isTrendingExpanded}
              onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
              onPostClick={handleTrendingPostClick}
            />
          </div>
          <div className="flex flex-col items-end gap-2 pointer-events-auto shrink-0 w-[92px]">
            <button onClick={handleRefresh} disabled={isRefreshing} className="w-full bg-white/90 backdrop-blur-md h-[44px] rounded-full shadow-lg border border-gray-100 flex items-center justify-center gap-1.5 text-sm font-bold text-indigo-600 active:scale-90 transition-all">
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
              <span>재검색</span>
            </button>
            <div className="w-full bg-white/70 backdrop-blur-md py-1.5 rounded-full border border-gray-100/50 shadow-sm flex items-center justify-center">
              <p className="text-[10px] font-bold text-gray-500">현재 <span className="text-indigo-600">{filteredPosts.length}</span></p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-32 left-4 z-20 flex flex-col gap-2">
          <button 
            onClick={() => setIsCategoryOpen(true)}
            className={cn(
              "w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500",
              selectedCategory !== 'all' && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600"
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

        <div className="absolute bottom-32 right-4 z-20">
          <button 
            onClick={handleViewAllClick} 
            disabled={filteredPosts.length === 0} 
            className="w-14 h-14 bg-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg active:scale-90 transition-all disabled:opacity-50"
          >
            <LayoutGrid className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-black mt-1">모두 보기</span>
          </button>
        </div>

        <TimeSlider value={timeValue} onChange={setTimeValue} />
      </div>

      <CategoryMenu 
        isOpen={isCategoryOpen}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
        onClose={() => setIsCategoryOpen(false)}
      />

      {selectedPostId && (
        <PostDetail 
          posts={filteredPosts} 
          initialIndex={filteredPosts.findIndex(p => p.id === selectedPostId)}
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
        onPostCreated={(newPost) => setAllPosts(prev => [newPost, ...prev])}
      />
    </motion.div>
  );
};

export default Index;