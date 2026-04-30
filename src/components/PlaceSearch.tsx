"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboard } from '@/hooks/use-keyboard';

interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isAddress?: boolean;
}

interface PlaceSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (place: Place) => void;
  mapCenter?: { lat: number; lng: number };
}

const PlaceSearch = ({ isOpen, onClose, onSelect, mapCenter }: PlaceSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<any>(null);
  const { keyboardHeight, isKeyboardOpen } = useKeyboard();
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchService = useRef<any>(null);
  const geocoderService = useRef<any>(null);
  const isSearching = useRef(false);
  const lastQuery = useRef('');

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (isOpen && kakao?.maps?.services) {
      if (!searchService.current) searchService.current = new kakao.maps.services.Places();
      if (!geocoderService.current) geocoderService.current = new kakao.maps.services.Geocoder();
    }
  }, [isOpen]);

  const performSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim() || !searchService.current || !geocoderService.current) return;
    if (isSearching.current) return;

    isSearching.current = true;
    setIsLoading(true);
    const kakao = (window as any).kakao;

    try {
      const addressPromise = new Promise<Place[]>((resolve) => {
        geocoderService.current.addressSearch(keyword, (data: any, status: any) => {
          if (status === kakao.maps.services.Status.OK) {
            resolve(data.map((item: any, idx: number) => ({
              id: `addr-${idx}-${item.x}-${item.y}`,
              name: item.address_name,
              address: item.road_address?.address_name || item.address?.address_name || item.address_name,
              lat: parseFloat(item.y),
              lng: parseFloat(item.x),
              isAddress: true
            })));
          } else {
            resolve([]);
          }
        });
      });

      // 현재 지도 중심 좌표 기반 검색 옵션
      const searchOptions: any = { size: 15 };
      if (mapCenter) {
        // location: 검색 기준 좌표 (이 좌표 근처 결과를 우선 반환)
        searchOptions.location = new kakao.maps.LatLng(mapCenter.lat, mapCenter.lng);
        // sort: DISTANCE 정렬로 가까운 순서로 반환
        searchOptions.sort = kakao.maps.services.SortBy.DISTANCE;
      }

      const placesPromise = new Promise<{data: Place[], pagination: any}>((resolve) => {
        searchService.current.keywordSearch(keyword, (data: any, status: any, paginationObj: any) => {
          if (status === kakao.maps.services.Status.OK) {
            resolve({
              data: data.map((item: any) => ({
                id: item.id,
                name: item.place_name,
                address: item.road_address_name || item.address_name,
                lat: parseFloat(item.y),
                lng: parseFloat(item.x),
                isAddress: false
              })),
              pagination: paginationObj
            });
          } else {
            resolve({ data: [], pagination: null });
          }
        }, searchOptions);
      });

      const [addrResults, placeData] = await Promise.all([addressPromise, placesPromise]);
      
      // 주소 검색 결과와 장소 검색 결과 합치기
      // mapCenter가 있으면 거리 기준으로 정렬
      const combined = [...addrResults, ...placeData.data];
      const seen = new Set();
      const unique = combined.filter(item => {
        const key = `${item.lat.toFixed(6)},${item.lng.toFixed(6)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // mapCenter가 있으면 거리 기준으로 재정렬 (장소 검색은 이미 DISTANCE 정렬이지만
      // 주소 검색 결과와 합쳐진 후 다시 정렬)
      if (mapCenter) {
        unique.sort((a, b) => {
          const distA = Math.pow(a.lat - mapCenter.lat, 2) + Math.pow(a.lng - mapCenter.lng, 2);
          const distB = Math.pow(b.lat - mapCenter.lat, 2) + Math.pow(b.lng - mapCenter.lng, 2);
          return distA - distB;
        });
      }

      setResults(unique);
      setPagination(placeData.pagination);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
      isSearching.current = false;
    }
  }, [mapCenter]);

  const loadNextPage = useCallback(() => {
    if (!pagination?.hasNextPage || isSearching.current) return;
    
    isSearching.current = true;
    setIsLoading(true);

    const kakao = (window as any).kakao;
    const searchOptions: any = { page: pagination.current + 1, size: 15 };
    if (mapCenter) {
      searchOptions.location = new kakao.maps.LatLng(mapCenter.lat, mapCenter.lng);
      searchOptions.sort = kakao.maps.services.SortBy.DISTANCE;
    }

    searchService.current.keywordSearch(query, (data: any, status: any, paginationObj: any) => {
      if (status === kakao.maps.services.Status.OK) {
        const newPlaces = data.map((item: any) => ({
          id: item.id,
          name: item.place_name,
          address: item.road_address_name || item.address_name,
          lat: parseFloat(item.y),
          lng: parseFloat(item.x),
          isAddress: false
        }));

        setResults(prev => {
          const combined = [...prev, ...newPlaces];
          const seen = new Set();
          return combined.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
        setPagination(paginationObj);
      }
      setIsLoading(false);
      isSearching.current = false;
    }, searchOptions);
  }, [pagination, query, mapCenter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() && query !== lastQuery.current) {
        lastQuery.current = query;
        performSearch(query);
      } else if (!query.trim()) {
        setResults([]);
        setPagination(null);
        lastQuery.current = '';
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  useEffect(() => {
    if (!pagination?.hasNextPage || isLoading) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loadNextPage();
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [pagination, isLoading, loadNextPage]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{
            duration: 0.2,
            ease: "easeOut"
          }}
          className="fixed inset-0 z-[40] bg-white flex flex-col overflow-hidden"
          style={{ 
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 74px)',
            paddingBottom: isKeyboardOpen 
              ? `${keyboardHeight}px` 
              : 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
            touchAction: 'auto'
          }}
        >
          {/* Header */}
          <div className="py-3 px-4 flex items-center gap-3 border-b border-gray-100 bg-white shrink-0">
            <button 
              onClick={onClose}
              className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="장소명 또는 주소 검색"
                className="pl-9 h-11 bg-white border-2 border-indigo-600 rounded-xl outline-none font-bold placeholder:text-gray-400 shadow-sm transition-all focus-visible:ring-0 focus-visible:ring-offset-0"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* 현재 지도 위치 기준 안내 */}
          {mapCenter && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 shrink-0">
              <p className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                현재 지도 위치 기준으로 가까운 순서로 표시됩니다
              </p>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
            <div className="p-4 space-y-1">
              {results.map((place) => (
                <button 
                  key={place.id} 
                  onClick={() => { onSelect(place); onClose(); }} 
                  className="w-full flex items-start gap-4 p-4 hover:bg-indigo-50/50 rounded-2xl transition-all text-left group active:scale-[0.98]"
                >
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-gray-100", 
                    place.isAddress ? "bg-indigo-600" : "bg-white"
                  )}>
                    <MapPin className={cn("w-5 h-5", place.isAddress ? "text-white" : "text-indigo-600")} />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-gray-900 truncate text-base">{place.name}</p>
                      {place.isAddress && (
                        <span className="bg-indigo-100 text-indigo-600 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">Address</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-bold truncate mt-0.5 uppercase tracking-tighter">{place.address}</p>
                  </div>
                </button>
              ))}
              
              {pagination?.hasNextPage && (
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                </div>
              )}

              {!isLoading && query.trim() && results.length === 0 && (
                <div className="py-20 text-center text-gray-400 font-bold">검색 결과가 없습니다.</div>
              )}
              
              {!query.trim() && (
                <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400 font-bold leading-relaxed">
                    궁금한 장소나 주소를 입력하여<br/>지도를 탐험해보세요!
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlaceSearch;
