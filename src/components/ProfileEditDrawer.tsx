"use client";

import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Camera, User, Sparkles, Loader2, Type, AlignLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface ProfileEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const ProfileEditDrawer = ({ isOpen, onClose, onUpdate }: ProfileEditDrawerProps) => {
  const { user, profile } = useAuth();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setNickname(profile.nickname || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url);
    }
  }, [isOpen, profile]);

  const takePhoto = async () => {
    try {
      setIsTakingPhoto(true);
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl
      });
      
      if (image.dataUrl) {
        setAvatarUrl(image.dataUrl);
      }
    } catch (error) {
      console.error('Camera error:', error);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      showError('닉네임을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          nickname: nickname.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      showSuccess('프로필이 업데이트되었습니다! ✨');
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showError('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* DrawerContent의 z-index를 BottomNav(1000)보다 낮게 설정하여 하단바 뒤로 가도록 함 */}
      <DrawerContent className="h-[80vh] flex flex-col outline-none bg-white rounded-t-[40px] overflow-hidden z-[900]">
        {/* Handle Bar */}
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4 shrink-0" />
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="px-8 flex items-center justify-center mb-6 shrink-0">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              프로필 편집
            </h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-8 space-y-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600 shadow-xl">
                  <Avatar className="w-full h-full border-4 border-white">
                    <AvatarImage 
                      src={avatarUrl || `https://i.pravatar.cc/150?u=${user?.id || 'me'}`} 
                      className="object-cover" 
                    />
                    <AvatarFallback className="bg-gray-100">
                      <User className="w-10 h-10 text-gray-300" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <button 
                  onClick={takePhoto}
                  disabled={isTakingPhoto}
                  className="absolute bottom-0 right-0 w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white active:scale-90 transition-all"
                >
                  {isTakingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">프로필 사진 변경</p>
            </div>

            {/* Nickname Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Type className="w-4 h-4 text-gray-400" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">닉네임</p>
              </div>
              <Input 
                placeholder="새로운 닉네임을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-base font-bold shadow-inner"
                maxLength={15}
              />
            </div>

            {/* Bio Section */}
            <div className="space-y-3 pb-8">
              <div className="flex items-center gap-2 px-1">
                <AlignLeft className="w-4 h-4 text-gray-400" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">내 소개</p>
              </div>
              <Textarea 
                placeholder="나를 표현하는 한 줄 소개를 적어보세요"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[100px] rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-base font-medium resize-none p-4 shadow-inner"
                maxLength={100}
              />
              <p className="text-right text-[10px] text-gray-400 font-bold">{bio.length}/100</p>
            </div>
          </div>

          {/* Fixed Bottom Button Area - BottomNav의 높이(100px)만큼 확실히 띄워줌 */}
          <div className="px-8 pt-4 pb-[100px] bg-white shrink-0 border-t border-gray-50">
            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] text-lg font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              onClick={handleSave}
              disabled={isSubmitting || isTakingPhoto}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[3px]" />
                  변경사항 저장하기
                </>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ProfileEditDrawer;