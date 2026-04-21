"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm }: DeleteConfirmDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* z-[2000]을 추가하여 최상단에 오도록 설정하고 포인터 이벤트 강제 활성화 */}
      <AlertDialogContent
        className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl z-[2000] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertDialogHeader className="space-y-3">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
            포스팅 삭제
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed break-keep">
            정말로 이 포스팅을 삭제하시겠습니까?<br />
            삭제된 데이터는 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
          <AlertDialogCancel
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0 cursor-pointer"
          >
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm();
            }}
            className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-100 transition-all m-0 cursor-pointer"
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  );
};

export default DeleteConfirmDialog;