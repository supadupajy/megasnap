"use client";

import React, { useState, useMemo } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Search, MapPin, X } from 'lucide-react';
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

const MOCK_PLACES: Place[] = [
  { id: '1', name: '성수동 카페거리', address: '서울특별시 성동구 성수동', lat: 37.5445, lng: 127.0560 },
  { id: '2', name: '경복궁', address: '서울특별시 종로구 사직로 161', lat: 37.5796, lng: 126.9770 },
  { id: '3', name: '해운대 해수욕장', address: '부산광역시 해운대구 우동', lat: 35.1587, lng: 129.1603 },
  { id: '4', name: '제주 국제공항', address: '제주특별자치도 제주시 공항로 2', lat: 33.5113, lng: 126.4930 },
  { id: '5', name: '남산서울타워', address: '서울특별시 용산구 남산공원길 105', lat: 37.5512, lng: 126.9882 },
  { id: '6', name: '강릉 안목해변', address: '강원도 강릉시 창해로 14번길', lat: 37.7718, lng: 128.9485 },
  { id: '7', name: '여의도 한강공원', address: '서울특별시 영등포구 여의동로 330', lat: 37.5284, lng: 126.9341 },
  { id: '8', name: '광안대교', address: '부산광역시 수영구 남천동', lat: 35.1478, lng: 129.1301 },
];

interface PlaceSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (place: Place) => void;
}

const PlaceSearch = ({ isOpen, onClose, onSelect }: PlaceSearchProps) => {
  const [query, setQuery] = useState('');

  const filteredPlaces = useMemo(() => {
    if (!query.trim()) return MOCK_PLACES;
    return MOCK_PLACES.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) || 
      p.address.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[92dvh] flex flex-col outline-none">
        {/* Handle Bar */}
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        
        <div className="px-6 flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="text-xl font-bold text-gray-900">장소 검색</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative mb-6 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="장소, 주소 검색" 
              className="pl-12 h-14 bg-gray-50 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-green-500 text-base shadow-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Results List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 pb-10">
              {filteredPlaces.length > 0 ? (
                filteredPlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => {
                      onSelect(place);
                      onClose();
                    }}
                    className="w-full flex items-start gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                      <MapPin className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="font-bold text-gray-900 truncate text-base">{place.name}</p>
                      <p className="text-sm text-gray-500 truncate mt-1">{place.address}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <p className="font-medium">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PlaceSearch;