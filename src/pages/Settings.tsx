"use client";

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  User, 
  Lock, 
  Bell, 
  Shield, 
  HelpCircle, 
  Info, 
  LogOut,
  ChevronRight,
  Moon,
  Languages,
  Database,
  Loader2,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { 
  seedGlobalPosts, 
  randomizeExistingLikes, 
  cleanupInvalidYoutubePosts, 
  enrichExistingPostLocations, 
  seedInBoundsPosts, 
  deletePostsInBounds 
} from '@/utils/db-seeder';
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

const SettingItem = ({ icon: Icon, label, onClick, variant = "default" }: { 
  icon: any, 
  label: string, 
  onClick?: () => void,
  variant?: "default" | "danger"
}) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-none"
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        variant === "danger" ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={cn(
        "text-sm font-bold",
        variant === "danger" ? "text-red-500" : "text-gray-700"
      )}>{label}</span>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-300" />
  </button>
);

const Settings = () => {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // [NEW] 관리자 권한 확인
  React.useEffect(() => {
    if (user) {
      console.log('[Settings] Checking admin status for user:', user.email);
      const checkAdmin = async () => {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Settings] Admin check error:', error);
          return;
        }

        console.log('[Settings] Admin check result:', data);
        if (data && data.role === 'admin') {
          setIsAdmin(true);
        }
      };
      checkAdmin();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    showSuccess('로그아웃 되었습니다.');
    navigate('/login');
  };

  const handleSeedData = async () => {
    if (!user) return;
    setIsProcessing(true);
    const toastId = showLoading('대한민국 전역 데이터를 생성 중입니다...');
    try {
      const count = await seedGlobalPosts(
        user.id, 
        profile?.nickname || '탐험가', 
        profile?.avatar_url || `https://i.pravatar.cc/150?u=${user.id}`
      );
      dismissToast(toastId);
      showSuccess(`${count}개의 포스팅이 전국에 생성되었습니다! ✨`);
    } catch (err: any) {
      dismissToast(toastId);
      showError(`생성 실패: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRandomizeLikes = async () => {
    setIsProcessing(true);
    const toastId = showLoading('전체 좋아요 수치를 랜덤하게 섞는 중...');
    try {
      const count = await randomizeExistingLikes();
      dismissToast(toastId);
      showSuccess(`${count}개 포스팅의 좋아요가 무작위로 변경되었습니다! 🎲`);
    } catch (err: any) {
      dismissToast(toastId);
      showError(`수치 변경 실패: ${err.message || 'RPC 함수를 찾을 수 없거나 권한이 없습니다.'}`);
      console.error("Randomize Error Details:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanupYoutubePosts = async () => {
    setIsProcessing(true);
    const toastId = showLoading('재생 불가 유튜브 포스팅을 검수하는 중...');
    try {
      const count = await cleanupInvalidYoutubePosts();
      dismissToast(toastId);
      showSuccess(`${count}개 포스팅의 재생 불가 유튜브 링크를 정리했습니다! 🧹`);
    } catch (err: any) {
      dismissToast(toastId);
      showError(`유튜브 정리 실패: ${err.message || '알 수 없는 오류'}`);
      console.error("Cleanup YouTube Error Details:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnrichLocations = async () => {
    setIsProcessing(true);
    const toastId = showLoading('기존 포스팅의 지역명을 상세하게 보정하는 중...');
    try {
      const count = await enrichExistingPostLocations();
      dismissToast(toastId);
      showSuccess(`${count}개 포스팅의 지역명이 상세 주소 형식으로 보정되었습니다! 🗺️`);
    } catch (err: any) {
      dismissToast(toastId);
      showError(`지역명 보정 실패: ${err.message || '알 수 없는 오류'}`);
      console.error("Enrich Location Error Details:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateInView = async () => {
    if (!user) return;
    
    // Get bounds from local storage where Map component saves them
    const storedBounds = localStorage.getItem('map_bounds');
    if (!storedBounds) {
      showError('지도를 한 번 이상 확인해야 화면 범위를 알 수 있습니다. 지도로 돌아가 화면을 움직여보세요!');
      return;
    }

    setIsProcessing(true);
    const toastId = showLoading('현재 화면 내에 포스팅을 생성 중입니다...');
    try {
      const bounds = JSON.parse(storedBounds);
      const count = await seedInBoundsPosts(user.id, bounds);
      dismissToast(toastId);
      showSuccess(`현재 화면 범위 내에 ${count}개의 포스팅이 생성되었습니다! 📍`);
    } catch (err: any) {
      dismissToast(toastId);
      showError(`생성 실패: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteInView = async () => {
    const storedBounds = localStorage.getItem('map_bounds');
    if (!storedBounds) {
      showError('지도를 한 번 이상 확인해야 삭제 범위를 알 수 있습니다.');
      return;
    }

    setIsProcessing(true);
    const toastId = showLoading('현재 화면 내 포스팅을 삭제 중...');
    try {
      const bounds = JSON.parse(storedBounds);
      const count = await deletePostsInBounds(bounds);
      dismissToast(toastId);
      showSuccess(`현재 화면 범위 내 ${count}개의 포스팅이 삭제되었습니다. 🗑️`);
    } catch (err: any) {
      dismissToast(toastId);
      showError(`삭제 실패: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-white pb-10 no-scrollbar relative">
      <header className="fixed top-0 left-0 right-0 h-[64px] bg-white/80 backdrop-blur-md z-[100] flex items-center px-4 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-50 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-lg text-gray-900 mr-10">설정</h1>
      </header>

      <div className="pt-[64px]">
        <div className="px-4 py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">계정 설정</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem icon={User} label="프로필 편집" />
            <SettingItem icon={Lock} label="비밀번호 및 보안" />
            <SettingItem icon={Bell} label="알림 설정" />
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">앱 설정</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem icon={Moon} label="다크 모드" />
            <SettingItem icon={Languages} label="언어 설정" />
            <SettingItem icon={Shield} label="개인정보 보호" />
          </div>
        </div>

        {isAdmin && (
          <div className="px-4 py-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">관리자 도구</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <button 
                onClick={handleGenerateInView}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 hover:bg-indigo-50 active:bg-indigo-100 transition-colors border-b border-gray-50 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-indigo-600">현재 화면 내 포스팅 생성</span>
                    <span className="text-[10px] text-gray-400 font-medium leading-tight">지도의 현재 보이는 영역에 5개의 새로운 포스팅을 즉시 생성합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 hover:bg-rose-50 active:bg-rose-100 transition-colors border-b border-gray-50 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-rose-600">현재 화면 내 포스팅 일괄 삭제</span>
                    <span className="text-[10px] text-gray-400 font-medium leading-tight">지도의 현재 영역에 있는 모든 데이터를 DB에서 영구 삭제합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={handleSeedData}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-gray-700">전국 데이터 대량 생성</span>
                    <span className="text-[10px] text-gray-400 font-medium leading-tight">대한민국 전역에 대량의 포스팅을 골고루 배치합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={handleRandomizeLikes}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 hover:bg-orange-50 active:bg-orange-100 transition-colors border-b border-gray-50 last:border-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600">
                    <RefreshCw className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-orange-600">좋아요 수치 전체 랜덤화</span>
                    <span className="text-[10px] text-gray-400 font-medium">모든 포스팅의 좋아요를 무작위로 섞어 인기 탭을 갱신합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={handleEnrichLocations}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 hover:bg-emerald-50 active:bg-emerald-100 transition-colors border-b border-gray-50 last:border-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-emerald-600">기존 지역명 상세 보정</span>
                    <span className="text-[10px] text-gray-400 font-medium">서울/부산처럼 짧게 저장된 포스팅을 서울시 강동구 형식으로 보정합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={handleCleanupYoutubePosts}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 hover:bg-red-50 active:bg-red-100 transition-colors border-b border-gray-50 last:border-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                    <Loader2 className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-red-600">재생 불가 유튜브 링크 정리</span>
                    <span className="text-[10px] text-gray-400 font-medium">기존 포스팅의 유튜브 URL을 검수해 재생 불가 링크를 제거합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-8">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem 
              icon={LogOut} 
              label="로그아웃" 
              variant="danger" 
              onClick={() => setShowLogoutConfirm(true)}
            />
          </div>
          <p className="text-center text-[10px] text-gray-300 font-bold mt-8 uppercase tracking-tighter">
            Chora Version 1.0.0
          </p>
        </div>
      </div>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
              로그아웃
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              로그아웃 하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel 
              className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSignOut}
              className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-100 transition-all m-0"
            >
              로그아웃
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
              데이터 일괄 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              현재 화면 범위 내의 모든 포스팅이 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel 
              className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteInView}
              className="flex-1 h-12 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 shadow-lg shadow-rose-100 transition-all m-0"
            >
              삭제 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;