"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Camera, MapPin, X, Loader2, Map as MapIcon, Video, ImageIcon, Utensils, Car, TreePine, PawPrint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import { useKeyboard } from '@/hooks/use-keyboard';
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
  
  const [draft, setDraft] = useState(postDraftStore.get());
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>('none');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const { isKeyboardOpen } = useKeyboard();
  
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = postDraftStore.subscribe(() => {
      const currentDraft = postDraftStore.get();
      setDraft(currentDraft);
      
      // 드래프트가 비워지면(clear) 미디어 파일들도 비워줌
      if (!currentDraft.image && !currentDraft.content) {
        setMediaFiles([]);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    // 만약 사용자가 직접 선택한 위치(initialLocation)가 있다면 그 주소를 표시하고,
    // 그렇지 않은 경우에만 '위치 없음'으로 초기화합니다.
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

      if (type === 'video') {
        thumbnail = await captureVideoThumbnail(url);
      }

      return { file, url, type, thumbnail } as MediaFile;
    }));

    setMediaFiles(prev => [...prev, ...newMediaItems]);
    // 첫 이미지를 드래프트 썸네일로 설정 (호환성 유지)
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
    // 카테고리 필수 체크 해제 (이미 'none'이 기본값이거나 선택 가능하므로)
    if (!selectedCategory) { showError('카테고리를 선택해주세요.'); return; }

    setIsSubmitting(true);
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';
    const finalLat = initialLocation?.lat || null;
    const finalLng = initialLocation?.lng || null;
    const finalAddress = address || '위치 미지정';

    try {
      // 첫 번째 미디어를 대표 미디어로 처리 (현재 posts 테이블 구조 유지용)
      const primaryMedia = mediaFiles[0];
      let finalVideoUrl = null;
      let finalImageUrl = primaryMedia.type === 'image' ? primaryMedia.url : primaryMedia.thumbnail;

      // 실제 파일 업로드 로직 (대표 파일만 우선 업로드하는 간소화 버전)
      if (primaryMedia.file) {
        const timestamp = new Date().getTime();
        const folder = primaryMedia.type === 'video' ? 'post-videos' : 'post-images';
        const fileExt = primaryMedia.file.name.split('.').pop();
        const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${authUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(folder)
          .upload(filePath, primaryMedia.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(folder).getPublicUrl(filePath);
        
        if (primaryMedia.type === 'video') {
          finalVideoUrl = publicUrl;
          if (primaryMedia.thumbnail) {
            const thumbName = `thumb-${timestamp}.jpg`;
            const thumbPath = `${authUser.id}/${thumbName}`;
            const response = await fetch(primaryMedia.thumbnail);
            const blob = await response.blob();
            await supabase.storage.from('post-images').upload(thumbPath, blob, { contentType: 'image/jpeg' });
            const { data: { publicUrl: tUrl } } = supabase.storage.from('post-images').getPublicUrl(thumbPath);
            finalImageUrl = tUrl;
          }
        } else {
          finalImageUrl = publicUrl;
        }
      }

      const postData = {
        content: draft.content,
        location_name: finalAddress,
        latitude: finalLat,
        longitude: finalLng,
        image_url: finalImageUrl || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop&w=800&q=80',
        user_id: authUser.id,
        user_name: displayName,
        user_avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`,
        likes: 0,
        category: selectedCategory,
        video_url: finalVideoUrl,
        created_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase.from('posts').insert([postData]).select();
      if (insertError) throw insertError;

      processNewPost(insertData[0], finalVideoUrl);
    } catch (err: any) {
      console.error('[WritePost] Error:', err);
      showError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processNewPost = (dbPost: any, finalVideoUrl: string | null) => {
    const displayName = profile?.nickname || authUser?.email?.split('@')[0] || '탐험가';
    
    // ✅ 위치가 없는 포스팅은 지도 객체에서 제외하기 위해 null 처리
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
      image: dbPost.image_url, // DB에 저장된 실제 캡처 URL 사용
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
    onClose();

  };

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
          className={cn(
            "flex flex-col outline-none overflow-hidden bg-white z-[1001] shadow-2xl",
            isKeyboardOpen ? "h-full rounded-t-none" : "h-[92vh] rounded-t-[40px]"
          )}
          style={{ 
            bottom: 0,
            height: isKeyboardOpen ? '100%' : '92vh',
            top: 'auto',
            transition: 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), height 0.3s ease-in-out',
            willChange: 'transform'
          }}
        >
          {/* Accessibility requirements for Radix Dialog/Drawer */}
          <div className="sr-only">
            <DrawerTitle>새 게시물 작성</DrawerTitle>
            <DrawerDescription>장소를 선택하고 사진이나 동영상을 업로드하여 추억을 기록하세요.</DrawerDescription>
          </div>

          {!isKeyboardOpen && (
            <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0 pointer-events-none" />
          )}
          
          <div className={cn("px-10 flex flex-col flex-1 min-h-0", isKeyboardOpen && "pt-12")}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-indigo-600">✨</span>
                새 게시물 작성
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
              <div className="space-y-6 px-1">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  미디어 첨부 <span className="text-indigo-600">(필수)</span>
                  </p>
                  <div className="w-full">
                    <button 
                      onClick={() => mediaInputRef.current?.click()}
                      className={cn(
                        "w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
                        mediaFiles.length > 0 ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ImageIcon className={cn("w-6 h-6", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-400")} />
                        <Video className={cn("w-6 h-6", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-400")} />
                      </div>
                      <span className={cn("text-xs font-bold", mediaFiles.length > 0 ? "text-indigo-600" : "text-gray-500")}>
                        {mediaFiles.length > 0 ? `${mediaFiles.length}개의 미디어 선택됨` : '사진/동영상 선택 (다중 선택 가능)'}
                      </span>
                    </button>
                    <input
                      type="file"
                      ref={mediaInputRef}
                      className="hidden"
                      accept="image/*,video/*"
                      multiple
                      onChange={(e) => {
                        handleMediaSelect(e);
                        // ✅ 같은 파일을 다시 선택할 수 있도록 input 값을 초기화
                        e.target.value = '';
                      }}
                    />

                  </div>
                </div>

                {mediaFiles.length > 0 && (
                  <div className="relative group">
                    <Carousel className="w-full" opts={{ align: "start", containScroll: "trimSnaps" }}>
                      <CarouselContent>
                        {mediaFiles.map((media, idx) => (
                          <CarouselItem key={idx}>
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-black/5">
                              {media.type === 'image' ? (
                                <img 
                                  src={media.url} 
                                  alt={`Preview ${idx}`} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <video 
                                  src={media.url} 
                                  className="w-full h-full object-cover"
                                  controls={false}
                                  autoPlay
                                  muted
                                  loop
                                />
                              )}
                              <button
                                onClick={() => removeMedia(idx)}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      {mediaFiles.length > 1 && (
                        <>
                          <CarouselPrevious className="left-2 bg-white/80 border-none hover:bg-white" />
                          <CarouselNext className="right-2 bg-white/80 border-none hover:bg-white" />
                        </>
                      )}
                    </Carousel>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 bg-black/20 backdrop-blur-sm rounded-full">
                      {mediaFiles.map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">장소 정보 (선택)</p>
                    <button onClick={onStartLocationSelection} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline">
                      <MapIcon className="w-3 h-3" /> 지도에서 위치 선택
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shrink-0 cursor-pointer hover:bg-indigo-100/50 transition-colors group relative">
                    <div onClick={onStartLocationSelection} className="flex flex-1 items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <MapPin className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-bold truncate", initialLocation ? "text-gray-800" : "text-gray-400")}>
                          {address || '위치를 선택해주세요'}
                        </p>
                      </div>
                    </div>
                    {initialLocation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onLocationReset) onLocationReset();
                          setAddress('위치 없음');
                        }}
                        className="p-1 hover:bg-white/50 rounded-lg transition-colors z-20"
                      >
                        <X className="w-5 h-5 text-gray-400 hover:text-red-500" />
                      </button>
                    )}

                  </div>

                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
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
                            ? `border-indigo-600 ${cat.color}/20 bg-indigo-50`
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

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
  내용 입력 <span className="text-indigo-600">(필수)</span>
</p>
                  <Textarea 
                    placeholder="이 장소에서의 추억을 기록해보세요..."
                    className="min-h-[120px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 resize-none text-base font-medium mx-0.5"
                    value={draft.content}
                    onChange={(e) => postDraftStore.set({ content: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()} // 텍스트 영역 내부 드래그 시 드로어 닫힘 방지
                  />
                </div>
              </div>
            </div>

            <div className={cn("py-4 bg-white shrink-0 transition-all duration-300", isKeyboardOpen ? "pb-2" : "pb-[120px]")}>
              <Button 
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 mx-0.5"
                onClick={handlePost}
                disabled={(!draft.content || mediaFiles.length === 0) || isLoadingAddress || isSubmitting || !selectedCategory}
              >
                {isSubmitting ? '저장 중...' : '등록하기'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default WritePost;