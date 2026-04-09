"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Navigation, RefreshCw, Search } from 'lucide-react';
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

const CATEGORIES = ['cafe', 'food', 'park', 'photo'];

const generateRandomPosts = (count: number, bounds?: any) => {
  const posts = [];
  const rows = Math.ceil(Math.sqrt(count));
  const cols = rows;

  const baseLat = bounds?.sw?.lat || 37.5465;
  const baseLng = bounds?.sw?.lng || 126.9580;
  const latStep = (bounds?.ne?.lat - bounds?.sw?.lat) / rows || 0.01;
  const lngStep = (bounds?.ne?.lng - bounds?.sw?.lng) / cols || 0.01;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (posts.length >= count) break;

      const lat = baseLat + (i * latStep) + (Math.random() * latStep);
      const lng = baseLng + (j * lngStep) + (Math.random() * lngStep);

      const isAd = Math.random() < 0.15;

      posts.push({
        id: Math.random(),
        isAd,
        user: { 
          name: isAd ? "Sponsored" : `traveler_${Math.floor(Math.random() * 1000)}`, 
          avatar: isAd ? "https://cdn-icons-png.flaticon.com/512/5455/5455873.png" : `https://i.pravatar.cc/150?u=${Math.random()}` 
        },
        content: isAd ? "지금 바로 확인해보세요! 특별한 혜택이 기다리고 있습니다." : `이곳에서의 멋진 추억! 정말 추천하는 장소입니다. #여행 #탐험 #추천`,
        location: isAd ? "광고" : ['서울', '부산', '제주', '강릉', '경주', '전주', '인천', '대구'][Math.floor(Math.random() * 8)],
        category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
        lat,
        lng,
        likes: Math.floor(Math.random() * 1000),
        image: `https://picsum.photos/seed/${Math.random()}/800/800`,
        isLiked: Math.random() > 0.5,
        createdAt: Date.now() - Math.random() * 12 * 60 * 60 * 1000
      });
    }
  }
  return posts;
};

const Index = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<any>>(new Set());
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isPlaceSearchOpen, setIsPlaceSearchOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState(12);
  
  const [posts, setPosts] = useState(() => generateRandomPosts(60));

  const visiblePosts = useMemo(() => {
    const now = Date.now();
    const timeThreshold = now - (timeRange * 60 * 60 * 1000);
    let filtered = posts.filter(post => post.createdAt >= timeThreshold);
    if (!mapBounds || !mapBounds.ne) return filtered.slice(0, 30);
    return filtered
      .filter(post => {
        return (
          post.lat <= mapBounds.ne.lat &&
          post.lat >= mapBounds.sw.lat &&
          post.lng <= mapBounds.ne.lng &&
          post.lng >= mapBounds.sw.lng
        );
      })
      .slice(0, 30);
  }, [mapBounds, posts, timeRange]);

  useEffect(() => {
    if (mapBounds && visiblePosts.length < 10 && !isRefreshing) {
      const newPosts = generateRandomPosts(20, mapBounds);
      setPosts(prev => [...prev, ...newPosts]);
    }
  }, [mapBounds, visiblePosts.length, isRefreshing]);

  const handlePostSelect = (post: any) => {
    setSelectedPost(post);
    setViewedPostIds(prev => new Set(prev).add(post.id));
  };

  const handleMapChange = useCallback(({ bounds }: any) => {
    setMapBounds(bounds);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const newPosts = generateRandomPosts(40, mapBounds);
      setPosts(prev => [...prev, ...newPosts]);
      setIsRefreshing(false);
      showSuccess('주변의 새로운 게시물을 불러왔습니다.');
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

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />

      <div className="absolute top-20 left-4 right-3 z-30 flex items-start gap-2 pointer-events-none">
        <div className={cn(
          "pointer-events-auto transition-all duration-500 ease-in-out",
          isTrendingExpanded ? "flex-1" : "w-[260px]"
        )}>
          <TrendingPosts 
            isExpanded={isTrendingExpanded} 
            onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)} 
            onPostClick={handlePostSelect}
          />
        </div>
        
        <AnimatePresence>
          {!isTrendingExpanded && (
            <motion.div 
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              className="pointer-events-auto"
            >
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-100 text-green-600 font-bold text-sm hover:bg-white active:scale-95 transition-all whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? '검색 중...' : '재검색'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TimeSlider value={timeRange} onChange={setTimeRange} />

      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <MapContainer 
          posts={visiblePosts} 
          viewedPostIds={viewedPostIds}
          onMarkerClick={handlePostSelect}
          onMapChange={handleMapChange}
          center={mapCenter}
        />
      </main>

      {/* UI 컨트롤 레이어 */}
      <div className="fixed bottom-[200px] left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="relative w-full h-full">
          {/* 장소 검색 버튼 (좌측) */}
          <motion.button
            onClick={() => setIsPlaceSearchOpen(true)}
            animate={{ opacity: isSheetOpen ? 0 : 1, y: isSheetOpen ? 20 : 0 }}
            className="pointer-events-auto absolute left-0 bottom-0 flex items-center gap-2 px-5 py-3 bg-white rounded-full shadow-xl border border-gray-100 text-gray-700 font-bold text-sm active:scale-95 transition-all"
          >
            <Search className="w-4 h-4 text-green-500" />
            장소 검색
          </motion.button>

          {/* 현재 위치 버튼 (우측 - 타임 슬라이더와 너비 맞춤) */}
          <motion.button 
            onClick={handleCurrentLocation}
            animate={{ opacity: isSheetOpen ? 0 : 1, y: isSheetOpen ? 20 : 0 }}
            className="pointer-events-auto absolute right-[-4px] bottom-0 w-10 h-10 bg-white rounded-xl shadow-xl flex items-center justify-center text-green-500 active:scale-90 transition-transform border border-gray-100"
          >
            <Navigation className="w-5 h-5 fill-current" />
          </motion.button>
        </div>
      </div>

      <motion.div 
        initial={false}
        animate={{ 
          y: isSheetOpen ? "10%" : "calc(100% - 180px)" 
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
                  <p className="text-sm text-gray-400">장소를 찾는 중...</p>
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
                  <p className="font-medium">이 지역에는 게시물이 없어요.</p>
                  <p className="text-xs mt-1">지도를 이동하거나 시간 범위를 늘려보세요!</p>
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