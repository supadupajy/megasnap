"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Camera,
  User,
  Loader2,
  Type,
  AlignLeft,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError } from '@/utils/toast';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';

const NICKNAME_COOLDOWN_DAYS = 30;

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  // Nickname availability states
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'none' | 'available' | 'taken' | 'invalid'>('none');
  const [nicknameMessage, setNicknameMessage] = useState('');

  // Nickname cooldown
  const [nicknameChangedAt, setNicknameChangedAt] = useState<string | null>(null);

  const nicknameCooldownInfo = (() => {
    if (!nicknameChangedAt) return null;
    const changedDate = new Date(nicknameChangedAt);
    const nextAllowed = new Date(changedDate.getTime() + NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    if (now >= nextAllowed) return null;
    const diffMs = nextAllowed.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { daysLeft: diffDays, nextAllowed };
  })();

  const isNicknameLocked = nicknameCooldownInfo !== null;

  // 초기값 세팅 + 닉네임 변경 시점 로드
  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname || '');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url);
    setNicknameStatus('none');
    setNicknameMessage('');

    supabase
      .from('profiles')
      .select('nickname_changed_at')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        setNicknameChangedAt(data?.nickname_changed_at ?? null);
      });
  }, [profile]);

  // Debounced nickname check
  useEffect(() => {
    let isMounted = true;
    const checkNickname = async () => {
      const trimmed = nickname.trim();

      if (!trimmed || trimmed === profile?.nickname) {
        setNicknameStatus('none');
        setNicknameMessage('');
        return;
      }

      if (trimmed.length < 2) {
        setNicknameStatus('invalid');
        setNicknameMessage('닉네임은 2자 이상이어야 합니다.');
        return;
      }

      setIsCheckingNickname(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .ilike('nickname', trimmed)
          .maybeSingle();

        if (error) throw error;

        if (isMounted) {
          if (data) {
            setNicknameStatus('taken');
            setNicknameMessage('이미 사용 중인 닉네임입니다.');
          } else {
            setNicknameStatus('available');
            setNicknameMessage('사용 가능한 닉네임입니다.');
          }
        }
      } catch (err) {
        console.error('Error checking nickname:', err);
      } finally {
        if (isMounted) setIsCheckingNickname(false);
      }
    };

    const timer = setTimeout(checkNickname, 500);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [nickname, profile?.nickname]);

  // Base64 DataUrl → Blob 변환 헬퍼
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  };

  const takePhoto = async () => {
    if (!user) return;
    try {
      setIsTakingPhoto(true);

      const image = await CapCamera.getPhoto({
        quality: 70,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
      });

      if (!image.base64String) return;

      const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
      const blob = dataUrlToBlob(dataUrl);

      if (blob.size > 2 * 1024 * 1024) {
        showError('이미지 크기가 너무 큽니다. 2MB 이하의 이미지를 선택해주세요.');
        return;
      }

      const fileName = `avatars/${user.id}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        showError('이미지 업로드에 실패했습니다.');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        setAvatarUrl(urlData.publicUrl);
        showSuccess('프로필 사진이 업로드되었습니다.');
      }
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('cancel')) return;
      console.error('Camera error:', error);
      showError('사진을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      showError('닉네임을 입력해주세요.');
      return;
    }

    if (nicknameStatus === 'taken') {
      showError('이미 사용 중인 닉네임입니다.');
      return;
    }

    if (nicknameStatus === 'invalid') {
      showError('유효하지 않은 닉네임입니다.');
      return;
    }

    const nicknameChanged = trimmedNickname !== profile?.nickname;

    if (nicknameChanged && isNicknameLocked) {
      showError(`닉네임은 ${nicknameCooldownInfo!.daysLeft}일 후에 변경할 수 있습니다.`);
      return;
    }

    const safeAvatarUrl = avatarUrl?.startsWith('data:image')
      ? '/placeholder.svg'
      : avatarUrl;

    setIsSubmitting(true);
    try {
      const updatePayload: Record<string, unknown> = {
        id: user.id,
        nickname: trimmedNickname,
        bio: bio.trim(),
        avatar_url: safeAvatarUrl,
        updated_at: new Date().toISOString(),
      };

      if (nicknameChanged) {
        updatePayload.nickname_changed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(updatePayload);

      if (error) throw error;

      showSuccess('프로필이 업데이트되었습니다! ✨');
      await refreshProfile();
      // navigate(-1) 대신 명시적으로 /profile로 이동.
      // 이전 페이지 로직(-1)에 의존하면 history 상태에 따라 지도(/)로 튕길 수 있고,
      // Index 페이지가 다시 보여질 때 routeState 정리 등으로 카메라가 의도치 않게
      // 좌상단(기본 위치)으로 이동되는 부작용이 발생할 수 있어 직접 경로를 지정한다.
      navigate('/profile', { replace: true });
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showError('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="h-screen min-h-0 w-full max-w-full overflow-hidden bg-white flex flex-col"
      style={{
        paddingTop: '4rem',
        paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Page Header (PostSearch와 동일한 뒤로가기 버튼 스타일) */}
      <div className="shrink-0 bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={() => navigate('/profile', { replace: true })}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">프로필 편집</h2>
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain px-6 pt-6 pb-28 space-y-7">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600 shadow-xl">
              <Avatar className="w-full h-full border-4 border-white">
                <AvatarImage
                  src={avatarUrl || '/placeholder.svg'}
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

        {/* Nickname */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-gray-400" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">닉네임</p>
            </div>
            {isCheckingNickname && !isNicknameLocked && (
              <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
            )}
            {isNicknameLocked && (
              <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                🔒 {nicknameCooldownInfo!.daysLeft}일 후 변경 가능
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              placeholder="새로운 닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => !isNicknameLocked && setNickname(e.target.value)}
              readOnly={isNicknameLocked}
              className={cn(
                "h-12 rounded-2xl bg-gray-50 border-none focus-visible:ring-2 text-base font-bold shadow-inner transition-all",
                isNicknameLocked
                  ? "opacity-60 cursor-not-allowed focus-visible:ring-amber-400"
                  : nicknameStatus === 'available' ? "focus-visible:ring-green-500" :
                    nicknameStatus === 'taken' || nicknameStatus === 'invalid' ? "focus-visible:ring-red-500" :
                    "focus-visible:ring-indigo-600"
              )}
              maxLength={15}
            />
            {!isNicknameLocked && nicknameStatus !== 'none' && (
              <div className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2",
                nicknameStatus === 'available' ? "text-green-500" : "text-red-500"
              )}>
                {nicknameStatus === 'available' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
            )}
          </div>
          {isNicknameLocked ? (
            <p className="text-[11px] font-bold px-1 text-amber-600 animate-in fade-in slide-in-from-top-1">
              닉네임은 변경 후 {NICKNAME_COOLDOWN_DAYS}일이 지나야 다시 변경할 수 있습니다.
            </p>
          ) : nicknameMessage ? (
            <p className={cn(
              "text-[11px] font-bold px-1 animate-in fade-in slide-in-from-top-1",
              nicknameStatus === 'available' ? "text-green-600" : "text-red-600"
            )}>
              {nicknameMessage}
            </p>
          ) : null}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlignLeft className="w-4 h-4 text-gray-400" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">내 소개</p>
          </div>
          <Textarea
            placeholder="나를 표현하는 한 줄 소개를 적어보세요"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="min-h-[120px] rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-base font-medium resize-none p-4 shadow-inner"
            maxLength={100}
          />
          <p className="text-right text-[10px] text-gray-400 font-bold">{bio.length}/100</p>
        </div>

        {/* Save Button (내 소개 아래, 스크롤 영역 내부에 위치하여 함께 스크롤됨) */}
        <div className="pt-2">
          <Button
            className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-[20px] text-base font-black shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-between px-5"
            onClick={handleSave}
            disabled={isSubmitting || isTakingPhoto}
          >
            <span>{isSubmitting ? '저장 중...' : '변경사항 저장하기'}</span>
            <div className="w-9 h-9 rounded-full bg-amber-400 text-gray-900 flex items-center justify-center shrink-0">
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3px]" />
              )}
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;