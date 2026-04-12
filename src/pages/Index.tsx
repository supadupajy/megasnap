"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import { RefreshCw } from 'lucide-react';

const generateMockPosts = () => {
  const posts = [];
  const contentPool = [
    "오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️",
    "여기 분위기 진짜 대박... 꼭 와보세요! ✨",
    "맛있는 점심 먹고 힐링 중입니다 🍱",
    "주말 여행지로 강력 추천합니다! 🚗",
    "야경이 정말 아름다운 곳이에요 🌙"
  ];

  for (let i = 0; i < 50; i++) {
    const isAd = Math.random() > 0.9;
    const lat = 37.5665 + (Math.random() - 0.5) * 0.05;
    const lng = 126.9780 + (Math.random() - 0.5) * 0.05;
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

  const specialCount = Math.floor(Math.random() * 2) + 1;
  const shuffled = [...posts].sort(() => 0.5 - Math.random());
  const selectedIds = new Set(shuffled.slice(0, specialCount).map(p => p.id));
  
  posts.forEach(p => {
    if (selectedIds.has(p.id)) {
      p.borderType = 'popular';
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

  // useCallback을 사용하여 마커 클릭 핸들러가 매번 생성되지 않도록 함
  // 이를 통해 MapContainer에서 마커가 불필요하게 다시 그려지는 것을 방지
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
    setTimeout(() => {
      setAllPosts(generateMockPosts());
      setIsRefreshing(false);
    }, 800);
  }, []);

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

      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10">
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2 text-sm font-bold text-gray-700 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          재검색
        </button>
      </div>

      <div className="absolute top-24 right-4 z-10 w-64">
        <TrendingPosts 
          posts={trendingPosts}
          isExpanded={isTrendingExpanded}
          onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
          onPostClick={(post) => {
            setSelectedPostId(post.id);
          }}
        />
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
