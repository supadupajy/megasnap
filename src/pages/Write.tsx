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

  const { content, setContent, category, setCategory, clear } = useWriteStore();
const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

  const [currentPage, setCurrentPage] = useState<1 | 2>(
    location.state?.location || location.state?.fromLocationSelection ? 2 : 1
  );

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const initialLocation = location.state?.location;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cropPixelRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    return new Promise<string>((resolve) => {
      const kakao = (window as any).kakao;
      if (!kakao || !kakao.maps || !kakao.maps.services) {
        resolve(resolveOfflineLocationName(lat, lng));
        return;
      }
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any, status: any) => {
        if (status === kakao.maps.services.Status.OK) {
          const addr = result[0].address;
          resolve(`${addr.region_1depth_name} ${addr.region_2depth_name}`);
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

  useEffect(() => {
    cropPixelRef.current = { x: 0, y: 0 };
  }, [currentSlide]);

  const getMaxOffset = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return { maxX: 0, maxY: 0 };
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return { maxX: 0, maxY: 0 };
    const conW = container.offsetWidth;
    const conH = container.offsetHeight;
    const scale = Math.max(conW / natW, conH / natH);
    const renderedW = natW * scale;
    const renderedH = natH * scale;
    return {
      maxX: Math.max(0, (renderedW - conW) / 2),
      maxY: Math.max(0, (renderedH - conH) / 2),
    };
  };

  const pixelToPercent = (offsetX: number, offsetY: number) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return { x: 50, y: 50 };
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return { x: 50, y: 50 };
    const conW = container.offsetWidth;
    const conH = container.offsetHeight;
    const scale = Math.max(conW / natW, conH / natH);
    const renderedW = natW * scale;
    const renderedH = natH * scale;
    const x = renderedW <= conW ? 50 : 50 + (offsetX / (renderedW - conW)) * 100;
    const y = renderedH <= conH ? 50 : 50 + (offsetY / (renderedH - conH)) * 100;
    return { x, y };
  };

  const applyDrag = (deltaX: number, deltaY: number) => {
    const media = mediaFiles[currentSlide];
    if (!media || media.type !== 'image') return;
    const { maxX, maxY } = getMaxOffset();
    cropPixelRef.current.x = Math.max(-maxX, Math.min(maxX, cropPixelRef.current.x - deltaX));
    cropPixelRef.current.y = Math.max(-maxY, Math.min(maxY, cropPixelRef.current.y - deltaY));
    if (imgRef.current) {
      const { x, y } = pixelToPercent(cropPixelRef.current.x, cropPixelRef.current.y);
      imgRef.current.style.objectPosition = `${x}% ${y}%`;
    }
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    const media = mediaFiles[currentSlide];
    if (!media || media.type !== 'image') return;
    const img = imgRef.current;
    const container = containerRef.current;
    if (img && container && img.naturalWidth) {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const conW = container.offsetWidth;
      const conH = container.offsetHeight;
      const scale = Math.max(conW / natW, conH / natH);
      const renderedW = natW * scale;
      const renderedH = natH * scale;
      const cropX = media.crop?.x ?? 50;
      const cropY = media.crop?.y ?? 50;
      cropPixelRef.current = {
        x: renderedW <= conW ? 0 : ((cropX - 50) / 100) * (renderedW - conW),
        y: renderedH <= conH ? 0 : ((cropY - 50) / 100) * (renderedH - conH),
      };
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    dragStartRef.current = { x: clientX, y: clientY };
    applyDrag(deltaX, deltaY);
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const { x, y } = pixelToPercent(cropPixelRef.current.x, cropPixelRef.current.y);
    const newMedia = [...mediaFiles];
    newMedia[currentSlide] = { ...newMedia[currentSlide], crop: { x, y } };
    setMediaFiles(newMedia);
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = await Promise.all(files.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      let orientation: 'landscape' | 'portrait' = 'landscape';

      if (type === 'image') {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            orientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
            console.log('📸 orientation:', orientation, img.naturalWidth, 'x', img.naturalHeight);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      }
      return { file, url, type, crop: { x: 50, y: 50 }, orientation } as MediaFile;
    }));

    setMediaFiles(prev => [...prev, ...newItems]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
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

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          content,
          location_name: address || '위치 미지정',
          latitude: initialLocation?.lat || null,
          longitude: initialLocation?.lng || null,
          image_url: uploadedUrls[0],
          images: uploadedUrls,
          user_id: authUser.id,
          user_name: profile?.nickname || '탐험가',
          user_avatar: profile?.avatar_url,
          category,
          video_url: mediaFiles[0]?.type === 'video' ? uploadedUrls[0] : null,
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

  const currentMedia = mediaFiles[currentSlide];
  
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
          <button onClick={() => setCurrentPage(1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800">
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
                <div
  ref={containerRef}
  className="w-full rounded-[32px] overflow-hidden shadow-2xl relative select-none"
  style={{ aspectRatio: '1 / 1', backgroundColor: 'red' }}
>
                  {/* ✅ type 조건 제거 — 무조건 img로 렌더링하여 원인 파악 */}
<img
  ref={imgRef}
  src={currentMedia?.url}
  className="pointer-events-none"
  onLoad={(e) => {
    const img = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;
    const conW = container.offsetWidth;
    const conH = container.offsetHeight;
    const scale = Math.max(conW / img.naturalWidth, conH / img.naturalHeight);
    const renderedW = img.naturalWidth * scale;
    const renderedH = img.naturalHeight * scale;
    const cropX = currentMedia?.crop?.x ?? 50;
    const cropY = currentMedia?.crop?.y ?? 50;
    cropPixelRef.current = {
      x: renderedW <= conW ? 0 : ((cropX - 50) / 100) * (renderedW - conW),
      y: renderedH <= conH ? 0 : ((cropY - 50) / 100) * (renderedH - conH),
    };
  }}
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${currentMedia?.crop?.x ?? 50}% ${currentMedia?.crop?.y ?? 50}%`,
    transition: isDragging ? 'none' : 'object-position 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  }}
/>

                  {/* 드래그 오버레이 */}
                  <div
                    className="absolute inset-0 z-10"
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => { e.preventDefault(); handleDragStart(e.clientX, e.clientY); }}
                    onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
                    onTouchMove={(e) => { e.stopPropagation(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY); }}
                    onTouchEnd={handleDragEnd}
                  />

                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newFiles = [...mediaFiles];
                      newFiles.splice(currentSlide, 1);
                      setMediaFiles(newFiles);
                      setCurrentSlide(prev => Math.min(prev, Math.max(0, newFiles.length - 1)));
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-30"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* 슬라이드 전환 + 인디케이터 */}
                  {mediaFiles.length > 1 && (
                    <>
                      <button className="absolute left-0 top-0 bottom-0 w-1/4 z-20 opacity-0" onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))} />
                      <button className="absolute right-0 top-0 bottom-0 w-1/4 z-20 opacity-0" onClick={() => setCurrentSlide(prev => Math.min(mediaFiles.length - 1, prev + 1))} />
                      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                        {mediaFiles.map((_, i) => (
                          <div key={i} className={cn("h-1.5 rounded-full transition-all", currentSlide === i ? "bg-white w-6" : "bg-white/40 w-1.5")} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => mediaInputRef.current?.click()}
                  className="w-full rounded-[32px] overflow-hidden bg-gray-100 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors"
                  style={{ aspectRatio: '1 / 1' }}
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