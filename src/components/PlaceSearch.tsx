"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
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

  // 카카오 검색 서비스 초기화
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (isOpen && kakao && kakao.maps && kakao.maps.services) {
      // 장소 및 주소 검색을 위한 Places 서비스 초기화
      searchService.current = new kakao.maps.services.Places();
    }
  }, [isOpen]);

  // 검색 실행 함수
  const performSearch = useCallback((keyword: string, pageNum: number = 1) => {
    if (!keyword.trim() || !searchService.current) {
      setResults([]);
      setPagination(null);
      return;
    }

    setIsLoading(true);
    const kakao = (window as any).kakao;

    try {
      // keywordSearch는 장소명, 주소, 카테고리 등 통합 검색을 지원합니다.
      searchService.current.keywordSearch(keyword, (data: any, status: any, paginationObj: any) => {
        if (status === kakao.maps.services.Status.OK) {
          const formatted = data.map((item: any) => ({
            id: item.id,
            name: item.place_name, // 장소명 또는 주소명
            address: item.road_address_name || item.address_name, // 상세 주소
            lat: parseFloat(item.y),
            lng: parseFloat(item.x)
          }));

          if (pageNum === 1) {
            setResults(formatted);
          } else {
            setResults(prev => [...prev, ...formatted]);
          }
          setPagination(paginationObj);
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          if (pageNum === 1) setResults([]);
          setPagination(null);
        }
        setIsLoading(false);
      }, { 
        page: pageNum, 
        size: 10,
        // 특정 지역에 국한되지 않고 전국을 대상으로 검색하도록 설정
        useMapBounds: false 
      });
    } catch (error) {
      console.error("Search error:", error);
      setIsLoading(false);
    }
  }, []);

  // 입력값 변경 시 디바운스 적용
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query, 1);
      } else {
        setResults([]);
        setPagination(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // 무한 스크롤 감지
  useEffect(() => {
    if (!pagination || !pagination.hasNextPage || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          pagination.nextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [pagination, isLoading]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh] flex flex-col outline-none bg-white rounded-t-[40px] z-[1001]">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        
        <div className="px-8 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="text-xl font-black text-gray-900">장소 및 주소 검색</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
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
              {results.length > 0 ? (
                <>
                  {results.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => {
                        onSelect(place);
                        onClose();
                      }}
                      className="w-full flex items-start gap-4 p-4 hover:bg-indigo-50/50 rounded-2xl transition-all text-left group active:scale-[0.98]"
                    >
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-gray-100 group-hover:border-indigo-200 transition-colors">
                        <MapPin className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="font-black text-gray-900 truncate text-base">{place.name}</p>
                        <p className="text-xs text-gray-400 font-bold truncate mt-1 uppercase tracking-tighter">{place.address}</p>
                      </div>
                    </button>
                  ))}
                  
                  {/* 무한 스크롤 트리거 */}
                  <div ref={loadMoreRef} className="py-8 flex justify-center">
                    {pagination?.hasNextPage && (
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin opacity-50" />
                    )}
                  </div>
                </>
              ) : (
                !isLoading && query.trim() && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-sm text-gray-400 font-bold">검색 결과가 없습니다.</p>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PlaceSearch;