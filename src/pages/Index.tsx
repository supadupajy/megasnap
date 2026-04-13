"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MapContainer from '@/components/MapContainer';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TimeSlider from '@/components/TimeSlider';
import { RefreshCw, LayoutGrid, Navigation, Copy, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { createMockPosts } from '@/lib/mock-data';
import { Post } from '@/types';
import { showSuccess } from '@/utils/toast';

const Index = () => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(12);

  // 브라우저가 네이버 서버로 보내는 실제 Referer 주소입니다.
  const currentOrigin = window.location.origin;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentOrigin);
    showSuccess("정확한 주소가 복사되었습니다!");
  };

  useEffect(() => {
    setAllPosts(createMockPosts(37.5665, 126.9780, 40));
  }, []);

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
      return isWithinBounds && isWithinTime;
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
      {/* 네이버 인증 실패 해결 가이드 */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-slate-900 text-white py-3 px-4 shadow-2xl border-b border-white/10">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold">인증 실패 해결 (최종 확인)</span>
            </div>
            <button onClick={copyToClipboard} className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1 rounded-full text-[10px] font-black active:scale-95 transition-all">
              <Copy className="w-3 h-3" /> 주소 복사
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</div>
              <p className="text-[10px] leading-tight text-slate-300">
                네이버 콘솔 <b>[서비스 선택]</b> 탭에서 <b>Web Dynamic Map</b>이 체크되어 있는지 확인 (가장 흔한 실수)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</div>
              <p className="text-[10px] leading-tight text-slate-300">
                <b>[서비스 URL]</b>에 아래 주소를 <b>정확히</b> 입력 (끝에 슬래시 없이)
              </p>
            </div>
          </div>

          <div className="bg-white/10 p-2 rounded-lg font-mono text-[11px] break-all border border-white/10 text-center font-bold text-blue-300 select-all">
            {currentOrigin}
          </div>

          <div className="flex items-center justify-between mt-1">
            <a 
              href="https://console.ncloud.com/naver-service/application" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white transition-colors"
            >
              네이버 콘솔 바로가기 <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <div className="flex items-center gap-1 text-[9px] text-green-400">
              <ShieldCheck className="w-3 h-3" />
              <span>Client ID: ipu2vry3sw</span>
            </div>
          </div>
        </div>
      </div>

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

      <div className="absolute top-48 left-0 right-0 px-4 z-10 flex items-start justify-between pointer-events-none">
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