"use client";

import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Camera, MapPin, X, Sparkles, Loader2, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import confetti from 'canvas-confetti';
import { useKeyboard } from '@/hooks/use-keyboard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface WritePostProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: any) => void;
  onStartLocationSelection?: () => void; // 위치 선택 시작 콜백
  initialLocation?: { lat: number; lng: number } | null;
}

const WritePost = ({ isOpen, onClose, onPostCreated, onStartLocationSelection, initialLocation }: WritePostProps) => {
  const { user: authUser, profile } = useAuth();
  const [content, setContent] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const { isKeyboardOpen } = useKeyboard();

  // 선택된 좌표가 있을 경우 주소로 변환
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (isOpen) {
      if (initialLocation && kakao && kakao.maps.services) {
        setIsLoadingAddress(true);
        const geocoder = new kakao.maps.services.Geocoder();
        
        geocoder.coord2Address(initialLocation.lng, initialLocation.lat, (result: any, status: any) => {
          if (status === kakao.maps.services.Status.OK) {
            const addr = result[0].address;
            const cleanAddress = `${addr.region_1depth_name} ${addr.region_2depth_name} ${addr.region_3depth_name}`;
            setAddress(cleanAddress);
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
        setCapturedImage(image.dataUrl);
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

    if (!capturedImage) {
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
      content: content,
      location_name: address,
      latitude: initialLocation.lat,
      longitude: initialLocation.lng,
      image_url: capturedImage,
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
        content: content,
        location: address,
        lat: initialLocation.lat,
        lng: initialLocation.lng,
        likes: 0,
        commentsCount: 0,
        comments: [],
        image: capturedImage,
        isLiked: false,
        createdAt: new Date(),
        borderType: 'none'
      };

      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      if (onPostCreated) onPostCreated(newPost);
      showSuccess('새로운 추억이 등록되었습니다! ✨');
      
      // 상태 초기화
      setContent('');
      setCapturedImage(null);
      onClose();
    } catch (err) {
      console.error('Error saving post:', err);
      showError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={(open) => !open && onClose()}
      modal={true}
    >
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
            {/* 사진 촬영 영역 */}
            <div 
              onClick={takePhoto}
              className="aspect-video bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-100 transition-all group relative overflow-hidden shrink-0"
            >
              {capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
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
              {(isTakingPhoto || isSubmitting) && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* 위치 선택 영역 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">장소 정보</p>
                <button 
                  onClick={onStartLocationSelection}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                >
                  <MapIcon className="w-3 h-3" />
                  지도에서 위치 선택
                </button>
              </div>
              
              <div 
                onClick={onStartLocationSelection}
                className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shrink-0 cursor-pointer hover:bg-indigo-100/50 transition-colors group"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  {isLoadingAddress ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                      <span className="text-xs text-gray-400">주소를 불러오는 중...</span>
                    </div>
                  ) : (
                    <p className={cn("text-sm font-bold truncate", initialLocation ? "text-gray-800" : "text-gray-400")}>
                      {address || '위치를 선택해주세요'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 내용 입력 영역 */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">내용 입력</p>
              <Textarea 
                placeholder="이 장소에서의 추억을 기록해보세요..."
                className="min-h-[120px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 resize-none text-base font-medium"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          <div 
            className={cn(
              "py-4 bg-white shrink-0 transition-all duration-300",
              isKeyboardOpen ? "pb-2" : "pb-[120px]"
            )}
          >
            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
              onClick={handlePost}
              disabled={!content || isTakingPhoto || isLoadingAddress || isSubmitting || !initialLocation}
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