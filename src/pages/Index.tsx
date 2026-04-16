"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Navigation, RefreshCw, Search, LayoutGrid } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import BottomNav from '@/components/BottomNav';
import MapContainer from '@/components/MapContainer';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TrendingPosts from '@/components/TrendingPosts';
import PlaceSearch from '@/components/PlaceSearch';
import TimeSlider from '@/components/TimeSlider';
import { showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

const generateRandomPosts = (count: number, bounds: any) => {
  const posts = [];
  const contentPool = [
    "성수동 힙한 카페 발견! 분위기 너무 좋아요.",
    "제주도 숨은 명소 공유합니다. 꼭 가보세요!",
    "여기 진짜 인생 맛집이에요.. 웨이팅 필수!",
    "강릉 바다 보러 왔어요 🌊 힐링 그 자체",
    "서울 야경 명소 추천! 데이트 코스로 딱입니다.",
    "부산 광안리 드론쇼 직관 후기입니다.",
    "경주 황리단길 산책하기 좋은 날씨네요.",
    "전주 한옥마을 먹거리 투어 다녀왔어요.",
    "인천 송도 센트럴파크 피크닉 추천합니다.",
    "대구 수성못 야경이 정말 예쁘네요.",
  ];

  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const isAd = Math.random() < 0.1;
    const hoursAgo = Math.random() * 12;
    const createdAt = now - (hoursAgo * 60 * 60 * 1000);

    const lat = bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat);
    const lng = bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng);

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
      createdAt
    });
  }
  return posts;
};

