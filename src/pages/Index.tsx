"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import { RefreshCw } from 'lucide-react';

// 포스팅 생성 함수를 컴포넌트 외부로 분리하여 일관성 유지
const createMockPosts = (centerLat: number, centerLng: number, count: number = 15) => {
  const contentPool = [
    "오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️",
    "여기 분위기 진짜 대박... 꼭 와보세요! ✨",
    "맛있는 점심 먹고 힐링 중입니다 🍱",
    "주말 여행지로 강력 추천합니다! 🚗",
    "야경이 정말 아름다운 곳이에요 🌙",
    "숨겨진 명소를 찾았습니다! 📍",
    "인생샷 건지기 딱 좋은 곳 📸"
  ];

  return Array.from({ length: count }).map((_, i) => {
    const isAd = Math.random() > 0.92;
    // 중심 좌표 주변으로 랜덤하게 배치 (약 2-3km 반경)
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    
    const post = {
      id: Math.random().toString(36).substr(2, 9),
      rank: 0,
      isAd,
      user: { 
        name: isAd ? "Sponsored" : `traveler_${Math.floor(Math.random() * 1000)}`, 
        avatar: `https://i.pravatar.cc/150?u=${Math.random()}` 
      },
      content: contentPool[Math.floor(Math.random() * contentPool.length)],
      location: ['서울', '부산', '제주', '강릉', '경주', '성수', '홍대'][Math.floor(Math.random() * 7)],
      lat,
      lng,
      likes: Math.floor(Math.random() * 2000),
      image: `https://picsum.photos/seed/${Math.random()}/800/800`,
      isLiked: Math.random() > 0.5,
      createdAt: new Date(),
      borderType: Math.random() > 0.8 ? 'popular' : 'none' as any
    };

    if (post.borderType === 'popular') post.likes += 2000;
    return post;
  });
};

const Index = () => {
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 초기 데이터 생성
  useEffect(() => {
    setAllPosts(createMockPosts(37.5665, 126.9780, 20));
  }, []);

  // 지도가 이동하여 멈출 때마다 실행되는 자동 생성 로직
  useEffect(() => {
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      const centerLat = (ne.lat + sw.lat) / 2;
      const centerLng = (ne.lng + sw.lng) / 2;

      // 현재 화면에 보이는 포스팅 개수 확인
      const visibleCount = allPosts.filter(post => 
        post.lat >= sw.lat && post.lat <= ne.lat &&
        post.lng >= sw.lng && post.lng <= ne.lng
      ).length;

      // 화면에 마커가 부족하면 자동으로 추가 생성
      if (visibleCount < 8) {
        const newPosts = createMockPosts(centerLat, centerLng, 12);
        setAllPosts(prev => [...prev, ...newPosts]);
      }
    }
  }, [mapData]);

  // 현재 지도 영역에 있는 포스팅만 필터링하여 MapContainer에 전달
  const filteredPosts = useMemo(() => {
    if (!mapData?.bounds) return [];
    const { sw, ne } = mapData.bounds;
    
    return allPosts.filter(post => 
      post.lat >= sw.lat && post.lat <= ne.lat &&
      post.lng >= sw.lng && post.lng <= ne.lng
    );
  }, [allPosts, mapData]);

  const trendingPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 20)
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
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      const centerLat = (ne.lat + sw.lat) / 2;
      const centerLng = (ne.lng + sw.lng) / 2;
      
      setTimeout(() => {
        // 현재 위치 기반으로 완전히 새로운 데이터셋으로 교체
        setAllPosts(createMockPosts(centerLat, centerLng, 25));
        setIsRefreshing(false);
      }, 600);
    }
  }, [mapData]);

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

      <div className="absolute top-24 left-0 right-0 px-4 z-10 flex items-start justify-between pointer-events-none">
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

        <div className="pointer-events-auto">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-white/90 backdrop-blur-md h-[44px] px-6 rounded-full shadow-lg border border-gray-100 flex items-center gap-2 text-sm font-bold text-green-600 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">재검색</span>
          </button>
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />

      {selectedPostId && (
        <PostDetail 
          posts={filteredPosts}
          initialIndex={selectedIndex}
          isOpen={true} 
          onClose={() => setSelectedPostId(null)} 
        />
      )}

      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Index;