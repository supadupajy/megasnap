"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Camera, MapPin, X, Sparkles, Loader2, Map as MapIcon, Video, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import { useKeyboard } from '@/hooks/use-keyboard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { postDraftStore } from '@/utils/post-draft-store';

interface WritePostProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: any) => void;
  onStartLocationSelection?: () => void;
  initialLocation?: { lat: number; lng: number } | null;
}

const WritePost = ({ isOpen, onClose, onPostCreated, onStartLocationSelection, initialLocation }: WritePostProps) => {
  const { user: authUser, profile } = useAuth();
  
  const [draft, setDraft] = useState(postDraftStore.get());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmitting) = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const { isKeyboardOpen } = useKeyboard();
  
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = postDraftStore.subscribe(() => {
      setDraft(postDraftStore.get());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (isOpen) {
      if (initialLocation && kakao && kakao.maps.services) {
        setIsLoadingAddress(true);
        const geocoder = new kakao.maps.services.Geocoder();
        
        geocoder.coord2Address(initialLocation.lng, initialLocation.lat, (result: any, status: any) => {
          if (status === kakao.maps.services.Status.OK && result[0]) {
            const addr = result[0].address;
            const city = addr.region_1depth_name || '';
            const district = addr.region_2depth_name || '';
            const neighborhood = addr.region_3depth_name || '';
            
            const cleanAddress = `${city} ${district} ${neighborhood}`.trim();
            setAddress(cleanAddress || '알 수 없는 장소');
          } else {
            setAddress(`좌표: ${initialLocation.lat.toFixed(4)}, ${initialLocation.lng.toFixed(4)}`);
          }
          setIsLoadingAddress(false);
        });
      } else if (!initialLocation) {
        setAddress('위치를 선택해주세요');
        setIsLoadingAddress(false);
      }
    }
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

    if (!initialLocation) {
      showError('장소를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    const displayName = profile?.nickname || authUser.email?.split('@')[0] || '탐험가';

    const postData = {
      content: draft.content,
      location_name: address,
      latitude: initialLocation.lat,
      longitude: initialLocation.lng,
      image_url: draft.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop',
      video_url: videoUrl,
      user_id: authUser.id,
      user_name: displayName,
      user_avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`,
      likes: 0,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([postData])
        .select();

      if (error) throw error;

      const newPost = {
        id: data[0].id,
        isAd: false,
        isGif: false,
        isInfluencer: false,
        user: {
          id: authUser.id,
          name: displayName,
          avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`
        },
        content: draft.content,
        location: address,
        lat: initialLocation.lat,
        lng: initialLocation.lng,
        likes: 0,
        commentsCount: 0,
        comments: [],
        image: postData.image_url,
        videoUrl: videoUrl,
        isLiked: false,
        createdAt: new Date(),
        borderType: 'none'
      };

      if (onPostCreated) onPostCreated(newPost);
      showSuccess('새로운 추억이 등록되었습니다! ✨');
      
      postDraftStore.clear();
      setVideoUrl(null);
      onClose();
    } catch (err) {
      console.error('Error saving post:', err);
      showError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} modal={true}>
      <DrawerContent className="h-[92vh] flex flex-col outline-none overflow-hidden bg-white z-[1001] shadow-2xl">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        
        <div className="px-6 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-indigo-600">✨</span>
              새 게시물 작성
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-4">
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
                  <span className={cn("text-xs font-bold", draft.image ? "text-indigo-600" : "text-gray-500")}>사진 촬영</span>
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
                  onClick={() => { postDraftStore.set({ image: null }); setVideoUrl(null); }}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">장소 정보</p>
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

            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">내용 입력</p>
              <Textarea 
                placeholder="이 장소에서의 추억을 기록해보세요..."
                className="min-h-[120px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-indigo-600 resize-none text-base font-medium mx-0.5"
                value={draft.content}
                onChange={(e) => postDraftStore.set({ content: e.target.value })}
              />
            </div>
          </div>

          <div className={cn("py-4 bg-white shrink-0 transition-all duration-300", isKeyboardOpen ? "pb-2" : "pb-[120px]")}>
            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
              onClick={handlePost}
              disabled={(!draft.content || (!draft.image && !videoUrl)) || isTakingPhoto || isLoadingAddress || isSubmitting || !initialLocation}
            >
              {isSubmitting ? '저장 중...' : '지도에 등록하기'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default WritePost;