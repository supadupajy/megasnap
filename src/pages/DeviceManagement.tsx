import React, { useState } from 'react';
import { ChevronLeft, Smartphone, LogOut, Shield } from 'lucide-react';
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

interface DeviceSession {
  id: string;
  name: string;
  isCurrent: boolean;
}

const DeviceManagement = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [targetDevice, setTargetDevice] = useState<string | null>(null);
  const [showLogoutAll, setShowLogoutAll] = useState(false);

  const handleLogoutDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    setTargetDevice(null);
    showSuccess('해당 기기에서 로그아웃되었습니다.');
  };

  const handleLogoutAll = () => {
    setDevices(prev => prev.filter(d => d.isCurrent));
    setShowLogoutAll(false);
    showSuccess('다른 모든 기기에서 로그아웃되었습니다.');
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">로그인 기기 관리</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5 space-y-4">
          <p className="text-[13px] text-gray-400 font-medium px-1">
            현재 계정에 로그인된 기기 목록입니다. 실제 세션 데이터가 연결되면 이 화면에 표시됩니다.
          </p>

          {devices.length === 0 ? (
            <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-indigo-500" />
              </div>
              <h2 className="text-base font-black text-gray-900">표시할 로그인 기기가 없습니다</h2>
              <p className="text-sm text-gray-500 font-medium leading-relaxed mt-2">
                목업 기기 목록은 제거했고, 실제 세션 연동 전까지는 빈 상태로 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {devices.map((device, idx) => (
                <div
                  key={device.id}
                  className={`flex items-center justify-between py-4 px-4 ${idx < devices.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${device.isCurrent ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-800">{device.name}</p>
                        {device.isCurrent && (
                          <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">현재 기기</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!device.isCurrent && (
                    <button
                      onClick={() => setTargetDevice(device.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      로그아웃
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {devices.filter(d => !d.isCurrent).length > 0 && (
            <button
              onClick={() => setShowLogoutAll(true)}
              className="w-full py-3.5 rounded-2xl bg-red-50 text-red-500 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all border border-red-100"
            >
              다른 모든 기기에서 로그아웃
            </button>
          )}
        </div>
      </div>

      <AlertDialog open={!!targetDevice} onOpenChange={() => setTargetDevice(null)}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">기기 로그아웃</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              해당 기기에서 로그아웃하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => targetDevice && handleLogoutDevice(targetDevice)} className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold m-0">로그아웃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLogoutAll} onOpenChange={setShowLogoutAll}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">전체 로그아웃</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              현재 기기를 제외한 모든 기기에서 로그아웃됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoutAll} className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold m-0">전체 로그아웃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeviceManagement;
