"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import BottomNav from '@/components/BottomNav';
import GoogleMapContainer from '@/components/GoogleMapContainer';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';

// 서울 주요 지역을 중심으로 30개의 랜덤 게시물 생성
const MASTER_POSTS = Array.from({ length: 30 }).map((_, i) => ({
  id: i + 1,
  user: { 
    name: `사용자${i + 1}`, 
    avatar: `https://i.pravatar.cc/150?u=${i}` 
  },
  content: `${i + 1}번째 장소에서의 멋진 추억! 여기 정말 추천해요. #여행 #서울 #추천`,
  location: ['강남역', '홍대입구', '이태원', '성수동', '여의도', '잠실', '북촌', '익선동'][i % 8],
  lat: 37.5665 + (Math.random() - 0.5) * 0.15, // 서울 중심 기준 랜덤 분포
  lng: 126.9780 + (Math.random() - 0.5) * 0.2,
  likes: Math.floor(Math.random() * 1000),
  image: `https://picsum.photos/seed/${i + 100}/800/800`,
  isLiked: Math.random() > 0.5
}));

const Index = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);

  // 현재 지도 범위 내에 있는 게시물만 필터링
  const visiblePosts = useMemo(() => {
    if (!mapBounds) return MASTER_POSTS.slice(0, 20); // 초기 로딩 시 20개 노출

    return MASTER_POSTS.filter(post => {
      const { nw, se } = mapBounds;
      // nw: north-west (top-left), se: south-east (bottom-right)
      // google-map-react의 bounds 구조에 맞춰 체크
      return (
        post.lat <= mapBounds.ne.lat &&
        post.lat >= mapBounds.sw.lat &&
        post.lng <= mapBounds.ne.lng &&
        post.lng >= mapBounds.sw.lng
      );
    });
  }, [mapBounds]);

  const handleMapChange = useCallback(({ bounds }: any) => {
    setMapBounds(bounds);
  }, []);

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />

      {/* Map Area */}
      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <GoogleMapContainer 
          posts={visiblePosts} 
          onMarkerClick={(post) => setSelectedPost(post)}
          onMapChange={handleMapChange}
        />
      </main>

      {/* Bottom Sheet */}
      <motion.div 
        initial={{ y: "75%" }}
        animate={{ y: isSheetOpen ? "15%" : "75%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 pointer-events-none"
      >
        <div className="absolute inset-x-0 bottom-0 h-full bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pointer-events-auto flex flex-col">
          <div 
            className="w-full py-4 flex flex-col items-center cursor-pointer"
            onClick={() => setIsSheetOpen(!isSheetOpen)}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
            <div className="flex items-center gap-1 text-gray-500">
              <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isSheetOpen ? 'rotate-180' : ''}`} />
              <span className="text-sm font-medium">주변 게시물 ({visiblePosts.length})</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-40">
            {visiblePosts.length > 0 ? (
              visiblePosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPost(post)} className="cursor-pointer">
                  <PostItem {...post} />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p>이 지역에는 게시물이 없어요.</p>
                <p className="text-xs">지도를 다른 곳으로 이동해 보세요!</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />

      {/* Modals/Drawers */}
      <PostDetail 
        post={selectedPost} 
        isOpen={!!selectedPost} 
        onClose={() => setSelectedPost(null)} 
      />
      <WritePost 
        isOpen={isWriteOpen} 
        onClose={() => setIsWriteOpen(false)} 
      />
    </div>
  );
};

export default Index;