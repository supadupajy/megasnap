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

interface ExitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ExitDialog = ({ isOpen, onClose, onConfirm }: ExitDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
            서비스 종료
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed break-keep">
            Chora 서비스를 종료하시겠습니까?<br />
            오늘의 추억은 안전하게 저장되었습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
          <AlertDialogCancel 
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0"
          >
            아니오
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all m-0"
          >
            예
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExitDialog;