"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { MapPin, X, Map as MapIcon, Video, ImageIcon, Utensils, Car, TreePine, PawPrint, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { postDraftStore } from '@/utils/post-draft-store';
import { resolveOfflineLocationName } from '@/utils/offline-location';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface WritePostProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: any) => void;
  onStartLocationSelection?: () => void;
  onLocationReset?: () => void;
  initialLocation?: { lat: number; lng: number } | null;
}

interface MediaFile {
  file: File;
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
  crop?: { x: number; y: number };
  zoom?: number;
  orientation?: 'landscape' | 'portrait';
}

const CATEGORIES = [
  { key: 'none', label: '없음', Icon: X, color: 'bg-gray-500' },
  { key: 'food', label: '맛집', Icon: Utensils, color: 'bg-orange-500' },
  { key: 'accident', label: '사고', Icon: Car, color: 'bg-red-600' },
  { key: 'place', label: '명소', Icon: TreePine, color: 'bg-green-600' },
  { key: 'animal', label: '동물', Icon: PawPrint, color: 'bg-purple-600' },
] as const;

const PREVIEW_HEIGHT = 300;

const WritePost = ({ isOpen, onClose, onPostCreated, onStartLocationSelection, onLocationReset, initialLocation }: WritePostProps) => {

  const { user: authUser, profile } = useAuth();
  
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [draft, setDraft] = useState(postDraftStore.get());
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [api, setApi] = useState<any>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>('none');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // 드래프트 구독
  useEffect(() => {
    const unsubscribe = postDraftStore.subscribe(() => {
      const currentDraft = postDraftStore.get();
      setDraft(currentDraft);
      if (!currentDraft.image && !currentDraft.content && mediaFiles.length === 0) {
        setCurrentPage(1);
      }
    });
    return () => unsubscribe();
  }, [mediaFiles.length]);

  // 캐러셀 API
  useEffect(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

  // 위치 주소 로드
  useEffect(() => {
    if (!isOpen) return;
    if (initialLocation) {
      setIsLoadingAddress(true);
      const resolvedAddress = resolveOfflineLocationName(initialLocation.lat, initialLocation.lng);
      setAddress(resolvedAddress || `좌표: ${initialLocation.lat.toFixed(4)}, ${initialLocation.lng.toFixed(4)}`);
      setIsLoadingAddress(false);
    } else {
      setAddress('위치 없음');
      setIsLoadingAddress(false);
    }
  }, [isOpen, initialLocation]);

  // 키보드 높이 감지
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const keyboardH = window.innerHeight - vv.height;
      setKeyboardHeight(keyboardH > 100 ? keyboardH : 0);
    };
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Drawer 닫힐 때 키보드 높이 초기화
  useEffect(() => {
    if (!isOpen) setKeyboardHeight(0);
  }, [isOpen]);

  const getOrientation = (url: string): Promise<'landscape' | 'portrait'> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width >= img.height ? 'landscape' : 'portrait');
      img.onerror = () => resolve('landscape');
      img.src = url;
    });
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMediaItems = await Promise.all(files.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      let thumbnail = undefined;
      let orientation: 'landscape' | 'portrait' | undefined = undefined;

      if (type === 'video') {
        thumbnail = await captureVideoThumbnail(url).catch(() => undefined);
      } else {
        orientation = await getOrientation(url);
      }

      return { file, url, type, thumbnail, crop: { x: 0, y: 0 }, zoom: 1, orientation } as MediaFile;
    }));

    setMediaFiles(prev => {
      const updated = [...prev, ...newMediaItems];
      const firstImage = updated.find(m => m.type === 'image');
      const firstVideo = updated.find(m => m.type === 'video');
      if (firstImage) {
        postDraftStore.set({ image: firstImage.url });
      } else if (firstVideo?.thumbnail) {
        postDraftStore.set({ image: firstVideo.thumbnail });
      }
      return updated;
    });
  };

  const captureVideoThumbnail = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Thumbnail capture timeout')), 5000);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.onloadeddata = () => { video.currentTime = 0.5; };
      video.onseeked = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error('Canvas context not available'));
        }
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video load error'));
      };
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        postDraftStore.set({ image: null });
      } else {
        const firstImage = updated.find(m => m.type === 'image');
        if (firstImage) postDraftStore.set({ image: firstImage.url });
      }
      return updated;
    });
  };

  const handlePost = async () => {
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    if (mediaFiles.length === 0) { showError('사진이나 동영상을 첨부해주세요.'); return; }
    if (!selectedCategory) { showError('카테고리를 선택해주세요.'); return; }

    setIsSubmitting(true);
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    const finalLat = initialLocation?.lat || null;
    const finalLng = initialLocation?.lng || null;
    const finalAddress = address || '위치 미지정';

    try {
      const uploadedUrls: string[] = [];
      
      for (const media of mediaFiles) {
        const timestamp = new Date().getTime();
        const folder = media.type === 'video' ? 'post-videos' : 'post-images';
        const fileExt = media.file.name.split('.').pop();
        const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${authUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(folder)
          .upload(filePath, media.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(folder).getPublicUrl(filePath);
        uploadedUrls.push(publicUrl);
      }

      const primaryMedia = mediaFiles[0];
      const finalImageUrl = uploadedUrls[0]; 
      let finalVideoUrl = primaryMedia.type === 'video' ? uploadedUrls[0] : null;

      const postData = {
        content: draft.content,
        location_name: finalAddress,
        latitude: finalLat,
        longitude: finalLng,
        image_url: finalImageUrl,
        images: uploadedUrls,
        user_id: authUser.id,
        user_name: displayName,
        user_avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`,
        likes: 0,
        category: selectedCategory,
        video_url: finalVideoUrl,
        created_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert(postData)
        .select('*')
        .single();
        
      if (insertError) throw insertError;

      processNewPost(insertData, finalVideoUrl);
    } catch (err: any) {
      console.error('[WritePost] Critical Error:', err);
      showError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processNewPost = (dbPost: any, finalVideoUrl: string | null) => {
    const displayName = profile?.nickname || authUser?.email?.split('@')[0] || '탐험가';
    const finalLat = initialLocation?.lat || null;
    const finalLng = initialLocation?.lng || null;
    const finalAddress = address || '위치 미지정';

    const newPost = {
      id: dbPost.id,
      isAd: false,
      isGif: false,
      isInfluencer: false,
      user: {
        id: authUser!.id,
        name: displayName,
        avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser!.id}`
      },
      content: draft.content,
      location: finalAddress,
      lat: finalLat as any,
      lng: finalLng as any,
      likes: 0,
      commentsCount: 0,
      comments: [],
      image: dbPost.image_url, 
      images: dbPost.images || [dbPost.image_url],
      videoUrl: finalVideoUrl,
      isLiked: false,
      createdAt: new Date(),
      borderType: 'none',
      category: selectedCategory,
    };

    if (onPostCreated) onPostCreated(newPost);
    showSuccess('새로운 추억이 등록되었습니다! ✨');
    postDraftStore.clear();
    setMediaFiles([]);
    setSelectedCategory('none');
    setCurrentPage(1);
    onClose();
  };

  const handleNextPage = () => {
    if (mediaFiles.length === 0) { showError('사진이나 동영상을 첨부해주세요.'); return; }
    setCurrentPage(2);
  };

  const handleBackPage = () => { setCurrentPage(1); };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-[1px]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
        <DrawerContent
          className="flex flex-col outline-none overflow-hidden bg-white z-[1001] shadow-2xl h-[92vh] rounded-t-[40px]"
          style={{ 
            bottom: 0,
            transition: 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
            willChange: 'transform'
          }}
        >
          <div className="sr-only">
            <DrawerTitle>새 게시물 작성</DrawerTitle>
            <DrawerDescription>장소를 선택하고 사진이나 동영상을 업로드하여 추억을 기록하세요.</DrawerDescription>
          </div>

          <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0 pointer-events-none" />

          <div className="px-5 flex flex-col flex-1 min-h-0">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                {currentPage === 2 && (
                  <Button variant="ghost" size="icon" onClick={handleBackPage} className="rounded-full -ml-2">
                    <ChevronLeft className="w-6 h-6 text-gray-800" />
                    <span className="sr-only">이전</span>
                  </Button>
                )}
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-indigo-600">✨</span>
                  {currentPage === 1 ? '새 게시물 작성' : '상세 정보 입력'}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
            {/* 디버그 — 확인 후 삭제 */}
<div className="text-xs text-red-500 px-2">
  keyboard: {keyboardHeight} / innerHeight: {typeof window !== 'undefined' ? window.innerHeight : 0} / vvHeight: {typeof window !== 'undefined' && window.visualViewport ? Math.round(window.visualViewport.height) : 0}
</div>
            {/* 페이지 콘텐츠 — 하단 버튼(fixed) 높이만큼 pb 확보 */}
            <div className="flex-1 min-h-0 overflow-y-auto pb-24">
              <AnimatePresence mode="wait">
                {currentPage === 1 ? (
                  <motion.div
                    key="page1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-4 pb-2"
                  >
                    {/* 미디어 첨부 버튼 */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        미디어 첨부 <span className="text-indigo-600">(필수)</span>
                      </p>
                      <button
                        onClick={() => mediaInputRef.current?.click()}
                        className={cn(
                          "w-full h-[72px] rounded-2xl border-2 border-dashed flex items-center justify-center gap-4 transition-all duration-300",
                          mediaFiles.length > 0
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ImageIcon className={cn("w-5 h-5", mediaFiles.length > 0 ? "text-indigo-500" : "text-gray-400")} />
                          <Video className={cn("w-5 h-5", mediaFiles.length > 0 ? "text-indigo-500" : "text-gray-400")} />
                        </div>
                        <span className={cn("font-bold text-sm", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-500")}>
                          {mediaFiles.length > 0
                            ? `${mediaFiles.length}개 선택됨 (추가 가능)`
                            : '사진 / 동영상 선택'}
                        </span>
                      </button>
                      <input
                        type="file"
                        ref={mediaInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => { handleMediaSelect(e); e.target.value = ''; }}
                      />
                    </div>

                    {/* 미리보기 영역 */}
                    <div
                      className="w-full rounded-2xl overflow-hidden bg-black border border-gray-100"
                      style={{ height: `${PREVIEW_HEIGHT}px` }}
                    >
                      {mediaFiles.length === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-100">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                            <ImageIcon className="w-7 h-7 text-gray-300" />
                          </div>
                          <p className="text-xs font-bold text-gray-300 tracking-tight">미리보기 영역</p>
                        </div>
                      ) : (
                        <Carousel
                          setApi={setApi}
                          opts={{ align: "start", containScroll: "trimSnaps", watchDrag: !isDraggingRef.current }}
                          className="w-full"
                          style={{ height: `${PREVIEW_HEIGHT}px` }}
                        >
                          <CarouselContent
                            className="ml-0"
                            style={{ height: `${PREVIEW_HEIGHT}px` }}
                          >
                            {mediaFiles.map((media, idx) => (
                              <CarouselItem
                                key={`${media.url}-${idx}`}
                                className="pl-0 basis-full"
                                style={{ height: `${PREVIEW_HEIGHT}px` }}
                              >
                                <div
                                  className="relative w-full overflow-hidden bg-black flex items-center justify-center"
                                  style={{ height: `${PREVIEW_HEIGHT}px` }}
                                >
                                  {media.type === 'image' ? (
                                    <>
                                      <img
                                        src={media.url}
                                        alt={`Preview ${idx + 1}`}
                                        draggable={false}
                                        className="select-none pointer-events-none block"
                                        style={{
                                          width: media.orientation === 'portrait' ? '100%' : 'auto',
                                          height: media.orientation === 'landscape' ? '100%' : 'auto',
                                          transform: `translate(${media.crop?.x || 0}px, ${media.crop?.y || 0}px) scale(${media.zoom || 1})`,
                                          transition: isDraggingRef.current ? 'none' : 'transform 0.05s linear',
                                        }}
                                      />
                                      <div
                                        className="absolute inset-0 z-10 touch-none"
                                        style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
                                        onPointerDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          isDraggingRef.current = true;
                                          dragStartRef.current = { x: e.clientX, y: e.clientY };
                                          (e.target as HTMLElement).setPointerCapture(e.pointerId);
                                        }}
                                        onPointerMove={(e) => {
                                          if (!isDraggingRef.current) return;
                                          if (rafRef.current) cancelAnimationFrame(rafRef.current);

                                          const clientX = e.clientX;
                                          const clientY = e.clientY;
                                          const container = e.currentTarget.parentElement;

                                          rafRef.current = requestAnimationFrame(() => {
                                            const deltaX = clientX - dragStartRef.current.x;
                                            const deltaY = clientY - dragStartRef.current.y;

                                            setMediaFiles(prev => prev.map((m, i) => {
                                              if (i !== idx) return m;
                                              if (!container) return m;

                                              const imgEl = container.querySelector('img') as HTMLImageElement;
                                              if (!imgEl) return m;

                                              const imgW = imgEl.offsetWidth;
                                              const imgH = imgEl.offsetHeight;
                                              const conW = container.offsetWidth;
                                              const conH = container.offsetHeight;

                                              const maxX = Math.max(0, (imgW - conW) / 2);
                                              const maxY = Math.max(0, (imgH - conH) / 2);

                                              const newX = Math.max(-maxX, Math.min(maxX, (m.crop?.x || 0) + deltaX));
                                              const newY = Math.max(-maxY, Math.min(maxY, (m.crop?.y || 0) + deltaY));

                                              return { ...m, crop: { x: newX, y: newY } };
                                            }));

                                            dragStartRef.current = { x: clientX, y: clientY };
                                          });
                                        }}
                                        onPointerUp={(e) => {
                                          if (rafRef.current) cancelAnimationFrame(rafRef.current);
                                          isDraggingRef.current = false;
                                          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                                        }}
                                        onPointerCancel={() => {
                                          if (rafRef.current) cancelAnimationFrame(rafRef.current);
                                          isDraggingRef.current = false;
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <video
                                      src={media.url}
                                      className="w-full h-full object-cover"
                                      autoPlay
                                      muted
                                      loop
                                      playsInline
                                    />
                                  )}

                                  {/* 삭제 버튼 */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeMedia(idx); }}
                                    className="absolute top-3 right-3 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>

                                  {/* 인디케이터 */}
                                  {mediaFiles.length > 1 && (
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                                      {mediaFiles.map((_, i) => (
                                        <div
                                          key={i}
                                          className={cn(
                                            "h-1.5 rounded-full transition-all duration-300 shadow",
                                            currentSlide === i ? "bg-white w-4" : "bg-white/50 w-1.5"
                                          )}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>

                          {mediaFiles.length > 1 && (
                            <>
                              <CarouselPrevious className="left-3 bg-black/30 border-none hover:bg-black/50 z-20 h-9 w-9 text-white shadow-lg" />
                              <CarouselNext className="right-3 bg-black/30 border-none hover:bg-black/50 z-20 h-9 w-9 text-white shadow-lg" />
                            </>
                          )}
                        </Carousel>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="page2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-6 pb-2"
                  >
                    {/* 위치 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">장소 정보 (선택)</p>
                        <button
                          onClick={onStartLocationSelection}
                          className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                        >
                          <MapIcon className="w-3 h-3" /> 지도에서 위치 선택
                        </button>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 cursor-pointer hover:bg-indigo-100/50 transition-colors group relative">
                        <div onClick={onStartLocationSelection} className="flex flex-1 items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <MapPin className="w-5 h-5 text-indigo-600" />
                          </div>
                          <p className={cn("text-sm font-bold truncate flex-1", initialLocation ? "text-gray-800" : "text-gray-400")}>
                            {address || '위치를 선택해주세요'}
                          </p>
                        </div>
                        {initialLocation && (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (onLocationReset) onLocationReset(); setAddress('위치 없음'); }}
                            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5 text-gray-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 카테고리 */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        카테고리 선택 <span className="text-indigo-600">(필수)</span>
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat.key}
                            onClick={() => setSelectedCategory(cat.key)}
                            className={cn(
                              "flex flex-col items-center justify-center h-16 rounded-xl border-2 transition-all",
                              selectedCategory === cat.key
                                ? `border-indigo-600 bg-indigo-50`
                                : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                            )}
                          >
                            <cat.Icon className={cn("w-5 h-5", selectedCategory === cat.key ? "text-indigo-600" : "text-gray-500")} />
                            <span className={cn("text-xs font-bold mt-1", selectedCategory === cat.key ? "text-indigo-600" : "text-gray-600")}>
                              {cat.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 내용 입력 */}
                    <div className="space-y-2 flex-1 flex flex-col min-h-0 mb-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 shrink-0">
                        내용 입력 <span className="text-indigo-600">(필수)</span>
                      </p>
                      <Textarea
                        placeholder="이 장소에서의 추억을 기록해보세요..."
                        className="flex-1 min-h-[80px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 resize-none text-base font-medium mx-0.5"
                        value={draft.content}
                        onChange={(e) => postDraftStore.set({ content: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      {/* 하단 버튼 — fixed로 키보드 바로 위에 항상 고정 */}
      {isOpen && (
  <div
    className="fixed left-0 right-0 px-5 pt-3 pb-4 bg-white z-[1002] transition-all duration-150"
style={{ bottom: `${keyboardHeight + 100}px` }}
  >
          {currentPage === 1 ? (
            <Button
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all"
              onClick={handleNextPage}
              disabled={mediaFiles.length === 0}
            >
              다음
            </Button>
          ) : (
            <Button
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
              onClick={handlePost}
              disabled={!draft.content || mediaFiles.length === 0 || isLoadingAddress || isSubmitting || !selectedCategory}
            >
              {isSubmitting ? '저장 중...' : '등록하기'}
            </Button>
          )}
        </div>
      )}
    </>
  );
};

export default WritePost;