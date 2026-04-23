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

const MediaSlider = ({
  mediaFiles,
  onRemove,
  onCropChange,
}: {
  mediaFiles: MediaFile[];
  onRemove: (idx: number) => void;
  onCropChange: (idx: number, x: number, y: number) => void;
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const cropRef = useRef<{ x: number; y: number }[]>([]);

  const currentIdxRef = useRef(0);
  const mediaFilesRef = useRef<MediaFile[]>([]);
  const onCropChangeRef = useRef(onCropChange);

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { onCropChangeRef.current = onCropChange; }, [onCropChange]);

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
    cropRef.current = mediaFiles.map(m => ({ x: m.crop?.x ?? 50, y: m.crop?.y ?? 50 }));
    if (currentIdx >= mediaFiles.length) {
      setCurrentIdx(Math.max(0, mediaFiles.length - 1));
    }
  }, [mediaFiles]);

  useEffect(() => {
  const el = sliderRef.current;
  if (!el) return;

  let startX = 0;
  let lastX = 0;
  let lastY = 0;
  let isDragging = false;
  let isMouseDown = false;

  // ✅ 공통 crop 처리 함수
  const processDrag = (clientX: number, clientY: number) => {
    const idx = currentIdxRef.current;
    const media = mediaFilesRef.current[idx];
    if (!media || media.type !== 'image') return;

    isDragging = true;
    const dx = clientX - lastX;
    const dy = clientY - lastY;
    lastX = clientX;
    lastY = clientY;

    const isPortrait = media.orientation === 'portrait';
    const cur = cropRef.current[idx] ?? { x: 50, y: 50 };
    const sensitivity = 0.5;
    const newX = isPortrait ? cur.x : Math.max(0, Math.min(100, cur.x - dx * sensitivity));
    const newY = isPortrait ? Math.max(0, Math.min(100, cur.y - dy * sensitivity)) : cur.y;

    cropRef.current[idx] = { x: newX, y: newY };
    const imgEl = imgRefs.current[idx];
    if (imgEl) imgEl.style.objectPosition = `${newX}% ${newY}%`;
  };

  const processDragEnd = (endX: number) => {
    const idx = currentIdxRef.current;
    const files = mediaFilesRef.current;
    if (isDragging) {
      const { x, y } = cropRef.current[idx] ?? { x: 50, y: 50 };
      onCropChangeRef.current(idx, x, y);
    } else {
      const totalDx = endX - startX;
      if (totalDx < -40 && idx < files.length - 1) setCurrentIdx(i => i + 1);
      else if (totalDx > 40 && idx > 0) setCurrentIdx(i => i - 1);
    }
    isDragging = false;
  };

  // ✅ 터치 이벤트 (실제 모바일)
  const onTouchStart = (e: TouchEvent) => {
    startX = e.touches[0].clientX;
    lastX = startX;
    lastY = e.touches[0].clientY;
    isDragging = false;
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    processDrag(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchEnd = (e: TouchEvent) => {
    processDragEnd(e.changedTouches[0].clientX);
  };

  // ✅ 마우스 이벤트 (PC 에뮬레이터 + 데스크탑)
  const onMouseDown = (e: MouseEvent) => {
    isMouseDown = true;
    isDragging = false;
    startX = e.clientX;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!isMouseDown) return;
    processDrag(e.clientX, e.clientY);
  };
  const onMouseUp = (e: MouseEvent) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    processDragEnd(e.clientX);
  };

  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd, { passive: true });
  el.addEventListener('mousedown', onMouseDown);

  // ✅ mousemove/mouseup은 document에 등록 — 영역 밖으로 나가도 추적
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  return () => {
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}, []); // ✅ 빈 배열 — 단 한 번만 등록

  if (mediaFiles.length === 0) return null;

  return (
    // ✅ touch-none: CSS 레벨에서 브라우저 기본 터치 동작 차단
    // ✅ e.preventDefault(): JS 레벨에서 추가 차단 (iOS Safari 대응)
    <div
      ref={sliderRef}
      className="aspect-square w-full rounded-[32px] overflow-hidden bg-black shadow-2xl relative select-none touch-none"
    >
      <div className="relative w-full h-full">
        {mediaFiles.map((media, idx) => (
          <div
            key={`${idx}-${media.url}`}
            className="absolute inset-0 w-full h-full"
            style={{
              opacity: idx === currentIdx ? 1 : 0,
              transition: 'opacity 0.25s ease',
              pointerEvents: idx === currentIdx ? 'auto' : 'none',
            }}
          >
            {media.type === 'image' ? (
              <img
                ref={el => { imgRefs.current[idx] = el; }}
                src={media.url}
                className="w-full h-full object-cover"
                draggable={false}
                style={{ objectPosition: `${media.crop?.x ?? 50}% ${media.crop?.y ?? 50}%` }}
              />
            ) : (
              <video
                src={media.url}
                className="w-full h-full object-cover"
                autoPlay muted loop playsInline
              />
            )}
          </div>
        ))}
      </div>

      <button
        onTouchEnd={(e) => { e.stopPropagation(); onRemove(currentIdx); }}
        onClick={(e) => { e.stopPropagation(); onRemove(currentIdx); }}
        className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-30"
      >
        <X className="w-4 h-4" />
      </button>

      {mediaFiles.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
          {mediaFiles.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                currentIdx === i ? "bg-white w-6" : "bg-white/40 w-1.5"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Write = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile } = useAuth();
  const { mediaFiles, setMediaFiles, content, setContent, category, setCategory, clear } = useWriteStore();

  const [currentPage, setCurrentPage] = useState<1 | 2>(
    location.state?.location || location.state?.fromLocationSelection ? 2 : 1
  );

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const initialLocation = location.state?.location;
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialLocation) {
      setIsLoadingAddress(true);
      const resolvedAddress = resolveOfflineLocationName(initialLocation.lat, initialLocation.lng);
      setAddress(resolvedAddress || `좌표: ${initialLocation.lat.toFixed(4)}, ${initialLocation.lng.toFixed(4)}`);
      setIsLoadingAddress(false);
    } else {
      setAddress('위치 미지정');
    }
  }, [initialLocation]);

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

  const handlePost = async () => {
    if (!authUser) return;
    setIsSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const media of mediaFiles) {
        const timestamp = Date.now();
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
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className={cn(
                    "w-full h-20 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-all",
                    mediaFiles.length > 0 ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-gray-50"
                  )}
                >
                  <ImageIcon className={cn("w-6 h-6", mediaFiles.length > 0 ? "text-indigo-500" : "text-gray-400")} />
                  <span className={cn("font-bold", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-500")}>
                    {mediaFiles.length > 0 ? `${mediaFiles.length}개의 파일 선택됨` : '사진 / 동영상 선택'}
                  </span>
                </button>
                <input
                  type="file"
                  ref={mediaInputRef}
                  className="hidden"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaSelect}
                />
              </div>

              {mediaFiles.length > 0 ? (
                <MediaSlider
                  mediaFiles={mediaFiles}
                  onRemove={handleRemoveMedia}
                  onCropChange={handleCropChange}
                />
              ) : (
                <div className="aspect-square w-full rounded-[32px] bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200">
                  <span className="text-gray-400 font-black text-sm uppercase tracking-widest">미리보기 영역</span>
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
                <div className="flex items-center gap-1 px-1">
  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">장소 정보</p>
  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
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
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">카테고리</p>
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
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">내용 입력</p>
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
                disabled={isSubmitting || !content.trim() || !initialLocation}
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