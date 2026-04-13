"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);

  useEffect(() => {
    // 초기 데이터 생성
    const initialPosts = createMockPosts(37.5665, 126.9780, 40);
    
    // HOT 탭에서 전달된 포스팅이 있다면 데이터 풀에 추가
    if (location.state?.post) {
      const incomingPost = location.state.post;
      setAllPosts([incomingPost, ...initialPosts]);
      setMapCenter({ lat: incomingPost.lat, lng: incomingPost.lng });
      // 약간의 지연 후 상세 보기 오픈 (지도 이동 애니메이션 고려)
      setTimeout(() => setSelectedPostId(incomingPost.id), 500);
    } else {
      setAllPosts(initialPosts);
      if (location.state?.center) {
        setMapCenter(location.state.center);
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      const visibleCount = allPosts.filter(post => 
        post.lat >= sw.lat && post.lat <= ne.lat &&
        post.lng >= sw.lng && post.lng <= ne.lng
      ).length;

      if (visibleCount < 15) {
        const centerLat = (ne.lat + sw.lat) / 2;
        const centerLng = (ne.lng + sw.lng) / 2;
        setAllPosts(prev => {
          const newPosts = createMockPosts(centerLat, centerLng, 15);
          const combined = [...prev, ...newPosts];
          return combined.length > 150 ? combined.slice(-150) : combined;
        });
      }
    }
  }, [mapData]);

  const filteredPosts = useMemo(() => {
    if (!mapData?.bounds) return [];
    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    
    const inView = allPosts.filter(post => {
      const isWithinBounds = post.lat >= sw.lat && post.lat <= ne.lat &&
                             post.lng >= sw.lng && post.lng <= ne.lng;
      const isWithinTime = (now - post.createdAt.getTime()) <= timeLimitMs;
      return isWithinBounds || post.id === selectedPostId; // 선택된 포스트는 항상 표시
    });

    const influencers = inView.filter(p => p.isInfluencer);
    const populars = inView.filter(p => p.borderType === 'popular' && !p.isInfluencer);
    const normals = inView.filter(p => !p.isInfluencer && p.borderType !== 'popular');

    const selectedInfluencer = influencers.slice(0, 1);
    const selectedPopulars = populars.slice(0, 3);
    const remainingCount = 26;
    const selectedNormals = normals.slice(0, remainingCount);

    let finalPosts = [...selectedInfluencer, ...selectedPopulars, ...selectedNormals];

    if (selectedPostId) {
      const isAlreadyIncluded = finalPosts.some(p => p.id === selectedPostId);
      if (!isAlreadyIncluded) {
        const selectedPost = allPosts.find(p => p.id === selectedPostId);
        if (selectedPost) finalPosts.push(selectedPost);
      }
    }

    return finalPosts;
  }, [allPosts, mapData, timeValue, selectedPostId]);

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
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      setTimeout(() => {
        setAllPosts(createMockPosts((ne.lat + sw.lat) / 2, (ne.lng + sw.lng) / 2, 40));
        setIsRefreshing(false);
      }, 600);
    }
  }, [mapData]);

  const handleTrendingPostClick = useCallback((post: Post) => {
    setMapCenter({ lat: post.lat, lng: post.lng });
    setIsTrendingExpanded(false);
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

  const handleCurrentLocation = () => {
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
  };

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

      <div className="absolute bottom-32 left-4 z-20">
        <button 
          onClick={handleCurrentLocation}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-700 shadow-lg active:scale-90 transition-all border border-gray-100"
        >
          <Navigation className="w-6 h-6 fill-gray-700" />
        </button>
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
          posts={detailPosts}
          initialIndex={0}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
          onViewPost={handleViewPost}
          onLikeToggle={handleLikeToggle}
        />
      )}
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Index;