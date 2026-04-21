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

interface WritePostProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: any) => void;
  onStartLocationSelection?: () => void;
  initialLocation?: { lat: number; lng: number } | null;
}

const CATEGORIES = [
  { key: 'food', label: '맛집', Icon: Utensils, color: 'bg-orange-500' },
  { key: 'accident', label: '사고', Icon: Car, color: 'bg-red-600' },
  { key: 'place', label: '명소', Icon: TreePine, color: 'bg-green-600' },
  { key: 'animal', label: '동물', Icon: PawPrint, color: 'bg-purple-600' },
] as const;

const WritePost = ({ isOpen, onClose, onPostCreated, onStartLocationSelection, initialLocation }: WritePostProps) => {
  const { user: authUser, profile } = useAuth();
  
  const [draft, setDraft] = useState(postDraftStore.get());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const { isKeyboardOpen } = useKeyboard();
  
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = postDraftStore.subscribe(() => {
      setDraft(postDraftStore.get());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (initialLocation) {
      setIsLoadingAddress(true);
      const resolvedAddress = resolveOfflineLocationName(initialLocation.lat, initialLocation.lng);
      setAddress(resolvedAddress || `좌표: ${initialLocation.lat.toFixed(4)}, ${initialLocation.lng.toFixed(4)}`);
      setIsLoadingAddress(false);
      return;
    }

    setAddress('위치 없음');
    setIsLoadingAddress(false);
  }, [isOpen, initialLocation]);

  const takePhoto = async () => {
    try {
      setIsTakingPhoto(true);
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl
      });
      
      if (image.dataUrl) {
        postDraftStore.set({ image: image.dataUrl });
        setVideoUrl(null);
        setVideoFile(null);
      }
    } catch (error) {
      console.error('Camera error:', error);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showError('동영상 용량은 50MB를 초과할 수 없습니다.');
        return;
      }
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      postDraftStore.set({ image: null });
    }
  };

  const handlePost = async () => {
    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }

    if (!draft.image && !videoUrl) {
      showError('사진이나 동영상을 첨부해주세요.');
      return;
    }

    if (!selectedCategory) {
      showError('카테고리를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';

    // ✅ 위치 정보가 없는 경우 null로 설정하여 지도에 나타나지 않게 함
    const finalLat = initialLocation?.lat || null;
    const finalLng = initialLocation?.lng || null;
    const finalAddress = address || '위치 미지정';

    try {
      let finalVideoUrl = null;

      if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${authUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-videos')
          .upload(filePath, videoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-videos')
          .getPublicUrl(filePath);
        
        finalVideoUrl = publicUrl;
      }

      const postData: any = {
        content: draft.content,
        location_name: finalAddress,
        latitude: finalLat,
        longitude: finalLng,
        image_url: draft.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop&w=800&q=80',
        user_id: authUser.id,
        user_name: displayName,
        user_avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`,
        likes: 0,
        category: selectedCategory,
        created_at: new Date().toISOString()
      };

      // Only add video_url if it's not null to avoid issues with potential schema cache desync
      if (finalVideoUrl) {
        postData.video_url = finalVideoUrl;
      }

      const { data, error } = await supabase
        .from('posts')
        .insert([postData])
        .select();

      if (error) throw error;

      processNewPost(data[0], finalVideoUrl);

    } catch (err) {
      console.error('Error saving post:', err);
      showError('저장 중 오류가 발생했습니다.');
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
      lat: finalLat as any, // allow null for non-map posts
      lng: finalLng as any, // allow null for non-map posts
      likes: 0,
      commentsCount: 0,
      comments: [],
      image: dbPost.image_url,
      videoUrl: finalVideoUrl,
      isLiked: false,
      createdAt: new Date(),
      borderType: 'none',
      category: selectedCategory,
    };

    if (onPostCreated) onPostCreated(newPost);
    showSuccess('새로운 추억이 등록되었습니다! ✨');
    
    postDraftStore.clear();
    setVideoUrl(null);
    setVideoFile(null);
    setSelectedCategory(null);
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
            // 드로어 애니메이션 최적화
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
            <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
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
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">미디어 첨부</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={takePhoto}
                      className={cn(
                        "h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
                        draft.image ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      )}
                    >
                      <ImageIcon className={cn("w-6 h-6", draft.image ? "text-indigo-600" : "text-gray-400")} />
                      <span className={cn("text-xs font-bold", draft.image ? "text-indigo-600" : "text-gray-500")}>사진 선택</span>
                    </button>
                    <button 
                      onClick={() => videoInputRef.current?.click()}
                      className={cn(
                        "h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
                        videoUrl ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      )}
                    >
                      <Video className={cn("w-6 h-6", videoUrl ? "text-indigo-600" : "text-gray-400")} />
                      <span className={cn("text-xs font-bold", videoUrl ? "text-indigo-600" : "text-gray-500")}>동영상 선택</span>
                    </button>
                    <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />
                  </div>
                </div>

                {(draft.image || videoUrl) && (
                  <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black shadow-lg">
                    {draft.image ? (
                      <img src={draft.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <video src={videoUrl!} className="w-full h-full object-contain" controls />
                    )}
                    <button 
                      onClick={() => { postDraftStore.set({ image: null }); setVideoUrl(null); setVideoFile(null); }}
                      className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">장소 정보</p>
                    <button onClick={onStartLocationSelection} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline">
                      <MapIcon className="w-3 h-3" /> 지도에서 위치 선택
                    </button>
                  </div>
                  <div onClick={onStartLocationSelection} className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shrink-0 cursor-pointer hover:bg-indigo-100/50 transition-colors group">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <MapPin className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold truncate", initialLocation ? "text-gray-800" : "text-gray-400")}>
                        {address || '위치를 선택해주세요'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">카테고리 선택</p>
                  <div className="grid grid-cols-4 gap-2">
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
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">내용 입력</p>
                  <Textarea 
                    placeholder="이 장소에서의 추억을 기록해보세요..."
                    className="min-h-[120px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 resize-none text-base font-medium mx-0.5"
                    value={draft.content}
                    onChange={(e) => postDraftStore.set({ content: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className={cn("py-4 bg-white shrink-0 transition-all duration-300", isKeyboardOpen ? "pb-2" : "pb-[120px]")}>
              <Button 
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 mx-0.5"
                onClick={handlePost}
                disabled={(!draft.content || (!draft.image && !videoUrl)) || isTakingPhoto || isLoadingAddress || isSubmitting || !selectedCategory}
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