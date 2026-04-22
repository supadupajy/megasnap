"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Camera, MapPin, X, Loader2, Map as MapIcon, Video, ImageIcon, Utensils, Car, TreePine, PawPrint, ChevronLeft } from 'lucide-react';
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
}

const CATEGORIES = [
  { key: 'none', label: '없음', Icon: X, color: 'bg-gray-500' },
  { key: 'food', label: '맛집', Icon: Utensils, color: 'bg-orange-500' },
  { key: 'accident', label: '사고', Icon: Car, color: 'bg-red-600' },
  { key: 'place', label: '명소', Icon: TreePine, color: 'bg-green-600' },
  { key: 'animal', label: '동물', Icon: PawPrint, color: 'bg-purple-600' },
] as const;

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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => setVisualViewportHeight(vv.height);
    vv.addEventListener('resize', handleResize);
    handleResize();
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = postDraftStore.subscribe(() => {
      const currentDraft = postDraftStore.get();
      setDraft(currentDraft);
      if (!currentDraft.image && !currentDraft.content && mediaFiles.length === 0) {
        setCurrentPage(1);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [mediaFiles.length]);

  useEffect(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    api.on("select", () => setCurrentSlide(api.selectedScrollSnap()));
  }, [api]);

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

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMediaItems = await Promise.all(files.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      let thumbnail = undefined;
      if (type === 'video') thumbnail = await captureVideoThumbnail(url);
      return { file, url, type, thumbnail, crop: { x: 0, y: 0 }, zoom: 1 } as MediaFile;
    }));

    setMediaFiles(prev => [...prev, ...newMediaItems]);
    if (newMediaItems[0].type === 'image') {
      postDraftStore.set({ image: newMediaItems[0].url });
    } else if (newMediaItems[0].thumbnail) {
      postDraftStore.set({ image: newMediaItems[0].thumbnail });
    }
  };

  const captureVideoThumbnail = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.onloadeddata = () => { video.currentTime = 0.5; };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) postDraftStore.set({ image: null });
      return updated;
    });
  };

  const handlePost = async () => {
    if (!authUser) { showError('로그인이 필요합니다.'); return; }
    if (mediaFiles.length === 0) { showError('사진이나 동영상을 첨부해주세요.'); return; }
    if (!selectedCategory) { showError('카테고리를 선택해주세요.'); return; }

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

      const postData = {
        content: draft.content,
        location_name: address || '위치 미지정',
        latitude: initialLocation?.lat || null,
        longitude: initialLocation?.lng || null,
        image_url: uploadedUrls[0],
        images: uploadedUrls,
        user_id: authUser.id,
        user_name: profile?.nickname || authUser.email?.split('@')[0] || '탐험가',
        user_avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`,
        likes: 0,
        category: selectedCategory,
        video_url: mediaFiles[0].type === 'video' ? uploadedUrls[0] : null,
        created_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase.from('posts').insert(postData).select('*').single();
      if (insertError) throw insertError;
      processNewPost(insertData, postData.video_url);
    } catch (err: any) {
      showError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processNewPost = (dbPost: any, finalVideoUrl: string | null) => {
    if (onPostCreated) onPostCreated({
      ...dbPost,
      user: { id: authUser!.id, name: dbPost.user_name, avatar: dbPost.user_avatar },
      createdAt: new Date(dbPost.created_at)
    });
    showSuccess('새로운 추억이 등록되었습니다! ✨');
    postDraftStore.clear();
    setMediaFiles([]);
    setSelectedCategory('none');
    setCurrentPage(1);
    onClose();
  };

  const isKeyboardOpen = visualViewportHeight !== null && visualViewportHeight < window.innerHeight * 0.8;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-[1px]" onClick={onClose} />
        )}
      </AnimatePresence>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
        <DrawerContent 
          className={cn("flex flex-col outline-none overflow-hidden bg-white z-[1001] shadow-2xl", isKeyboardOpen ? "h-full rounded-t-none" : "h-[92vh] rounded-t-[40px]")}
          style={{ 
            bottom: 0,
            height: isKeyboardOpen && visualViewportHeight ? `${visualViewportHeight}px` : (isKeyboardOpen ? '100%' : '92vh'),
            top: isKeyboardOpen ? 0 : 'auto',
            transition: 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), height 0.3s ease-in-out',
            willChange: 'transform'
          }}
        >
          <div className="sr-only"><DrawerTitle>새 게시물 작성</DrawerTitle><DrawerDescription>추억을 기록하세요.</DrawerDescription></div>
          {!isKeyboardOpen && <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0 pointer-events-none" />}
          <div className={cn("px-10 flex flex-col flex-1 min-h-0", isKeyboardOpen && "pt-6")}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                {currentPage === 2 && <Button variant="ghost" size="icon" onClick={() => setCurrentPage(1)} className="rounded-full -ml-2"><ChevronLeft className="w-6 h-6 text-gray-800" /></Button>}
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><span className="text-indigo-600">✨</span>{currentPage === 1 ? '새 게시물 작성' : '상세 정보 입력'}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="w-5 h-5 text-gray-400" /></Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {currentPage === 1 ? (
                  <motion.div key="page1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full space-y-4 px-1">
                    <div className="space-y-3 shrink-0">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">미디어 첨부 <span className="text-indigo-600">(필수)</span></p>
                      <button onClick={() => mediaInputRef.current?.click()} className={cn("w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-300 h-[80px]", mediaFiles.length > 0 ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100")}>
                        <div className="flex items-center gap-3"><ImageIcon className={cn("w-5 h-5", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-400")} /><Video className={cn("w-5 h-5", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-400")} /></div>
                        <span className={cn("font-bold", mediaFiles.length > 0 ? "text-[11px] text-indigo-600" : "text-xs text-gray-500")}>{mediaFiles.length > 0 ? `${mediaFiles.length}개의 미디어 선택됨 (추가 가능)` : '사진/동영상 선택 (다중 선택 가능)'}</span>
                      </button>
                      <input type="file" ref={mediaInputRef} className="hidden" accept="image/*,video/*" multiple onChange={(e) => { handleMediaSelect(e); e.target.value = ''; }} />
                    </div>
                    <div className="flex-1 min-h-0 mb-2 relative rounded-2xl overflow-hidden border border-gray-100 bg-white">
                      <div className="absolute inset-0 w-full h-full">
                        {mediaFiles.length > 0 ? (
                          <Carousel setApi={setApi} className="w-full h-full" opts={{ align: "start", containScroll: "trimSnaps", watchDrag: !isDragging }}>
                            <CarouselContent className="h-full ml-0">
                              {mediaFiles.map((media, idx) => (
                                <CarouselItem key={`${media.url}-${idx}`} className="h-full pl-0">
                                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-white">
                                    {media.type === 'image' ? (
                                      <div className="w-full h-full relative p-3">
                                        <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-gray-50 flex items-center justify-center">
                                          <img src={media.url} alt="preview" className="absolute transition-none select-none pointer-events-none z-10 max-w-none max-h-none" style={{ width: 'auto', height: 'auto', minWidth: '100%', minHeight: '100%', top: '50%', left: '50%', transform: `translate(calc(-50% + ${media.crop?.x || 0}px), calc(-50% + ${media.crop?.y || 0}px)) scale(${media.zoom || 1})`, objectFit: 'none' }} />
                                          <div className="absolute inset-0 z-30 cursor-move touch-none bg-transparent" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); (e.target as HTMLElement).setPointerCapture(e.pointerId); }} onPointerMove={(e) => {
                                            if (!isDragging) return;
                                            const target = e.currentTarget;
                                            const imgElement = target.previousElementSibling as HTMLImageElement;
                                            if (!imgElement) return;
                                            const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight;
                                            let dW, dH;
                                            if (imgAspect > 1) { dH = target.clientHeight; dW = target.clientHeight * imgAspect; }
                                            else { dW = target.clientWidth; dH = target.clientWidth / imgAspect; }
                                            const deltaX = e.clientX - dragStart.x;
                                            const deltaY = e.clientY - dragStart.y;
                                            setMediaFiles(prev => prev.map((m, i) => {
                                              if (i !== idx) return m;
                                              let nX = (m.crop?.x || 0) + deltaX;
                                              let nY = (m.crop?.y || 0) + deltaY;
                                              if (dW > target.clientWidth) { const mAX = (dW - target.clientWidth) / 2; nX = Math.max(-mAX, Math.min(mAX, nX)); } else nX = 0;
                                              if (dH > target.clientHeight) { const mAY = (dH - target.clientHeight) / 2; nY = Math.max(-mAY, Math.min(mAY, nY)); } else nY = 0;
                                              return { ...m, crop: { x: nX, y: nY } };
                                            }));
                                            setDragStart({ x: e.clientX, y: e.clientY });
                                          }} onPointerUp={(e) => { setIsDragging(false); (e.target as HTMLElement).releasePointerCapture(e.pointerId); }} onPointerCancel={() => setIsDragging(false)} />
                                        </div>
                                      </div>
                                    ) : <video src={media.url} className="w-full h-full object-cover" autoPlay muted loop />}
                                    <button onClick={() => removeMedia(idx)} className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white z-[100]"><X className="w-4 h-4" /></button>
                                    {mediaFiles.length > 1 && <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1.5 z-40 pointer-events-none">{mediaFiles.map((_, i) => <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-md", currentSlide === i ? "bg-white w-4" : "bg-white/40")} />)}</div>}
                                  </div>
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                            {mediaFiles.length > 1 && <><CarouselPrevious className="left-6 bg-white/30 border-none hover:bg-white/50 z-20 h-10 w-10 text-white shadow-lg flex" /><CarouselNext className="right-6 bg-white/30 border-none hover:bg-white/50 z-20 h-10 w-10 text-white shadow-lg flex" /></>}
                          </Carousel>
                        ) : <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-50"><div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm"><ImageIcon className="w-8 h-8 text-gray-200" /></div><p className="text-sm font-black text-gray-300 tracking-tighter">미리보기 영역</p></div>}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="page2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col h-full space-y-6 px-1">
                    <div className="space-y-3 shrink-0">
                      <div className="flex items-center justify-between px-1"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">장소 정보 (선택)</p><button onClick={onStartLocationSelection} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline"><MapIcon className="w-3 h-3" /> 지도에서 위치 선택</button></div>
                      <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shrink-0 cursor-pointer hover:bg-indigo-100/50 transition-colors group relative" onClick={onStartLocationSelection}>
                        <div className="flex flex-1 items-center gap-3 min-w-0"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><MapPin className="w-5 h-5 text-indigo-600" /></div><div className="flex-1 min-w-0"><p className={cn("text-sm font-bold truncate", initialLocation ? "text-gray-800" : "text-gray-400")}>{address || '위치를 선택해주세요'}</p></div></div>
                        {initialLocation && <button onClick={(e) => { e.stopPropagation(); if (onLocationReset) onLocationReset(); setAddress('위치 없음'); }} className="p-1 hover:bg-white/50 rounded-lg transition-colors z-20"><X className="w-5 h-5 text-gray-400 hover:text-red-500" /></button>}
                      </div>
                    </div>
                    <div className="space-y-3 shrink-0"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">카테고리 선택 <span className="text-indigo-600">(필수)</span></p><div className="grid grid-cols-5 gap-2">{CATEGORIES.map((cat) => <button key={cat.key} onClick={() => setSelectedCategory(cat.key)} className={cn("flex flex-col items-center justify-center h-16 rounded-xl border-2 transition-all", selectedCategory === cat.key ? `border-indigo-600 ${cat.color}/20 bg-indigo-50` : "border-gray-200 bg-gray-50 hover:bg-gray-100")}><cat.Icon className={cn("w-5 h-5", selectedCategory === cat.key ? "text-indigo-600" : "text-gray-500")} /><span className={cn("text-xs font-bold mt-1", selectedCategory === cat.key ? "text-indigo-600" : "text-gray-600")}>{cat.label}</span></button>)}</div></div>
                    <div className="space-y-2 flex-1 flex flex-col min-h-0 mb-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 shrink-0">내용 입력 <span className="text-indigo-600">(필수)</span></p>
                      <Textarea placeholder="기록해보세요..." className="flex-1 min-h-0 border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-indigo-600 resize-none text-base font-medium mx-0.5" value={draft.content} onChange={(e) => postDraftStore.set({ content: e.target.value })} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onFocus={(e) => e.stopPropagation()} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className={cn("py-4 bg-white shrink-0 transition-all duration-300", isKeyboardOpen ? "pb-4" : "pb-[120px]")}>
              {currentPage === 1 ? <Button className="w-full h-14 bg-indigo-600 text-white rounded-2xl text-lg font-bold" onClick={() => { if (mediaFiles.length > 0) setCurrentPage(2); else showError('사진을 선택해주세요.'); }} disabled={mediaFiles.length === 0}>다음</Button> : <Button className="w-full h-14 bg-indigo-600 text-white rounded-2xl text-lg font-bold" onClick={handlePost} disabled={!draft.content || isSubmitting || !selectedCategory}>{isSubmitting ? '저장 중...' : '등록하기'}</Button>}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default WritePost;