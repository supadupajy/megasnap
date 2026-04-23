"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, X, Map as MapIcon, Video, ImageIcon, Utensils, Car, TreePine, PawPrint, ChevronLeft, Loader2 } from 'lucide-react';
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

const PREVIEW_HEIGHT = 350;

const Write = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile } = useAuth();
  
  // [FIX] 위치를 선택하고 돌아오거나, 지도로 나갔다가 취소하고 돌아온 경우 2페이지(상세 정보 입력)가 보이도록 설정
  const [currentPage, setCurrentPage] = useState<1 | 2>(
    location.state?.location || location.state?.fromLocationSelection ? 2 : 1
  );
  const [draft, setDraft] = useState(postDraftStore.get());
  
  // [FIX] location.state를 통해 전달된 mediaFiles가 있으면 복구, 없으면 빈 배열
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(location.state?.mediaFiles || []);
  
  // [FIX] 컴포넌트 마운트 시 body 스크롤 고정
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const [api, setApi] = useState<any>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>('none');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const initialLocation = location.state?.location;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

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

    const newMediaItems = await Promise.all(files.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      let thumbnail = undefined;
      let orientation: 'landscape' | 'portrait' | undefined = undefined;

      if (type === 'video') {
        thumbnail = await captureVideoThumbnail(url).catch(() => undefined);
      } else {
        const img = new Image();
        img.src = url;
        await new Promise(r => img.onload = r);
        orientation = img.width >= img.height ? 'landscape' : 'portrait';
      }

      return { file, url, type, thumbnail, crop: { x: 0, y: 0 }, zoom: 1, orientation } as MediaFile;
    }));

    setMediaFiles(prev => [...prev, ...newMediaItems]);
  };

  const captureVideoThumbnail = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.onloadeddata = () => { video.currentTime = 0.5; };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      video.onerror = () => reject(new Error('Video load error'));
    });
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

      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert({
          content: draft.content,
          location_name: address || '위치 미지정',
          latitude: initialLocation?.lat || null,
          longitude: initialLocation?.lng || null,
          image_url: uploadedUrls[0],
          images: uploadedUrls,
          user_id: authUser.id,
          user_name: profile?.nickname || '탐험가',
          user_avatar: profile?.avatar_url,
          category: selectedCategory,
          video_url: mediaFiles[0].type === 'video' ? uploadedUrls[0] : null,
        })
        .select()
        .single();
        
      if (insertError) throw insertError;

      showSuccess('게시물이 등록되었습니다! ✨');
      postDraftStore.clear();
      navigate('/');
    } catch (err: any) {
      showError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* 1. 상단 헤더 공간 (88px) - 투명하게 설정하여 뒤의 HeaderAdBanner가 보이도록 함 */}
      <div className="h-[88px] w-full shrink-0 z-50 pointer-events-none" />

      {/* 2. 고정 영역: 페이지 타이틀 - 인기 포스팅 레이아웃과 동일하게 수정 */}
      <div className="shrink-0 bg-white z-40 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">
            {currentPage === 1 ? '새 게시물 작성' : '상세 정보 입력'}
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Leave your trace</p>
        </div>
        <div className="flex items-center gap-2">
          {currentPage === 2 && (
            <button onClick={() => setCurrentPage(1)} className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* 3. 실제 스크롤이 일어나는 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white pointer-events-auto">
        <div className="px-5 py-6 space-y-8 pb-40">
          {currentPage === 1 ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">미디어 첨부</p>
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className={cn(
                    "w-full h-20 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-all",
                    mediaFiles.length > 0 ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  )}
                >
                  <ImageIcon className={cn("w-6 h-6", mediaFiles.length > 0 ? "text-indigo-500" : "text-gray-400")} />
                  <span className={cn("font-bold", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-500")}>
                    {mediaFiles.length > 0 ? `${mediaFiles.length}개의 파일 선택됨` : '사진 / 동영상 선택'}
                  </span>
                </button>
                <input type="file" ref={mediaInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleMediaSelect} />
              </div>

              {mediaFiles.length > 0 && (
                <div className="aspect-square w-full rounded-[32px] overflow-hidden bg-black shadow-2xl relative">
                  <Carousel setApi={setApi} className="w-full h-full">
                    <CarouselContent className="ml-0 h-full">
                      {mediaFiles.map((media, idx) => (
                        <CarouselItem key={idx} className="pl-0 h-full relative">
                          {media.type === 'image' ? (
                            <img src={media.url} className="w-full h-full object-cover" />
                          ) : (
                            <video src={media.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                          )}
                          <button onClick={() => setMediaFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"><X className="w-4 h-4" /></button>
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
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">장소 정보</p>
                <div 
                  onClick={() => navigate('/', { 
                    state: { 
                      startSelection: true,
                      // [FIX] 현재 선택된 미디어 파일들을 유지하기 위해 state로 전달
                      mediaFiles: mediaFiles
                    } 
                  })}
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
                      onClick={() => setSelectedCategory(cat.key)}
                      className={cn(
                        "flex flex-col items-center justify-center h-20 rounded-2xl border-2 transition-all",
                        selectedCategory === cat.key ? "border-indigo-600 bg-indigo-50" : "border-gray-100 bg-white"
                      )}
                    >
                      <cat.Icon className={cn("w-6 h-6", selectedCategory === cat.key ? "text-indigo-600" : "text-gray-400")} />
                      <span className={cn("text-[10px] font-black mt-2", selectedCategory === cat.key ? "text-indigo-600" : "text-gray-500")}>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">내용 입력</p>
                <Textarea 
                  placeholder="이 장소에서의 추억을 기록해보세요." 
                  className="min-h-[150px] bg-gray-50 border-none rounded-[32px] p-6 text-base font-bold focus-visible:ring-2 focus-visible:ring-indigo-600"
                  value={draft.content}
                  onChange={(e) => postDraftStore.set({ content: e.target.value })}
                />
              </div>

              <Button 
                className="w-full h-16 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-xl shadow-indigo-100 disabled:opacity-50"
                onClick={handlePost}
                disabled={isSubmitting || !draft.content || !selectedCategory}
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