"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, Navigation } from 'lucide-react';
import Header from '@/components/Header';
import PostItem from '@/components/PostItem';
import BottomNav from '@/components/BottomNav';
import GoogleMapContainer from '@/components/GoogleMapContainer';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import CategoryFilter from '@/components/CategoryFilter';

const CATEGORIES = ['cafe', 'food', 'park', 'photo'];

const MASTER_POSTS = Array.from({ length: 50 }).map((_, i) => ({
  id: i + 1,
  user: { 
    name: `traveler_${i + 1}`, 
    avatar: `https://i.pravatar.cc/150?u=${i}` 
  },
  content: `${i + 1}번째 장소에서의 멋진 추억! 여기 정말 추천해요. #여행 #서울 #추천`,
  location: ['강남역', '홍대입구', '이태원', '성수동', '여의도', '잠실', '북촌', '익선동'][i % 8],
  category: CATEGORIES[i % CATEGORIES.length],
  lat: 37.5665 + (Math.random() - 0.5) * 0.15,
  lng: 126.9780 + (Math.random() - 0.5) * 0.2,
  likes: Math.floor(Math.random() * 1000),
  image: `https://picsum.photos/seed/${i + 200}/800/800`,
  isLiked: Math.random() > 0.5
}));

const Index = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const visiblePosts = useMemo(() => {
    let filtered = MASTER_POSTS;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (!mapBounds) return filtered.slice(0, 20);

    return filtered.filter(post => {
      return (
        post.lat <= mapBounds.ne.lat &&
        post.lat >= mapBounds.sw.lat &&
        post.lng <= mapBounds.ne.lng &&
        post.lng >= mapBounds.sw.lng
      );
    });
  }, [mapBounds, selectedCategory]);

  const handleMapChange = useCallback(({ bounds }: any) => {
    setMapBounds(bounds);
  }, []);

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />
      
      <CategoryFilter 
        selectedId={selectedCategory} 
        onSelect={setSelectedCategory} 
      />

      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <GoogleMapContainer 
          posts={visiblePosts} 
          onMarkerClick={(post) => setSelectedPost(post)}
          onMapChange={handleMapChange}
        />
        
        {/* My Location Button */}
        <button className="absolute bottom-24 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-green-500 active:scale-90 transition-transform z-20 border border-gray-100">
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
            {visiblePosts.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {visiblePosts.map(post => (
                  <PostItem key={post.id} {...post} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="font-medium">해당 카테고리의 게시물이 없어요.</p>
                <p className="text-xs mt-1">다른 카테고리를 선택하거나 지도를 이동해보세요!</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />

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