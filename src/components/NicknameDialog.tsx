"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from './AuthProvider';

interface NicknameDialogProps {
  isOpen: boolean;
  userId: string;
  onComplete: (nickname: string) => void;
}

const NicknameDialog = ({ isOpen, userId, onComplete }: NicknameDialogProps) => {
  const { updateProfileState } = useAuth();
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      showError('닉네임을 입력해주세요.');
      return;
    }

    if (!userId) {
      showError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          nickname: trimmedNickname,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) throw error;

      // 컨텍스트 상태를 즉시 업데이트하여 팝업이 다시 뜨지 않도록 함
      updateProfileState({ nickname: trimmedNickname });
      
      showSuccess('닉네임 설정이 완료되었습니다!');
      onComplete(trimmedNickname);
    } catch (err: any) {
      console.error('Error saving nickname:', err);
      showError(err.message || '닉네임 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl [&>button]:hidden" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-gray-900 text-center">반가워요! 👋</DialogTitle>
          <DialogDescription className="text-center font-medium text-gray-500">
            Chora에서 사용할 멋진 닉네임을 정해주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <Input
            placeholder="닉네임 입력 (예: 탐험가제이)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="h-14 rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-lg font-bold"
            maxLength={15}
            disabled={isSubmitting}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !nickname.trim()}
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-100 transition-all"
          >
            {isSubmitting ? '저장 중...' : '시작하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NicknameDialog;