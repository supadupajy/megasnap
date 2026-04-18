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

  // 카카오 서비스 초기화
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (isOpen && kakao?.maps?.services) {
      if (!searchService.current) searchService.current = new kakao.maps.services.Places();
      if (!geocoderService.current) geocoderService.current = new kakao.maps.services.Geocoder();
    }
  }, [isOpen]);

  const handleSearch = useCallback((keyword: string, pageNum: number = 1) => {
    if (!keyword.trim() || !searchService.current || !geocoderService.current) return;

    setIsLoading(true);
    const kakao = (window as any).kakao;

    // 주소 검색 (첫 페이지에서만 수행)
    const getAddressResults = (): Promise<Place[]> => {
      return new Promise((resolve) => {
        if (pageNum !== 1) return resolve([]);
        geocoderService.current.addressSearch(keyword, (data: any, status: any) => {
          if (status === kakao.maps.services.Status.OK) {
            const formatted = data.map((item: any, idx: number) => ({
              id: `addr-${idx}-${item.x}-${item.y}`,
              name: item.address_name,
              address: item.road_address?.address_name || item.address?.address_name || item.address_name,
              lat: parseFloat(item.y),
              lng: parseFloat(item.x),
              isAddress: true
            }));
            resolve(formatted);
          } else {
            resolve([]);
          }
        });
      });
    };

    // 장소 검색
    const getPlaceResults = (): Promise<{data: Place[], pagination: any}> => {
      return new Promise((resolve) => {
        searchService.current.keywordSearch(keyword, (data: any, status: any, paginationObj: any) => {
          if (status === kakao.maps.services.Status.OK) {
            const formatted = data.map((item: any) => ({
              id: item.id,
              name: item.place_name,
              address: item.road_address_name || item.address_name,
              lat: parseFloat(item.y),
              lng: parseFloat(item.x),
              isAddress: false
            }));
            resolve({ data: formatted, pagination: paginationObj });
          } else {
            resolve({ data: [], pagination: null });
          }
        }, { page: pageNum, size: 15, useMapBounds: false });
      });
    };

    Promise.all([getAddressResults(), getPlaceResults()]).then(([addrData, placeData]) => {
      const newItems = [...addrData, ...placeData.data];
      
      setResults(prev => {
        const combined = pageNum === 1 ? newItems : [...prev, ...newItems];
        // 중복 제거 (ID 기준)
        const seen = new Set();
        return combined.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      
      setPagination(placeData.pagination);
      setIsLoading(false);
    }).catch(err => {
      console.error("Search failed:", err);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch(query, 1);
      } else {
        setResults([]);
        setPagination(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  useEffect(() => {
    if (!pagination?.hasNextPage || isLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) pagination.nextPage();
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [pagination, isLoading]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh] flex flex-col outline-none bg-white rounded-t-[40px] z-[1001]">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        <div className="px-8 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="text-xl font-black text-gray-900">장소 및 주소 검색</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="w-5 h-5 text-gray-400" /></Button>
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
          </div>
          <ScrollArea className="flex-1 -mx-8 px-8">
            <div className="space-y-2 pb-10">
              {results.map((place) => (
                <button key={place.id} onClick={() => { onSelect(place); onClose(); }} className="w-full flex items-start gap-4 p-4 hover:bg-indigo-50/50 rounded-2xl transition-all text-left group active:scale-[0.98]">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-gray-100", place.isAddress ? "bg-indigo-600" : "bg-white")}>
                    <MapPin className={cn("w-6 h-6", place.isAddress ? "text-white" : "text-indigo-600")} />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-gray-900 truncate text-base">{place.name}</p>
                      {place.isAddress && <span className="bg-indigo-100 text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">Address</span>}
                    </div>
                    <p className="text-xs text-gray-400 font-bold truncate mt-1 uppercase tracking-tighter">{place.address}</p>
                  </div>
                </button>
              ))}
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isLoading && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PlaceSearch;