const Index = () => {
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<any>>(new Set());
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isPlaceSearchOpen, setIsPlaceSearchOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState(12);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [posts, setPosts] = useState<any[]>([]);
  
  const globalPopularPosts = useMemo(() => {
    const dummyBounds = { sw: { lat: 33, lng: 124 }, ne: { lat: 38, lng: 130 } };
    return generateRandomPosts(20, dummyBounds)
      .sort((a, b) => b.likes - a.likes)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, []);

  useEffect(() => {
    if (!mapBounds) return;

    const updatePosts = () => {
      const visibleExistingPosts = posts.filter(post => 
        post.lat >= mapBounds.sw.lat && 
        post.lat <= mapBounds.ne.lat && 
        post.lng >= mapBounds.sw.lng && 
        post.lng <= mapBounds.ne.lng
      );

      const targetCount = Math.floor(Math.random() * 11) + 15;
      const neededCount = Math.max(0, targetCount - visibleExistingPosts.length);

      if (neededCount > 0) {
        const newPosts = generateRandomPosts(neededCount, mapBounds);
        const combinedPosts = [...visibleExistingPosts, ...newPosts]
          .sort((a, b) => b.likes - a.likes)
          .map((post, index) => ({ ...post, rank: index + 1 }));

        setPosts(combinedPosts);
      } else if (visibleExistingPosts.length > targetCount) {
        setPosts(visibleExistingPosts.slice(0, targetCount));
      } else {
        setPosts(visibleExistingPosts);
      }
    };

    const timer = setTimeout(updatePosts, 300);
    return () => clearTimeout(timer);
  }, [mapBounds]);

  const visiblePosts = useMemo(() => {
    const now = Date.now();
    const timeThreshold = now - (timeRange * 60 * 60 * 1000);
    return posts.filter(post => post.isAd || post.createdAt >= timeThreshold);
  }, [posts, timeRange]);

  const handlePostSelect = (post: any) => {
    setSelectedPost(post);
    setViewedPostIds(prev => new Set(prev).add(post.id));
  };

  const handleMapChange = useCallback(({ bounds }: any) => {
    setMapBounds(bounds);
  }, []);

  const handleRefresh = () => {
    if (!mapBounds) return;
    setIsRefreshing(true);
    setTimeout(() => {
      const targetCount = Math.floor(Math.random() * 11) + 15;
      const newPosts = generateRandomPosts(targetCount, mapBounds)
        .sort((a, b) => b.likes - a.likes)
        .map((p, i) => ({ ...p, rank: i + 1 }));
      setPosts(newPosts);
      setIsRefreshing(false);
      showSuccess('주변 게시물을 새로고침했습니다.');
    }, 600);
  };

  const handleCurrentLocation = () => {
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
    showSuccess('현재 위치로 이동합니다.');
  };

  const handlePlaceSelect = (place: any) => {
    setMapCenter({ lat: place.lat, lng: place.lng });
    showSuccess(`${place.name}(으)로 이동합니다.`);
  };

  const isAnyPopupOpen = isPlaceSearchOpen || isWriteOpen || !!selectedPost;

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />

      {/* Map Container - Full Screen */}
      <main className="absolute inset-0 z-0">
        <MapContainer 
          posts={visiblePosts} 
          viewedPostIds={viewedPostIds}
          onMarkerClick={handlePostSelect}
          onMapChange={handleMapChange}
          onMapWriteClick={() => setIsWriteOpen(true)}
          center={mapCenter}
        />
      </main>

      {/* UI Overlays */}
      <div className="absolute top-28 left-4 right-3 z-30 flex items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto w-[240px] shrink-0">
          <TrendingPosts 
            posts={globalPopularPosts} 
            isExpanded={isTrendingExpanded} 
            onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)} 
            onPostClick={handlePostSelect}
          />
        </div>
        
        <div className="pointer-events-auto">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-100 text-green-600 font-bold text-sm hover:bg-white active:scale-95 transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '교체 중...' : '재검색'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isAnyPopupOpen && !isSheetOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="z-30"
          >
            <TimeSlider value={timeRange} onChange={setTimeRange} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-[200px] left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="relative w-full h-full">
          <motion.button
            onClick={() => setIsPlaceSearchOpen(true)}
            animate={{ opacity: isSheetOpen ? 0 : 1, y: isSheetOpen ? 20 : 0 }}
            className="pointer-events-auto absolute left-0 bottom-0 h-10 px-3 bg-white rounded-xl shadow-xl flex items-center gap-2 text-gray-700 active:scale-90 transition-transform border border-gray-100"
          >
            <Search className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">장소 검색</span>
          </motion.button>

          <motion.button 
            onClick={handleCurrentLocation}
            animate={{ opacity: isSheetOpen ? 0 : 1, y: isSheetOpen ? 20 : 0 }}
            className="pointer-events-auto absolute right-[-4px] bottom-0 w-10 h-10 bg-white rounded-xl shadow-xl flex items-center justify-center text-green-500 active:scale-90 transition-transform border border-gray-100"
          >
            <Navigation className="w-5 h-5 fill-current" />
          </motion.button>
        </div>
      </div>

      {/* View All Button with Special Effects */}
      <div className="fixed bottom-[100px] right-4 z-50 pointer-events-none">
        <motion.div
          animate={{ opacity: isSheetOpen ? 0 : 1, scale: isSheetOpen ? 0.8 : 1 }}
          className="pointer-events-auto relative"
        >
          <button 
            onClick={() => setIsSheetOpen(true)}
            className={cn(
              "w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 group overflow-hidden animate-view-all-glow shine-overlay"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <LayoutGrid className="w-7 h-7 stroke-[3px] relative z-10" />
            <span className="text-[10px] font-black mt-1 relative z-10">모두 보기</span>
          </button>
          
          {visiblePosts.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-bounce">
              {visiblePosts.length}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div 
        initial={false}
        animate={{ 
          y: isSheetOpen ? "110px" : "calc(100% - 180px)" 
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 pointer-events-none"
      >
        <div className="absolute inset-x-0 bottom-0 h-full bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] pointer-events-auto flex flex-col">
          <div 
            className="w-full pt-4 pb-6 flex flex-col items-center cursor-pointer sticky top-0 bg-white z-10 rounded-t-[32px] border-b border-gray-50"
            onClick={() => setIsSheetOpen(!isSheetOpen)}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
            <div className="flex items-center gap-1 text-gray-500">
              <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isSheetOpen ? 'rotate-180' : ''}`} />
              <span className="text-sm font-bold">주변 게시물 ({visiblePosts.length})</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-40">
            <AnimatePresence mode="wait">
              {isRefreshing ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-gray-400">새로운 장소를 찾는 중...</p>
                </motion.div>
              ) : visiblePosts.length > 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-gray-50">
                  {visiblePosts.map(post => (
                    <div key={post.id} onClick={() => handlePostSelect(post)}>
                      <PostItem {...post} />
                    </div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <p className="font-medium">게시물이 없습니다.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <PostDetail post={selectedPost} isOpen={!!selectedPost} onClose={() => setSelectedPost(null)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <PlaceSearch 
        isOpen={isPlaceSearchOpen} 
        onClose={() => setIsPlaceSearchOpen(false)} 
        onSelect={handlePlaceSelect} 
      />
    </div>
  );
};

export default Index;