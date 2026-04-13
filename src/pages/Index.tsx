"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TimeSlider from '@/components/TimeSlider';
import { RefreshCw, LayoutGrid } from 'lucide-react';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const Index = () => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);

  useEffect(() => {
    setAllPosts(createMockPosts(37.5665, 126.9780, 30));
  }, []);

  useEffect(() => {
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      const visibleCount = allPosts.filter(post => 
        post.lat >= sw.lat && post.lat <= ne.lat &&
        post.lng >= sw.lng && post.lng <= ne.lng
      ).length;

      if (visibleCount < 10) {
        const centerLat = (ne.lat + sw.lat) / 2;
        const centerLng = (ne.lng + sw.lng) / 2;
        setAllPosts(prev => [...prev, ...createMockPosts(centerLat, centerLng, 15)]);
      }
    }
  }, [mapData, allPosts.length]);

  const filteredPosts = useMemo(() => {
    if (!mapData?.bounds) return [];
    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    
    return allPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = (now - post.createdAt.getTime()) <= timeLimitMs;
      return (isWithinBounds && isWithinTime) || post.id === selectedPostId;
    });
  }, [allPosts, mapData, timeValue, selectedPostId]);

  const trendingPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 20)
      .map((post, index) => ({ ...post, rank: index + 1 }));
  }, [allPosts]);

  const selectedIndex = useMemo(() => 
    filteredPosts.findIndex(p => p.id === selectedPostId), 
  [selectedPostId, filteredPosts]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      setTimeout(() => {
        setAllPosts(createMockPosts((ne.lat + sw.lat) / 2, (ne.lng + sw.lng) / 2, 35));
        setIsRefreshing(false);
      }, 600);
    }
  }, [mapData]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
    setTimeout(() => setSelectedPostId(post.id), 800);
  }, []);

  // 무한 루프 방지를 위해 useCallback 사용
  const handleViewPost = useCallback((id: string) => {
    setViewedPostIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50">
      <Header />
      <main className="absolute inset-0 z-0">
        <MapContainer 
          posts={filteredPosts}
          viewedPostIds={viewedPostIds}
          onMarkerClick={(p) => setSelectedPostId(p.id)}
          onMapChange={setMapData}
          onMapWriteClick={() => setIsWriteOpen(true)}
          center={mapCenter}
        />
      </main>

      <div className="absolute top-24 left-0 right-0 px-4 z-10 flex items-start justify-between pointer-events-none">
        <div className="w-64 shrink-0 pointer-events-auto">
          <TrendingPosts 
            posts={trendingPosts}
            isExpanded={isTrendingExpanded}
            onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
            onPostClick={handleTrendingPostClick}
          />
        </div>
        <div className="flex flex-col items-end gap-2 pointer-events-auto shrink-0 w-[92px]">
          <button onClick={handleRefresh} disabled={isRefreshing} className="w-full bg-white/90 backdrop-blur-md h-[44px] rounded-full shadow-lg border border-gray-100 flex items-center justify-center gap-1.5 text-sm font-bold text-green-600 active:scale-95 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>재검색</span>
          </button>
          <div className="w-full bg-white/70 backdrop-blur-md py-1.5 rounded-full border border-gray-100/50 shadow-sm flex items-center justify-center">
            <p className="text-[10px] font-bold text-gray-500">현재 <span className="text-green-600">{filteredPosts.length}</span></p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-32 right-4 z-20">
        <button onClick={() => filteredPosts.length > 0 && setSelectedPostId(filteredPosts[0].id)} disabled={filteredPosts.length === 0} className="w-14 h-14 bg-blue-500 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg active:scale-90 transition-all disabled:opacity-50">
          <LayoutGrid className="w-6 h-6 stroke-[2.5px]" />
          <span className="text-[9px] font-black mt-1">모두 보기</span>
        </button>
      </div>

      <TimeSlider value={timeValue} onChange={setTimeValue} />
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />

      {selectedPostId && (
        <PostDetail 
          posts={filteredPosts}
          initialIndex={selectedIndex}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
          onViewPost={handleViewPost}
        />
      )}
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Index;