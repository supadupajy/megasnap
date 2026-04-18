"use client";

import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Camera, MapPin, X, Sparkles, Loader2, Map as MapIcon, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import confetti from 'canvas-confetti';
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
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const { isKeyboardOpen } = useKeyboard();

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
      }
    } catch (error) {
      console.error('Camera error:', error);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handlePost = async () => {
    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }

    if (!draft.image) {
      showError('사진을 첨부해야 포스팅을 등록할 수 있습니다.');
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
      image_url: draft.image,
      user_id: authUser.id,
      user_name: displayName,
      user_avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`,
      likes: 0,
      created_at: new Date().toISOString(),
      youtube_url: youtubeUrl.trim() || null
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
        image: draft.image,
        isLiked: false,
        createdAt: new Date(),
        borderType: 'none',
        youtubeUrl: youtubeUrl.trim()
      };

      if (onPostCreated) onPostCreated(newPost);
      showSuccess('새로운 추억이 등록되었습니다! ✨');
      
      postDraftStore.clear();
      setYoutubeUrl('');
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
            <div 
              onClick={takePhoto}
              className="aspect-video bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-100 transition-all group relative overflow-hidden shrink-0"
            >
              {draft.image ? (
                <img src={draft.image} alt="Captured" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">사진 촬영하기</p>
                    <p className="text-xs text-gray-400 mt-1">지금 이 순간을 캡처하세요</p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">유튜브 링크 (선택)</p>
              <div className="relative">
                <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                <Input 
                  placeholder="https://youtube.com/..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="h-12 pl-12 rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 font-medium"
                />
              </div>
            </div>

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
                className="min-h-[120px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-indigo-600 resize-none text-base font-medium"
                value={draft.content}
                onChange={(e) => postDraftStore.set({ content: e.target.value })}
              />
            </div>
          </div>

          <div className={cn("py-4 bg-white shrink-0 transition-all duration-300", isKeyboardOpen ? "pb-2" : "pb-[120px]")}>
            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
              onClick={handlePost}
              disabled={!draft.content || isTakingPhoto || isLoadingAddress || isSubmitting || !initialLocation}
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