"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TimeSlider from '@/components/TimeSlider';
import { RefreshCw, LayoutGrid, Navigation } from 'lucide-react';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';

const Index = () => {
  const location = useLocation();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);

  // 이미 포스팅이 생성된 타일(격자)을 추적
  const populatedTiles = useRef<Set<string>>(new Set());
  const TILE_SIZE = 0.02; // 약 2km 단위의 그리드

  // 초기 데이터 설정 및 외부 페이지(인기 탭 등)에서 넘어온 위치 처리
  useEffect(() => {
    if (location.state?.post) {
      const incomingPost = location.state.post;
      // 기존 포스트 목록에 추가 (중복 방지)
      setAllPosts(prev => {
        if (prev.some(p => p.id === incomingPost.id)) return prev;
        return [incomingPost, ...prev];
      });
      setMapCenter({ lat: incomingPost.lat, lng: incomingPost.lng });
      
      // 하이라이트 효과 적용
      setHighlightedPostId(incomingPost.id);
      const timer = setTimeout(() => setHighlightedPostId(null), 3500);
      return () => clearTimeout(timer);
    } else if (location.state?.center) {
      setMapCenter(location.state.center);
    } else {
      setMapCenter({ lat: 37.5665, lng: 126.9780 });
    }
  }, [location.state]);

  // 지도 이동에 따른 그리드 기반 포스팅 생성
  useEffect(() => {
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      const centerLat = (ne.lat + sw.lat) / 2;
      const centerLng = (ne.lng + sw.lng) / 2;
      
      const startLat = Math.floor((sw.lat - TILE_SIZE) / TILE_SIZE);
      const endLat = Math.ceil((ne.lat + TILE_SIZE) / TILE_SIZE);
      const startLng = Math.floor((sw.lng - TILE_SIZE) / TILE_SIZE);
      const endLng = Math.ceil((ne.lng + TILE_SIZE) / TILE_SIZE);

      const newPosts: Post[] = [];
      let tilesAdded = false;

      for (let latIdx = startLat; latIdx <= endLat; latIdx++) {
        for (let lngIdx = startLng; lngIdx <= endLng; lngIdx++) {
          const tileKey = `${latIdx},${lngIdx}`;
          if (!populatedTiles.current.has(tileKey)) {
            populatedTiles.current.add(tileKey);
            tilesAdded = true;
            
            const tileCenterLat = (latIdx + 0.5) * TILE_SIZE;
            const tileCenterLng = (lngIdx + 0.5) * TILE_SIZE;
            const tilePosts = createMockPosts(tileCenterLat, tileCenterLng, 6);
            newPosts.push(...tilePosts);
          }
        }
      }

      if (tilesAdded || allPosts.length > 600) {
        setAllPosts(prev => {
          const combined = [...prev, ...newPosts];
          if (combined.length > 600) {
            return combined.filter(post => {
              const distLat = Math.abs(post.lat - centerLat);
              const distLng = Math.abs(post.lng - centerLng);
              return distLat < 0.1 && distLng < 0.1;
            });
          }
          return combined;
        });
      }
    }
  }, [mapData]);

  const filteredPosts = useMemo(() => {
    if (!mapData?.bounds) return [];
    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    
    return allPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = (now - post.createdAt.getTime()) <= timeLimitMs;
      // 하이라이트 중이거나 선택된 포스트는 필터와 상관없이 유지
      return (isWithinBounds && isWithinTime) || post.id === selectedPostId || post.id === highlightedPostId;
    });
  }, [allPosts, mapData, timeValue, selectedPostId, highlightedPostId]);

  const detailPosts = useMemo(() => {
    if (!selectedPostId) return filteredPosts;
    const selected = filteredPosts.find(p => p.id === selectedPostId);
    const others = filteredPosts.filter(p => p.id !== selectedPostId);
    return selected ? [selected, ...others] : filteredPosts;
  }, [filteredPosts, selectedPostId]);

  const trendingPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 20)
      .map((post, index) => ({ ...post, rank: index + 1 }));
  }, [allPosts]);

  const handleLikeToggle = useCallback((postId: string) => {
    setAllPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likes: isLiked ? post.likes + 1 : post.likes - 1
        };
      }
      return post;
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    populatedTiles.current.clear();
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      setTimeout(() => {
        const centerLat = (ne.lat + sw.lat) / 2;
        const centerLng = (ne.lng + sw.lng) / 2;
        setAllPosts(createMockPosts(centerLat, centerLng, 50));
        setIsRefreshing(false);
      }, 600);
    }
  }, [mapData]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
    
    setHighlightedPostId(post.id);
    setTimeout(() => setHighlightedPostId(null), 3500);
    
    setTimeout(() => setSelectedPostId(post.id), 800);
  }, []);

  const handleViewPost = useCallback((id: string) => {
    setViewedPostIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handlePostCreated = useCallback((newPost: Post) => {
    setAllPosts(prev => [newPost, ...prev]);
    setMapCenter({ lat: newPost.lat, lng: newPost.lng });
    setTimeout(() => setSelectedPostId(newPost.id), 1000);
  }, []);

  const handleCurrentLocation = () => {
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
  };

  const handleMapWriteClick = (location?: { lat: number; lng: number }) => {
    setPendingLocation(location);
    setIsWriteOpen(true);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50">
      <Header />
      <main className="absolute inset-0 z-0">
        <MapContainer 
          posts={filteredPosts}
          viewedPostIds={viewedPostIds}
          highlightedPostId={highlightedPostId}
          onMarkerClick={(p) => setSelectedPostId(p.id)}
          onMapChange={setMapData}
          onMapWriteClick={handleMapWriteClick}
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
          <button onClick={handleRefresh} disabled={isRefreshing} className="w-full bg-white/90 backdrop-blur-md h-[44px] rounded-full shadow-lg border border-gray-100 flex items-center justify-center gap-1.5 text-sm font-bold text-indigo-600 active:scale-95 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>재검색</span>
          </button>
          <div className="w-full bg-white/70 backdrop-blur-md py-1.5 rounded-full border border-gray-100/50 shadow-sm flex items-center justify-center">
            <p className="text-[10px] font-bold text-gray-500">현재 <span className="text-indigo-600">{filteredPosts.length}</span></p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-32 left-4 z-20">
        <button 
          onClick={handleCurrentLocation}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-700 shadow-lg active:scale-90 transition-all border border-gray-100"
        >
          <Navigation className="w-6 h-6 fill-gray-700" />
        </button>
      </div>

      <div className="absolute bottom-32 right-4 z-20">
        <button onClick={() => filteredPosts.length > 0 && setSelectedPostId(filteredPosts[0].id)} disabled={filteredPosts.length === 0} className="w-14 h-14 bg-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg active:scale-90 transition-all disabled:opacity-50">
          <LayoutGrid className="w-6 h-6 stroke-[2.5px]" />
          <span className="text-[9px] font-black mt-1">모두 보기</span>
        </button>
      </div>

      <TimeSlider value={timeValue} onChange={setTimeValue} />
      <BottomNav onWriteClick={() => {
        setPendingLocation(undefined);
        setIsWriteOpen(true);
      }} />

      {selectedPostId && (
        <PostDetail 
          posts={detailPosts}
          initialIndex={0}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
          onViewPost={handleViewPost}
          onLikeToggle={handleLikeToggle}
          onLocationClick={(lat, lng) => {
            // 현재 지도에 있는 포스트 중 해당 좌표를 가진 포스트 찾기
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
      <WritePost 
        isOpen={isWriteOpen} 
        onClose={() => {
          setIsWriteOpen(false);
          setPendingLocation(undefined);
        }} 
        onPostCreated={handlePostCreated}
        initialLocation={pendingLocation}
      />
    </div>
  );
};

export default Index;