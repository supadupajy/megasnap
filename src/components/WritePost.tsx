"use client";

import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Camera, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess } from '@/utils/toast';

interface WritePostProps {
  isOpen: boolean;
  onClose: () => void;
}

const WritePost = ({ isOpen, onClose }: WritePostProps) => {
  const [content, setContent] = useState('');

  const handlePost = () => {
    showSuccess('게시물이 성공적으로 등록되었습니다!');
    onClose();
    setContent('');
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh]">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4" />
        <div className="px-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">새 게시물 작성</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto pb-20">
            {/* Photo Upload Placeholder */}
            <div className="aspect-video bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center">
                <Camera className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-gray-500">사진 추가하기</p>
            </div>

            {/* Location Selector */}
            <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <MapPin className="w-5 h-5 text-indigo-600" />
              <div className="flex-1">
                <p className="text-xs text-indigo-600 font-bold">현재 위치</p>
                <p className="text-sm font-medium text-gray-800">서울특별시 중구 세종대로 110</p>
              </div>
              <Button variant="ghost" size="sm" className="text-indigo-600 font-bold">변경</Button>
            </div>

            {/* Content Input */}
            <Textarea 
              placeholder="이 장소에서의 추억을 기록해보세요..."
              className="min-h-[150px] border-none bg-gray-50 rounded-2xl p-4 focus-visible:ring-indigo-600 resize-none text-base"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="absolute bottom-8 left-0 right-0 px-6">
            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-bold shadow-lg shadow-indigo-100"
              onClick={handlePost}
              disabled={!content}
            >
              게시하기
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default WritePost;