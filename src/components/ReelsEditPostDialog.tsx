import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface ReelsEditPostDialogProps {
  isOpen: boolean;
  postId: string;
  authUserId: string | undefined;
  initialContent: string;
  onClose: () => void;
  onSaved: (postId: string, nextContent: string) => void;
}

/**
 * Reels(영상 풀스크린)에서 본문을 수정할 때 사용하는 모달.
 * 영상 위에서 인라인 편집은 시야를 가리므로 별도 다이얼로그로 처리한다.
 */
const ReelsEditPostDialog: React.FC<ReelsEditPostDialogProps> = ({
  isOpen,
  postId,
  authUserId,
  initialContent,
  onClose,
  onSaved,
}) => {
  const [value, setValue] = useState(initialContent || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setValue(initialContent || '');
  }, [isOpen, initialContent]);

  const handleSave = async () => {
    if (!authUserId) {
      showError('로그인이 필요합니다.');
      return;
    }
    const next = value.trim();
    if (!next) {
      showError('내용을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: next })
        .eq('id', postId)
        .eq('user_id', authUserId);
      if (error) throw error;
      onSaved(postId, next);
      showSuccess('포스팅이 수정되었습니다.');
      onClose();
    } catch (err) {
      showError('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="rounded-[28px] w-[90%] max-w-[400px] p-6 border-none shadow-2xl z-[20000]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-1">
            <Pencil className="w-6 h-6 text-indigo-600" />
          </div>
          <DialogTitle className="text-center text-xl font-black text-gray-900">
            포스팅 수정
          </DialogTitle>
          <DialogDescription className="text-center text-gray-500 font-bold leading-relaxed break-keep text-sm">
            본문 내용을 수정한 후 저장해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSaving}
            autoFocus
            placeholder="이 영상에 대한 이야기를 들려주세요..."
            className="min-h-[120px] resize-none rounded-2xl border-indigo-100 bg-indigo-50/40 text-sm text-gray-900 shadow-inner focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
        </div>

        <div className="flex flex-row gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !value.trim()}
            className={cn(
              'flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all',
              'disabled:bg-gray-300 disabled:shadow-none',
              'inline-flex items-center justify-center gap-2'
            )}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReelsEditPostDialog;
