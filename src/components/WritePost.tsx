"use client";

import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Camera, MapPin, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import confetti from 'canvas-confetti';
import { useKeyboard } from '@/hooks/use-keyboard';
import { cn } from '@/lib/utils';

interface WritePostProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: any) => void;
  initialLocation?: { lat: number; lng: number };
}

const WritePost = ({ isOpen, onClose, onPostCreated, initialLocation }: WritePostProps) => {
  const [content, setContent] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const { isKeyboardOpen } = useKeyboard();

  useEffect(() => {
    if (isOpen) {
      if (initialLocation && window.google) {
        setIsLoadingAddress(true);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: initialLocation.lat, lng: initialLocation.lng } },
          (results, status) => {
            if (status === "OK" && results && results[0]) {
              setAddress(results[0].formatted_address);
            } else {
              setAddress(`좌표: ${initialLocation.lat.toFixed(4)}, ${initialLocation.lng.toFixed(4)}`);
            }
            setIsLoadingAddress(false);
          }
        );
      } else if (!initialLocation) {
        setAddress('서울특별시 중구 세종대로 110');
        setIsLoadingAddress(false);
      }
    } else {
      setAddress('');
      setIsLoadingAddress(false);
      setContent('');
      setCapturedImage(null);
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

  const handlePost = () => {
    if (!capturedImage) {
      showError('사진을 첨부해야 포스팅을 등록할 수 있습니다.');
      return;
    }

    const lat = initialLocation?.lat || (37.5665 + (Math.random() - 0.5) * 0.01);
    const lng = initialLocation?.lng || (126.9780 + (Math.random() - 0.5) * 0.01);

    const newPost = {
      id: Math.random().toString(36).substr(2, 9),
      isAd: false,
      isGif: false,
      isInfluencer: false,
      user: {
        id: 'me',
        name: 'Dyad_Explorer',
        avatar: 'https://i.pravatar.cc/150?u=me'
      },
      content: content,
      location: address,
      lat,
      lng,
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

    showSuccess('새로운 추억이 지도에 등록되었습니다! ✨');
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[92vh] flex flex-col outline-none overflow-hidden z-[40]">
        {/* Handle Bar */}
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        
        <div className="px-6 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              새 게시물 작성
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full close-popup-btn">
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-4">
            {/* Photo Area */}
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
              {isTakingPhoto && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Location Info */}
            <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shrink-0">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <MapPin className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">선택한 위치</p>
                {isLoadingAddress ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                    <span className="text-xs text-gray-400">주소를 불러오는 중...</span>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-gray-800 truncate">{address || '위치 정보 없음'}</p>
                )}
              </div>
            </div>

            {/* Content Input */}
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

          {/* Bottom Button Area - Adjusted for BottomNav visibility */}
          <div 
            className={cn(
              "py-4 bg-white shrink-0 transition-all duration-300",
              isKeyboardOpen ? "pb-2" : "pb-[120px]"
            )}
          >
            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
              onClick={handlePost}
              disabled={!content || isTakingPhoto || isLoadingAddress}
            >
              지도에 등록하기
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default WritePost;