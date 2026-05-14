import React, { useState } from 'react';
import { ChevronLeft, HardDrive, Trash2, Wifi, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess } from '@/utils/toast';
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

const StorageSettings = () => {
  const navigate = useNavigate();
  const [cacheSize, setCacheSize] = useState('48.3 MB');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(true);

  const handleClearCache = () => {
    setCacheSize('0 KB');
    setShowClearConfirm(false);
    showSuccess('캐시가 삭제되었습니다. 🧹');
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">저장공간 및 캐시</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5 space-y-4">
          {/* 저장공간 현황 */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">저장공간</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between py-4 px-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">캐시 데이터</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">임시 저장된 이미지 및 데이터</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-700">{cacheSize}</p>
                </div>
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center gap-3 py-4 px-4 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-sm font-bold text-red-500">캐시 삭제</span>
              </button>
            </div>
          </div>

          {/* 데이터 절약 */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">데이터 절약</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between py-4 px-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">데이터 절약 모드</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">이미지 품질을 낮춰 데이터를 절약합니다</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDataSaver(!dataSaver);
                    showSuccess(dataSaver ? '데이터 절약 모드가 꺼졌습니다.' : '데이터 절약 모드가 켜졌습니다.');
                  }}
                  className={`relative w-12 h-6 rounded-full transition-all ${dataSaver ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${dataSaver ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Image className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">동영상 자동 재생</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">피드에서 동영상을 자동으로 재생합니다</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAutoPlayVideo(!autoPlayVideo);
                    showSuccess(autoPlayVideo ? '자동 재생이 꺼졌습니다.' : '자동 재생이 켜졌습니다.');
                  }}
                  className={`relative w-12 h-6 rounded-full transition-all ${autoPlayVideo ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${autoPlayVideo ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">캐시 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              {cacheSize}의 캐시 데이터를 삭제합니다. 앱이 일시적으로 느려질 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache} className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold m-0">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StorageSettings;
