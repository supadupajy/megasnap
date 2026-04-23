"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, X, ImageIcon, Utensils, Car, TreePine, PawPrint, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { postDraftStore } from '@/utils/post-draft-store';
import { resolveOfflineLocationName } from '@/utils/offline-location';
import { useWriteStore } from '@/utils/write-store';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface MediaFile {
  file: File;
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
  crop?: { x: number; y: number };
  orientation?: 'landscape' | 'portrait';
}

const CATEGORIES = [
  { key: 'none', label: '없음', Icon: X },
  { key: 'food', label: '맛집', Icon: Utensils },
  { key: 'accident', label: '사고', Icon: Car },
  { key: 'place', label: '명소', Icon: TreePine },
  { key: 'animal', label: '동물', Icon: PawPrint },
] as const;

const Write = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile } = useAuth();
  
  const { mediaFiles, setMediaFiles, content, setContent, category, setCategory, clear } = useWriteStore();
  
  const [currentPage, setCurrentPage] = useState<1 | 2>(
    location.state?.location || location.state?.fromLocationSelection ? 2 : 1
  );

  const [api, setApi] = useState<any>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [dragActiveIdx, setDragActiveIdx] = useState<number | null>(null);

  const initialLocation = location.state?.location;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // [FIX] 카카오 맵 API를 사용하여 좌표를 실제 주소로 변환하는 함수
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    return new Promise<string>((resolve) => {
      const kakao = (window as any).kakao;
      if (!kakao || !kakao.maps || !kakao.maps.services) {
        // API가 로드되지 않은 경우 오프라인 로직으로 대체
        resolve(resolveOfflineLocationName(lat, lng));
        return;
      }

      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any, status: any) => {
        if (status === kakao.maps.services.Status.OK) {
          const addr = result[0].address;
          // 구 단위까지만 추출하여 "서울시 강남구" 형태로 가공
          const region1 = addr.region_1depth_name; // 시/도
          const region2 = addr.region_2depth_name; // 구/군
          resolve(`${region1} ${region2}`);
        } else {
          resolve(resolveOfflineLocationName(lat, lng));
        }
      });
    });
  }, []);

  useEffect(() => {
    const updateAddress = async () => {
      if (initialLocation) {
        setIsLoadingAddress(true);
        const resolvedAddress = await reverseGeocode(initialLocation.lat, initialLocation.lng);
        setAddress(resolvedAddress);
        setIsLoadingAddress(false);
      } else {
        setAddress('위치 미지정');
      }
    };
    
    updateAddress();
  }, [initialLocation, reverseGeocode]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = await Promise.all(files.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      let orientation: 'landscape' | 'portrait' = 'landscape';

      if (type === 'image') {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            orientation = img.width >= img.height ? 'landscape' : 'portrait';
            resolve(null);
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      }

      return { file, url, type, crop: { x: 50, y: 50 }, orientation } as MediaFile;
    }));

    setMediaFiles([...mediaFiles, ...newItems]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleRemoveMedia = useCallback((idx: number) => {
    const newFiles = [...mediaFiles];
    newFiles.splice(idx, 1);
    setMediaFiles(newFiles);
  }, [mediaFiles, setMediaFiles]);

  const handleCropChange = useCallback((idx: number, x: number, y: number) => {
    const newMedia = [...mediaFiles];
    newMedia[idx] = { ...newMedia[idx], crop: { x, y } };
    setMediaFiles(newMedia);
  }, [mediaFiles, setMediaFiles]);

  const handleDrag = (e: React.MouseEvent | React.TouchEvent, idx: number) => {
    const media = mediaFiles[idx];
    if (!media || media.type !== 'image') return;
    
    const isPortrait = media.orientation === 'portrait';
    
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (dragActiveIdx !== idx) {
      setDragActiveIdx(idx);
      dragStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    dragStartRef.current = { x: clientX, y: clientY };

    // 민감도: % 단위이므로 화면 크기에 맞춰 조정 (0.2 ~ 0.5 권장)
    const sensitivity = 0.35;
    
    const currentX = media.crop?.x ?? 50;
    const currentY = media.crop?.y ?? 50;

    const newX = isPortrait ? 50 : currentX - (deltaX * sensitivity);
    const newY = isPortrait ? currentY - (deltaY * sensitivity) : 50;

    updateMediaCrop(idx, newX, newY);
  };

  const stopDragging = () => {
    setDragActiveIdx(null);
  };

  const updateMediaCrop = (idx: number, x: number, y: number) => {
    const newMedia = [...mediaFiles];
    newMedia[idx] = { ...newMedia[idx], crop: { x, y } };
    setMediaFiles(newMedia);
  };

  const handlePost = async () => {
    if (!authUser) return;
    setIsSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const media of mediaFiles) {
        const timestamp = new Date().getTime();
        const folder = media.type === 'video' ? 'post-videos' : 'post-images';
        const fileExt = media.file.name.split('.').pop();
        const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${authUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from(folder).upload(filePath, media.file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(folder).getPublicUrl(filePath);
        uploadedUrls.push(publicUrl);
      }

      // [FIX] images 컬럼에 업로드된 모든 URL 배열을 저장
      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert({
          content: content,
          location_name: address || '위치 미지정',
          latitude: initialLocation?.lat || null,
          longitude: initialLocation?.lng || null,
          image_url: uploadedUrls[0], // 대표 이미지 (첫 번째)
          images: uploadedUrls,      // [핵심] 전체 이미지 배열 저장
          user_id: authUser.id,
          user_name: profile?.nickname || '탐험가',
          user_avatar: profile?.avatar_url,
          category: category,
          video_url: mediaFiles[0].type === 'video' ? uploadedUrls[0] : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      showSuccess('게시물이 등록되었습니다! ✨');
      clear();
      postDraftStore.clear();
      navigate('/', { state: { triggerConfetti: true } });
    } catch (err: any) {
      showError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      <div className="h-[88px] w-full shrink-0 pointer-events-none" />

      <div className="shrink-0 bg-white z-40 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">
            {currentPage === 1 ? '새 게시물 작성' : '상세 정보 입력'}
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Leave your trace</p>
        </div>
        {currentPage === 2 && (
          <button
            onClick={() => setCurrentPage(1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        <div className="px-5 py-6 space-y-8 pb-40">
          {currentPage === 1 ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 px-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">미디어 첨부</p>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
                </div>
                <input type="file" ref={mediaInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleMediaSelect} />
              </div>

              {mediaFiles.length > 0 ? (
                <div className="aspect-square w-full rounded-[32px] overflow-hidden bg-gray-100 shadow-2xl relative">

                  <Carousel 
                    setApi={setApi} 
                    className="w-full h-full"
                    opts={{ watchDrag: dragActiveIdx === null }}
                  >
                    <CarouselContent className="ml-0 h-full">
                      {mediaFiles.map((media, idx) => (
                        <CarouselItem key={`${idx}-${media.url}`} className="pl-0 h-full relative select-none">
                          <div 
                            className="w-full h-full relative overflow-hidden touch-none flex items-center justify-center bg-black"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleDrag(e, idx);
                            }}
                            onMouseMove={(e) => {
                              if (dragActiveIdx === idx) {
                                e.stopPropagation();
                                handleDrag(e, idx);
                              }
                            }}
                            onMouseUp={stopDragging}
                            onMouseLeave={stopDragging}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              handleDrag(e, idx);
                            }}
                            onTouchMove={(e) => {
                              if (dragActiveIdx === idx) {
                                e.stopPropagation();
                                handleDrag(e, idx);
                              }
                            }}
                            onTouchEnd={stopDragging}
                          >
                            {media.type === 'image' ? (
  <img 
    key={`img-${media.url}`}
    src={media.url} 
    className="w-full h-full pointer-events-none select-none"
    style={{
      objectFit: 'cover',
      objectPosition: media.orientation === 'portrait'
        ? `50% ${media.crop?.y ?? 50}%`
        : `${media.crop?.x ?? 50}% 50%`,
    }}
                              />
                            ) : (
                              <video 
                                key={`video-${media.url}`}
                                src={media.url} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                loop 
                                playsInline 
                              />
                            )}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFiles = [...mediaFiles];
                              newFiles.splice(idx, 1);
                              setMediaFiles(newFiles);
                            }} 
                            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-30"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                  {mediaFiles.length > 1 && (
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20">
                      {mediaFiles.map((_, i) => (
                        <div key={i} className={cn("h-1.5 rounded-full transition-all", currentSlide === i ? "bg-white w-6" : "bg-white/40 w-1.5")} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => mediaInputRef.current?.click()}
                  className="aspect-square w-full rounded-[32px] overflow-hidden bg-gray-100 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  <ImageIcon className="w-10 h-10 text-gray-400 mb-3" />
                  <span className="text-gray-400 font-black text-sm uppercase tracking-widest">사진 / 동영상 선택</span>
                </div>
              )}

              <Button
                className="w-full h-16 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-xl shadow-indigo-100"
                onClick={() => setCurrentPage(2)}
                disabled={mediaFiles.length === 0}
              >
                다음 단계로
              </Button>
            </div>
          ) : (
            <div className="space-y-8 pb-20">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 px-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">장소 정보</p>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">(선택)</span>
                </div>
                <div 
                  onClick={() => navigate('/', { state: { startSelection: true } })}
                  className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-4 cursor-pointer hover:bg-gray-100 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <MapPin className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className={cn("font-bold truncate", address === '위치 미지정' ? "text-gray-400" : "text-gray-900")}>
                    {address || '위치 미지정'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 px-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">카테고리</p>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setCategory(cat.key)}
                      className={cn(
                        "flex flex-col items-center justify-center h-20 rounded-2xl border-2 transition-all",
                        category === cat.key ? "border-indigo-600 bg-indigo-50" : "border-gray-100 bg-white"
                      )}
                    >
                      <cat.Icon className={cn("w-6 h-6", category === cat.key ? "text-indigo-600" : "text-gray-400")} />
                      <span className={cn("text-[10px] font-black mt-2", category === cat.key ? "text-indigo-600" : "text-gray-500")}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 px-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">내용 입력</p>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
                </div>
                <Textarea 
                  placeholder="이 장소에서의 추억을 기록해보세요..." 
                  className="min-h-[150px] bg-gray-50 border-none rounded-[32px] p-6 text-base font-bold focus-visible:ring-2 focus-visible:ring-indigo-600"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <Button 
                className="w-full h-16 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-xl shadow-indigo-100 disabled:opacity-50"
                onClick={handlePost}
                disabled={isSubmitting || !content.trim()}
              >
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                게시물 등록하기
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Write;