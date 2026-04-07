"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Navigation, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import BottomNav from '@/components/BottomNav';
import MapContainer from '@/components/MapContainer';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import { showSuccess } from '@/utils/toast';

const CATEGORIES = ['cafe', 'food', 'park', 'photo'];

const generateRandomPosts = (count: number, bounds?: any) => {
  return Array.from({ length: count }).map((_, i) => {
    let lat, lng;
    if (bounds && bounds.ne) {
      lat = bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat);
      lng = bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng);
    } else {
      lat = 37.5 + Math.random() * 0.1;
      lng = 126.9 + Math.random() * 0.1;
    }

    return {
      id: Math.random(),
      user: { 
        name: `traveler_${Math.floor(Math.random() * 1000)}`, 
        avatar: `https://i.pravatar.cc/150?u=${Math.random()}` 
      },
      content: `이곳에서의 멋진 추억! 정말 추천하는 장소입니다. #여행 #탐험 #추천`,
      location: ['서울', '부산', '제주', '강릉', '경주', '전주', '인천', '대구'][Math.floor(Math.random() * 8)],
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      lat,
      lng,
      likes: Math.floor(Math.random() * 1000),
      image: `https://picsum.photos/seed/${Math.random()}/800/800`,
      isLiked: Math.random() > 0.5
    };
  });
};

const Index = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<number>>(new Set());
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [posts, setPosts] = useState(() => generateRandomPosts(500));

  const visiblePosts = useMemo(() => {
    if (!mapBounds || !mapBounds.ne) return posts.slice(0, 20);
    
    return posts
      .filter(post => {
        return (
          post.lat <= mapBounds.ne.lat &&
          post.lat >= mapBounds.sw.lat &&
          post.lng <= mapBounds.ne.lng &&
          post.lng >= mapBounds.sw.lng
        );
      })
      .slice(0, 20);
  }, [mapBounds, posts]);

  useEffect(() => {
    if (mapBounds && visiblePosts.length < 10 && !isRefreshing) {
      const newPosts = generateRandomPosts(30, mapBounds);
      setPosts(prev => [...prev, ...newPosts]);
    }
  }, [mapBounds, visiblePosts.length, isRefreshing]);

  const handleMarkerClick = (post: any) => {
    setSelectedPost(post);
    setViewedPostIds(prev => new Set(prev).add(post.id));
  };

  const handleMapChange = useCallback(({ bounds }: any) => {
    setMapBounds(bounds);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const newPosts = generateRandomPosts(100, mapBounds);
      setPosts(prev => [...prev, ...newPosts]);
      setIsRefreshing(false);
      showSuccess('주변의 새로운 게시물을 불러왔습니다.');
    }, 600);
  };

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />

      {/* Refresh Button */}
      <div className="absolute top-20 right-4 z-[1000]">
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-100 text-green-600 font-bold text-sm hover:bg-white active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? '검색 중...' : '재검색'}
        </button>
      </div>

      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <MapContainer 
          posts={visiblePosts} 
          viewedPostIds={viewedPostIds}
          onMarkerClick={handleMarkerClick}
          onMapChange={handleMapChange}
        />
        <button className="absolute bottom-24 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-green-500 active:scale-90 transition-transform z-[1000] border border-gray-100">
          <Navigation className="w-6 h-6 fill-current" />
        </button>
      </main>

      <motion.div 
        initial={{ y: "75%" }}
        animate={{ y: isSheetOpen ? "10%" : "75%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 pointer-events-none"
      >
        <div className="absolute inset-x-0 bottom-0 h-full bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] pointer-events-auto flex flex-col">
          <div 
            className="w-full py-4 flex flex-col items-center cursor-pointer sticky top-0 bg-white/80 backdrop-blur-md z-10 rounded-t-[32px]"
            onClick={() => setIsSheetOpen(!isSheetOpen)}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
            <div className="flex items-center gap-1 text-gray-500">
              <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isSheetOpen ? 'rotate-180' : ''}`} />
              <span className="text-sm font-bold">주변 게시물 ({visiblePosts.length})</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {isRefreshing ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-gray-400">장소를 찾는 중...</p>
                </motion.div>
              ) : visiblePosts.length > 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-gray-50">
                  {visiblePosts.map(post => (
                    <div key={post.id} onClick={() => setViewedPostIds(prev => new Set(prev).add(post.id))}>
                      <PostItem {...post} />
                    </div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <p className="font-medium">이 지역에는 게시물이 없어요.</p>
                  <p className="text-xs mt-1">지도를 이동하면 새로운 장소가 나타납니다!</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <PostDetail post={selectedPost} isOpen={!!selectedPost} onClose={() => setSelectedPost(null)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Index;