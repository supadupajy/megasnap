"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
}

const PlaceSearch = ({ isOpen, onClose, onSelect }: PlaceSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<any>(null);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchService = useRef<any>(null);
  const geocoderService = useRef<any>(null);
  const isSearching = useRef(false);

  // 카카오 서비스 초기화
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (isOpen && kakao?.maps?.services) {
      if (!searchService.current) searchService.current = new kakao.maps.services.Places();
      if (!geocoderService.current) geocoderService.current = new kakao.maps.services.Geocoder();
    }
  }, [isOpen]);

  // 통합 검색 처리 함수
  const executeSearch = useCallback((keyword: string, isNextPage: boolean = false) => {
    if (!keyword.trim() || !searchService.current || !geocoderService.current || isSearching.current) return;

    isSearching.current = true;
    setIsLoading(true);
    const kakao = (window as any).kakao;

    // 장소 검색 콜백
    const placesCallback = (data: any, status: any, paginationObj: any) => {
      let placeResults: Place[] = [];
      if (status === kakao.maps.services.Status.OK) {
        placeResults = data.map((item: any) => ({
          id: item.id,
          name: item.place_name,
          address: item.road_address_name || item.address_name,
          lat: parseFloat(item.y),
          lng: parseFloat(item.x),
          isAddress: false
        }));
      }

      if (isNextPage) {
        setResults(prev => [...prev, ...placeResults]);
      } else {
        // 첫 페이지인 경우 주소 검색도 병행
        geocoderService.current.addressSearch(keyword, (addrData: any, addrStatus: any) => {
          let addrResults: Place[] = [];
          if (addrStatus === kakao.maps.services.Status.OK) {
            addrResults = addrData.map((item: any, idx: number) => ({
              id: `addr-${idx}-${item.x}-${item.y}`,
              name: item.address_name,
              address: item.road_address?.address_name || item.address?.address_name || item.address_name,
              lat: parseFloat(item.y),
              lng: parseFloat(item.x),
              isAddress: true
            }));
          }
          
          // 주소 결과를 상단에 배치
          const combined = [...addrResults, ...placeResults];
          // 중복 제거
          const seen = new Set();
          const unique = combined.filter(item => {
            const key = `${item.lat.toFixed(6)},${item.lng.toFixed(6)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          
          setResults(unique);
        });
      }

      setPagination(paginationObj);
      setIsLoading(false);
      isSearching.current = false;
    };

    if (isNextPage && pagination) {
      pagination.nextPage();
    } else {
      searchService.current.keywordSearch(keyword, placesCallback, { size: 15 });
    }
  }, [pagination]);

  // 입력값 변경 시 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        executeSearch(query, false);
      } else {
        setResults([]);
        setPagination(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  // 무한 스크롤 감지
  useEffect(() => {
    if (!pagination?.hasNextPage || isLoading) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isSearching.current) {
        executeSearch(query, true);
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [pagination, isLoading, query, executeSearch]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh] flex flex-col outline-none bg-white rounded-t-[40px] z-[1001]">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        
        <div className="px-8 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="text-xl font-black text-gray-900">장소 및 주소 검색</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          <div className="relative mb-6 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="장소명 또는 주소를 입력하세요 (예: 상일동)" 
              className="pl-12 h-14 bg-gray-50 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-indigo-600 text-base font-bold shadow-inner"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {isLoading && results.length === 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 -mx-8 px-8">
            <div className="space-y-2 pb-10">
              {results.map((place) => (
                <button 
                  key={place.id} 
                  onClick={() => { onSelect(place); onClose(); }} 
                  className="w-full flex items-start gap-4 p-4 hover:bg-indigo-50/50 rounded-2xl transition-all text-left group active:scale-[0.98]"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-gray-100", 
                    place.isAddress ? "bg-indigo-600" : "bg-white"
                  )}>
                    <MapPin className={cn("w-6 h-6", place.isAddress ? "text-white" : "text-indigo-600")} />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-gray-900 truncate text-base">{place.name}</p>
                      {place.isAddress && (
                        <span className="bg-indigo-100 text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">Address</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-bold truncate mt-1 uppercase tracking-tighter">{place.address}</p>
                  </div>
                </button>
              ))}
              
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isLoading && results.length > 0 && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
              </div>

              {!isLoading && query.trim() && results.length === 0 && (
                <div className="py-20 text-center text-gray-400 font-bold">검색 결과가 없습니다.</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PlaceSearch;