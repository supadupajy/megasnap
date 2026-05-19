"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search as SearchIcon, X, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadKakaoMapsSdk } from '@/utils/kakao-maps';
import { normalizeLocationName } from '@/utils/location-format';

interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isAddress?: boolean;
}

// 열기 이벤트 detail로 onSelect 콜백 전달
// (지도가 결과를 받아 처리해야 하므로 이벤트 기반으로 콜백을 넘김)
interface OpenPlaceSearchDetail {
  onSelect?: (place: Place) => void;
}

const PlaceSearchOverlay = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<any>(null);

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);

  const closeTimeoutRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchService = useRef<any>(null);
  const geocoderService = useRef<any>(null);
  const isSearching = useRef(false);
  const lastQuery = useRef('');
  const onSelectRef = useRef<((place: Place) => void) | null>(null);

  const handleAreaRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const dragOffsetYRef = useRef(0);
  const isSwipeDraggingRef = useRef(false);
  const swipeGestureRef = useRef<{
    active: boolean;
    source: 'handle' | 'scroll';
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    axis: 'pending' | 'vertical' | 'horizontal';
  } | null>(null);

  // open/close 이벤트
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenPlaceSearchDetail>).detail || {};
      onSelectRef.current = detail.onSelect || null;
      (window as any).__isPlaceSearchOpen = true;
      setIsOpen(true);
    };
    const handleClose = () => {
      (window as any).__isPlaceSearchOpen = false;
      setIsOpen(false);
    };
    window.addEventListener('open-place-search', handleOpen);
    window.addEventListener('close-place-search', handleClose);
    window.addEventListener('close-place-search-by-back', handleClose);
    return () => {
      window.removeEventListener('open-place-search', handleOpen);
      window.removeEventListener('close-place-search', handleClose);
      window.removeEventListener('close-place-search-by-back', handleClose);
    };
  }, []);

  const syncDragOffsetY = (next: number) => {
    dragOffsetYRef.current = next;
    setDragOffsetY(next);
  };

  const syncSwipeDragging = (next: boolean) => {
    isSwipeDraggingRef.current = next;
    setIsSwipeDragging(next);
  };

  const resetSwipeGesture = () => {
    swipeGestureRef.current = null;
    syncSwipeDragging(false);
  };

  // mount/unmount 애니메이션
  useEffect(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      syncSwipeDragging(false);
      syncDragOffsetY(0);
      swipeGestureRef.current = null;
      return;
    }
    if (shouldRender) {
      setIsClosing(true);
      syncSwipeDragging(false);
      swipeGestureRef.current = null;
      closeTimeoutRef.current = window.setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setQuery('');
        setResults([]);
        setPagination(null);
        lastQuery.current = '';
        syncDragOffsetY(0);
        closeTimeoutRef.current = null;
      }, 220);
    }
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, shouldRender]);

  // 카카오 SDK 로드
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    loadKakaoMapsSdk()
      .then(() => {
        if (cancelled) return;
        const kakao = (window as any).kakao;
        if (kakao?.maps?.services) {
          if (!searchService.current) searchService.current = new kakao.maps.services.Places();
          if (!geocoderService.current) geocoderService.current = new kakao.maps.services.Geocoder();
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  const performSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return;
    if (isSearching.current) return;

    isSearching.current = true;
    setIsLoading(true);

    try {
      if (!searchService.current || !geocoderService.current) {
        await loadKakaoMapsSdk();
        const loadedKakao = (window as any).kakao;
        if (!loadedKakao?.maps?.services) return;
        searchService.current = new loadedKakao.maps.services.Places();
        geocoderService.current = new loadedKakao.maps.services.Geocoder();
      }

      const kakao = (window as any).kakao;
      const addressPromise = new Promise<Place[]>((resolve) => {
        geocoderService.current.addressSearch(keyword, (data: any, status: any) => {
          if (status === kakao.maps.services.Status.OK) {
            resolve(data.map((item: any, idx: number) => ({
              id: `addr-${idx}-${item.x}-${item.y}`,
              name: normalizeLocationName(item.address_name),
              address: normalizeLocationName(item.road_address?.address_name || item.address?.address_name || item.address_name),
              lat: parseFloat(item.y),
              lng: parseFloat(item.x),
              isAddress: true
            })));
          } else {
            resolve([]);
          }
        });
      });

      const searchOptions: any = { size: 15 };
      const placesPromise = new Promise<{ data: Place[], pagination: any }>((resolve) => {
        searchService.current.keywordSearch(keyword, (data: any, status: any, paginationObj: any) => {
          if (status === kakao.maps.services.Status.OK) {
            resolve({
              data: data.map((item: any) => ({
                id: item.id,
                name: item.place_name,
                address: normalizeLocationName(item.road_address_name || item.address_name),
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
      const combined = [...addrResults, ...placeData.data];
      const seen = new Set();
      const unique = combined.filter(item => {
        const key = `${item.lat.toFixed(6)},${item.lng.toFixed(6)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setResults(unique);
      setPagination(placeData.pagination);
    } catch (error) {
      console.error('[PlaceSearchOverlay] search error:', error);
    } finally {
      setIsLoading(false);
      isSearching.current = false;
    }
  }, []);

  const loadNextPage = useCallback(() => {
    if (!pagination?.hasNextPage || isSearching.current) return;
    isSearching.current = true;
    setIsLoading(true);

    const kakao = (window as any).kakao;
    const searchOptions: any = { page: pagination.current + 1, size: 15 };

    searchService.current.keywordSearch(query, (data: any, status: any, paginationObj: any) => {
      if (status === kakao.maps.services.Status.OK) {
        const newPlaces = data.map((item: any) => ({
          id: item.id,
          name: item.place_name,
          address: normalizeLocationName(item.road_address_name || item.address_name),
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
  }, [pagination, query]);

  // 디바운스 검색
  useEffect(() => {
    if (!isOpen) return;
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
  }, [query, performSearch, isOpen]);

  // 무한 스크롤
  useEffect(() => {
    if (!pagination?.hasNextPage || isLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadNextPage();
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [pagination, isLoading, loadNextPage]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const close = useCallback((e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    window.dispatchEvent(new CustomEvent('close-place-search'));
  }, []);

  // 스와이프 다운 닫기 (댓글 다이얼로그와 동일 패턴)
  useEffect(() => {
    if (!shouldRender || !isOpen || isClosing) return;

    const bindSwipeSource = (element: HTMLElement | null, source: 'handle' | 'scroll') => {
      if (!element) return () => {};

      const handleTouchStart = (e: TouchEvent) => {
        if (!isOpen || isClosing) return;

        const target = e.target as HTMLElement | null;
        if (target?.closest('button, input, textarea, a, label, [role="button"], [data-place-no-swipe="true"]')) {
          return;
        }

        if (source === 'scroll' && (scrollAreaRef.current?.scrollTop ?? 0) > 0) {
          return;
        }

        const touch = e.touches[0];
        if (!touch) return;

        swipeGestureRef.current = {
          active: true,
          source,
          startX: touch.clientX,
          startY: touch.clientY,
          lastY: touch.clientY,
          lastTime: Date.now(),
          velocityY: 0,
          axis: 'pending',
        };
      };

      const handleTouchMove = (e: TouchEvent) => {
        const gesture = swipeGestureRef.current;
        if (!gesture?.active || gesture.source !== source) return;

        const touch = e.touches[0];
        if (!touch) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (gesture.axis === 'pending') {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          gesture.axis = Math.abs(dx) > Math.abs(dy) + 6 ? 'horizontal' : 'vertical';
        }

        if (gesture.axis === 'horizontal') {
          resetSwipeGesture();
          syncDragOffsetY(0);
          return;
        }

        if (gesture.source === 'scroll' && (scrollAreaRef.current?.scrollTop ?? 0) > 0) {
          resetSwipeGesture();
          syncDragOffsetY(0);
          return;
        }

        if (dy <= 0) {
          if (isSwipeDraggingRef.current || dragOffsetYRef.current > 0) {
            syncSwipeDragging(true);
            syncDragOffsetY(0);
            e.preventDefault();
          }
          return;
        }

        const now = Date.now();
        const deltaTime = Math.max(now - gesture.lastTime, 1);
        gesture.velocityY = (touch.clientY - gesture.lastY) / deltaTime;
        gesture.lastY = touch.clientY;
        gesture.lastTime = now;

        const limitedDy = dy <= 160 ? dy : 160 + (dy - 160) * 0.35;
        syncSwipeDragging(true);
        syncDragOffsetY(limitedDy);
        e.preventDefault();
      };

      const handleTouchEnd = () => {
        const gesture = swipeGestureRef.current;
        if (!gesture || gesture.source !== source) {
          syncSwipeDragging(false);
          return;
        }

        const currentDragOffset = dragOffsetYRef.current;
        const shouldClose = currentDragOffset > 120 || (currentDragOffset > 72 && gesture.velocityY > 0.55);

        swipeGestureRef.current = null;
        syncSwipeDragging(false);

        if (shouldClose) {
          close();
          return;
        }

        syncDragOffsetY(0);
      };

      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
      element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('touchcancel', handleTouchEnd);
      };
    };

    const unbindHandle = bindSwipeSource(handleAreaRef.current, 'handle');
    const unbindScroll = bindSwipeSource(scrollAreaRef.current, 'scroll');

    return () => {
      unbindHandle();
      unbindScroll();
    };
  }, [shouldRender, isOpen, isClosing, close]);

  const stopSheetEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleSelectPlace = (place: Place) => {
    onSelectRef.current?.(place);
    close();
  };

  if (!shouldRender) return null;
  if (typeof document === 'undefined') return null;

  const sheetTopPx = 40;

  return createPortal(
    <div
      className="fixed inset-0 z-[30000] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="장소 검색"
    >
      {/* 백드롭 */}
      <button
        type="button"
        className={`absolute inset-0 z-0 cursor-default bg-slate-950/60 pointer-events-auto ${
          isClosing ? 'comment-backdrop-exit' : 'comment-backdrop-enter'
        }`}
        onPointerDown={close}
        onClick={close}
        aria-label="검색 닫기 배경"
      />

      {/* 시트 본체 */}
      <section
        className={`fixed left-1/2 z-[1] flex w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-white/80 bg-white shadow-[0_-18px_60px_rgba(79,70,229,0.20)] pointer-events-auto sm:rounded-[32px] ${
          isClosing ? 'comment-sheet-exit' : 'comment-sheet-enter'
        }`}
        style={{
          top: `${sheetTopPx}px`,
          bottom: '0px',
          transform: `translate(-50%, ${dragOffsetY}px)`,
          transition: isSwipeDragging
            ? 'none'
            : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onClick={stopSheetEvent}
      >
        {/* 상단 핸들 + 헤더 (스와이프 영역) */}
        <div ref={handleAreaRef} className="shrink-0 touch-none">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-slate-950">장소 검색</p>
                <p className="text-sm font-bold text-slate-400">
                  {query.trim()
                    ? `${results.length.toLocaleString()}개의 결과`
                    : '장소명 또는 주소'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onPointerDown={close}
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition active:scale-95"
              aria-label="검색 닫기"
              data-place-no-swipe="true"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 검색 입력 영역 */}
        <div
          className="shrink-0 border-b border-slate-100 bg-white px-4 py-3"
          data-place-no-swipe="true"
        >
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 z-10" />
            <input
              placeholder="장소명 또는 주소 검색"
              className="w-full pl-12 pr-12 h-12 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none text-sm font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-inner transition-all focus:border-indigo-300 focus:bg-white"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={!query}
              autoComplete="off"
              data-place-no-swipe="true"
            />
            {isLoading ? (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition active:scale-90"
                aria-label="검색어 지우기"
                data-place-no-swipe="true"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* 결과 영역 */}
        <div
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white"
        >
          <div className="p-4 space-y-1" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            {results.map((place) => (
              <button
                key={place.id}
                onClick={() => handleSelectPlace(place)}
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
                  <SearchIcon className="w-8 h-8 text-gray-200" />
                </div>
                <p className="text-sm text-gray-400 font-bold leading-relaxed">
                  궁금한 장소나 주소를 입력하여<br />지도를 탐험해보세요!
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default PlaceSearchOverlay;
