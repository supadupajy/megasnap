import { useState, useMemo, useCallback, useEffect } from 'react';
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

/* -------------------------------------------------------------------------- */
/* Helper – pick a random subset (max 40) from an array                        */
/* -------------------------------------------------------------------------- */
const getRandomSubset = <T,>(arr: T[], max = 40): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(max, shuffled.length));
};

/* -------------------------------------------------------------------------- */
/* Generate random posts (used for map & trending)                            */
/* -------------------------------------------------------------------------- */
const generateRandomPosts = (count: number, bounds?: any) => {
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
  const locationPool = [
    "성수동", "제주도", "강남", "강릉", "남산",
    "광안리", "황리단길", "한옥마을", "송도", "수성못",
    "서울", "부산", "제주", "인천", "대구",
  ];

  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const isAd = Math.random() < 0.15;
    const hoursAgo = Math.random() * 12;
    const createdAt = now - hoursAgo * 60 * 60 * 1000;

    const lat = bounds?.sw?.lat
      ? bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat)
      : 37.5465 + Math.random() * 0.02;
    const lng = bounds?.sw?.lng
      ? bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng)
      : 126.9580 + Math.random() * 0.02;

    const content = contentPool[Math.floor(Math.random() * contentPool.length)];
    const location = locationPool[Math.floor(Math.random() * locationPool.length)];
    const image = `https://picsum.photos/seed/${Math.random()}/800/800`;

    posts.push({
      id: Math.random(),
      isAd,
      user: {
        name: isAd ? "Sponsored" : `traveler_${Math.floor(Math.random() * 1000)}`,
        avatar: isAd
          ? "https://cdn-icons-png.flaticon.com/512/5455/5455873.png"
          : `https://i.pravatar.cc/150?u=${Math.random()}`,
      },
      content,
      location,
      lat,
      lng,
      likes: Math.floor(Math.random() * 1000),
      image,
      isLiked: Math.random() > 0.5,
      createdAt,
    });
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

  /* ---------------------------------------------------------------------- */
  /* Main post pool (used for map)                                          */
  /* ---------------------------------------------------------------------- */
  const [posts, setPosts] = useState(() => generateRandomPosts(100));

  /* ---------------------------------------------------------------------- */
  /* Trending thumbnails – a separate slice limited to 40 random items        */
  /* ---------------------------------------------------------------------- */
  const [trendingPosts, setTrendingPosts] = useState<Post[]>(() =>
    getRandomSubset(posts, 40)
  );

  const postsInBounds = useMemo(() => {
    if (!mapBounds || !mapBounds.ne) return posts.slice(0, 50);
    return posts.filter(post => {
      return (
        post.lat <= mapBounds.ne.lat &&
        post.lat >= mapBounds.sw.lat &&
        post.lng <= mapBounds.ne.lng &&
        post.lng >= mapBounds.sw.lng
      );
    });
  }, [mapBounds, posts]);

  const visiblePosts = useMemo(() => {
    const now = Date.now();
    const timeThreshold = now - timeRange * 60 * 60 * 1000;
    return postsInBounds.filter(post => post.createdAt >= timeThreshold);
  }, [postsInBounds, timeRange]);

  useEffect(() => {
    if (mapBounds && postsInBounds.length < 15 && !isRefreshing) {
      const newPosts = generateRandomPosts(30, mapBounds);
      setPosts(prev => [...prev, ...newPosts]);
    }
  }, [mapBounds, postsInBounds.length, isRefreshing]);

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
      // Generate a fresh pool of posts and then pick a new random subset (max 40)
      const freshPosts = generateRandomPosts(100, mapBounds);
      setPosts(freshPosts);
      setTrendingPosts(getRandomSubset(freshPosts, 40));
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

  const isAnyPopupOpen = isPlaceSearchOpen || isWriteOpen || !!selectedPost || isSheetOpen;

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <Header />

      {/* Trending list – now receives the dynamic `trendingPosts` */}
      <div className="absolute top-28 left-4 right-3 z-30 flex items-start gap-2 pointer-events-none">
        <div className={cn(
          "pointer-events-auto transition-all duration-500 ease-in-out",
          isTrendingExpanded ? "flex-1" : "w-[260px]"
        )}>
          <TrendingPosts
            posts={trendingPosts}
            isExpanded={isTrendingExpanded}
            onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)}
            onPostClick={handlePostSelect}
          />
        </div>

        {/* Refresh button stays visible – no longer hidden when expanded */}
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
      </div>

      {/* Time slider – unchanged */}
      <AnimatePresence>
        {!isAnyPopupOpen && (
          <motion.div            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <TimeSlider value={timeRange} onChange={setTimeRange} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map & other UI – unchanged */}
      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <MapContainer          posts={visiblePosts}
          viewedPostIds={viewedPostIds}
          onMarkerClick={handlePostSelect}
          onMapChange={handleMapChange}
          onMapWriteClick={() => setIsWriteOpen(true)}
          center={mapCenter}
        />
      </main>

      {/* Bottom controls – unchanged */}
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

      {/* Sheet, modals, etc. – unchanged */}
      <motion.div
        initial={false}
        animate={{ y: isSheetOpen ? "10%" : "calc(100% - 180px)" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 pointer-events-none"
      >
        {/* ... sheet content ... */}
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