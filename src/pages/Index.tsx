"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import { RefreshCw } from 'lucide-react';

const generateMockPosts = (centerLat = 37.5665, centerLng = 126.9780) => {
  const posts = [];
  const contentPool = [
    "오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️",
    "여기 분위기 진짜 대박... 꼭 와보세요! ✨",
    "맛있는 점심 먹고 힐링 중입니다 🍱",
    "주말 여행지로 강력 추천합니다! 🚗",
    "야경이 정말 아름다운 곳이에요 🌙"
  ];

  for (let i = 0; i < 20; i++) {
    const isAd = Math.random() > 0.9;
    // 중심 좌표 기준으로 랜덤하게 생성
    const lat = centerLat + (Math.random() - 0.5) * 0.03;
    const lng = centerLng + (Math.random() - 0.5) * 0.03;
    const createdAt = new Date(Date.now() - Math.random() * 10000000000);
    
    posts.push({
      id: Math.random().toString(36).substr(2, 9),
      rank: 0,
      isAd,
      user: { 
        name: isAd ? "Sponsored" : `traveler_${Math.floor(Math.random() * 1000)}`, 
        avatar: `https://i.pravatar.cc/150?u=${Math.random()}` 
      },
      content: contentPool[Math.floor(Math.random() * contentPool.length)],
      location: ['서울', '부산', '제주', '강릉', '경주'][Math.floor(Math.random() * 5)],
      lat,
      lng,
      likes: Math.floor(Math.random() * 1000),
      image: `https://picsum.photos/seed/${Math.random()}/800/800`,
      isLiked: Math.random() > 0.5,
      createdAt,
      borderType: 'none'
    });
  }

  // 인기 포스팅을 리스트 전체에 골고루 분포 (약 5개마다 하나씩)
  posts.forEach((p, i) => {
    if (i % 5 === 0) {
      p.borderType = 'popular';
      p.likes += 1000;
    }
  });

  return posts;
};

const Index = () => {
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setAllPosts(generateMockPosts());
  }, []);

  const filteredPosts = useMemo(() => {
    if (!mapData?.bounds) return [];
    const { sw, ne } = mapData.bounds;
    
    // 현재 지도 영역에 있는 포스팅만 필터링
    return allPosts.filter(post => 
      post.lat >= sw.lat && post.lat <= ne.lat &&
      post.lng >= sw.lng && post.lng <= ne.lng
    );
  }, [allPosts, mapData]);

  const trendingPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => b.likes - a.likes)
      .map((post, index) => ({ ...post, rank: index + 1 }));
  }, [allPosts]);

  const selectedIndex = useMemo(() => {
    if (!selectedPostId) return -1;
    return filteredPosts.findIndex(p => p.id === selectedPostId);
  }, [selectedPostId, filteredPosts]);

  const handleMarkerClick = useCallback((post: any) => {
    setSelectedPostId(post.id);
    setViewedPostIds(prev => {
      if (prev.has(post.id)) return prev;
      const next = new Set(prev);
      next.add(post.id);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    
    // 현재 지도의 중심 좌표를 가져옴
    let centerLat = 37.5665;
    let centerLng = 126.9780;
    
    if (mapData?.bounds) {
      centerLat = (mapData.bounds.ne.lat + mapData.bounds.sw.lat) / 2;
      centerLng = (mapData.bounds.ne.lng + mapData.bounds.sw.lng) / 2;
    }

    setTimeout(() => {
      // 현재 중심 좌표 기준으로 새로운 포스팅 생성
      setAllPosts(generateMockPosts(centerLat, centerLng));
      setIsRefreshing(false);
    }, 800);
  }, [mapData]);

  const handleCloseDetail = useCallback(() => {
    setSelectedPostId(null);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50">
      <Header />
      
      <main className="absolute inset-0 z-0">
        <MapContainer 
          posts={filteredPosts}
          viewedPostIds={viewedPostIds}
          onMarkerClick={handleMarkerClick}
          onMapChange={setMapData}
          onMapWriteClick={() => setIsWriteOpen(true)}
        />
      </main>

      {/* UI Overlays Container */}
      <div className="absolute top-24 left-0 right-0 px-4 z-10 flex items-start justify-between pointer-events-none">
        {/* Trending Posts - Left Side */}
        <div className="w-64 pointer-events-auto">
          <TrendingPosts 
            posts={trendingPosts}
            isExpanded={isTrendingExpanded}
            onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
            onPostClick={(post) => {
              setSelectedPostId(post.id);
            }}
          />
        </div>

        {/* Refresh Button - Right Side */}
        <div className="pointer-events-auto">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-white/90 backdrop-blur-md h-[44px] px-6 rounded-full shadow-lg border border-gray-100 flex items-center gap-2 text-sm font-bold text-green-600 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            재검색
          </button>
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />

      {selectedPostId && (
        <PostDetail 
          posts={filteredPosts}
          initialIndex={selectedIndex}
          isOpen={true} 
          onClose={handleCloseDetail} 
        />
      )}

      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Index;
