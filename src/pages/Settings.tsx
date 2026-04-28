"use client";

import React, { useState } from 'react';
import {
  Lock,
  Bell,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Languages,
  Database,
  RefreshCw,
  MapPin,
  Megaphone,
  Tv2,
  Bug,
  User,
  Smartphone,
  CreditCard,
  HelpCircle,
  FileText,
  Building2,
  Trash2,
  Moon,
  HardDrive,
  MessageSquare,
  BookOpen,
  Link2,
  Receipt,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError, showLoading, dismissToast, showInfo } from '@/utils/toast';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const SettingItem = ({ icon: Icon, label, sublabel, onClick, variant = "default", iconBg, iconColor, wip }: {
  icon: any,
  label: string,
  sublabel?: string,
  onClick?: () => void,
  variant?: "default" | "danger",
  iconBg?: string,
  iconColor?: string,
  wip?: boolean,
}) => {
  const handleClick = () => {
    if (wip) {
      showInfo('아직 개발 중인 기능입니다.');
      return;
    }
    onClick?.();
  };
  return (
  <button
    onClick={handleClick}
    className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-none"
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center",
        iconBg || (variant === "danger" ? "bg-red-50" : "bg-gray-100"),
        iconColor || (variant === "danger" ? "text-red-500" : "text-gray-600")
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col items-start text-left">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-sm font-bold",
            variant === "danger" ? "text-red-500" : "text-gray-800"
          )}>{label}</span>
          {wip && (
            <span className="text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">개발 중</span>
          )}
        </div>
        {sublabel && <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">{sublabel}</span>}
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
  </button>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{title}</p>
);

const Settings = () => {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showRandomizeConfirm, setShowRandomizeConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugContent, setBugContent] = useState('');

  React.useEffect(() => {
    if (user) {
      const checkAdmin = async () => {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (!error && data && data.role === 'admin') {
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateInView = async () => {
    if (!user) return;
    const storedBounds = localStorage.getItem('map_bounds');
    if (!storedBounds) {
      showError('지도를 한 번 이상 확인해야 화면 범위를 알 수 있습니다.');
      return;
    }
    setIsProcessing(true);
    const toastId = showLoading('현재 화면 안에 포스팅을 생성 중입니다...');
    try {
      const bounds = JSON.parse(storedBounds);
      const count = await seedInBoundsPosts(user.id, bounds, profile?.nickname);
      dismissToast(toastId);
      showSuccess(`현재 화면 안에 ${count}개의 포스팅이 생성되었습니다! 📍`);
      window.dispatchEvent(new CustomEvent('refresh-map-data'));
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

  const handleBugReport = () => {
    if (!bugContent.trim()) {
      showError('버그 내용을 입력해주세요.');
      return;
    }
    const subject = encodeURIComponent('[Chora 버그 신고]');
    const body = encodeURIComponent(bugContent.trim());
    window.location.href = `mailto:chorasnap@gmail.com?subject=${subject}&body=${body}`;
    setShowBugReport(false);
    setBugContent('');
    showSuccess('이메일 앱이 열립니다. 전송해주세요!');
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 relative flex flex-col">
      {/* 타이틀 바 */}
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">설정</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">

        {/* ── 계정 설정 ── */}
        <div className="px-4 pt-5 pb-1">
          <SectionHeader title="계정 설정" />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem
              icon={Lock}
              label="비밀번호 변경 및 보안"
              sublabel="비밀번호, 2단계 인증"
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
              onClick={() => navigate('/settings/password')}
            />
            <SettingItem
              icon={Link2}
              label="연결된 소셜 계정"
              sublabel="구글, 카카오 등 소셜 로그인 연동"
              iconBg="bg-sky-50"
              iconColor="text-sky-500"
              onClick={() => navigate('/settings/connected-accounts')}
              wip
            />
            <SettingItem
              icon={Smartphone}
              label="로그인 기기 관리"
              sublabel="현재 로그인된 기기 확인 및 원격 로그아웃"
              iconBg="bg-violet-50"
              iconColor="text-violet-500"
              onClick={() => navigate('/settings/devices')}
              wip
            />
            <SettingItem
              icon={Bell}
              label="알림 설정"
              sublabel="푸시, 이메일, 마케팅 알림 관리"
              iconBg="bg-amber-50"
              iconColor="text-amber-500"
              onClick={() => navigate('/settings/notifications')}
            />
          </div>
        </div>

        {/* ── 구독 & 결제 ── */}
        <div className="px-4 pt-4 pb-1">
          <SectionHeader title="구독 & 결제" />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem
              icon={CreditCard}
              label="구독 플랜 관리"
              sublabel="현재 플랜 확인 및 업그레이드"
              iconBg="bg-emerald-50"
              iconColor="text-emerald-500"
              onClick={() => navigate('/settings/subscription')}
              wip
            />
            <SettingItem
              icon={Receipt}
              label="결제 내역"
              sublabel="영수증 및 결제 기록 확인"
              iconBg="bg-teal-50"
              iconColor="text-teal-500"
              onClick={() => navigate('/settings/billing')}
              wip
            />
          </div>
        </div>

        {/* ── 앱 설정 ── */}
        <div className="px-4 pt-4 pb-1">
          <SectionHeader title="앱 설정" />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem
              icon={Languages}
              label="언어 설정"
              sublabel="앱 표시 언어 변경"
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
              onClick={() => navigate('/settings/language')}
              wip
            />
            <SettingItem
              icon={Moon}
              label="다크 모드"
              sublabel="화면 테마 설정"
              iconBg="bg-slate-100"
              iconColor="text-slate-500"
              onClick={() => navigate('/settings/appearance')}
              wip
            />
            <SettingItem
              icon={HardDrive}
              label="저장공간 및 캐시"
              sublabel="캐시 삭제, 데이터 절약 모드"
              iconBg="bg-gray-100"
              iconColor="text-gray-500"
              onClick={() => navigate('/settings/storage')}
            />
            <SettingItem
              icon={Shield}
              label="개인정보 보호"
              sublabel="차단 목록, 활동 공개 범위"
              iconBg="bg-rose-50"
              iconColor="text-rose-500"
              onClick={() => navigate('/settings/privacy')}
            />
          </div>
        </div>

        {/* ── 고객 지원 ── */}
        <div className="px-4 pt-4 pb-1">
          <SectionHeader title="고객 지원" />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem
              icon={BookOpen}
              label="공지사항"
              sublabel="서비스 업데이트 및 점검 안내"
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
              onClick={() => navigate('/settings/notices')}
            />
            <SettingItem
              icon={HelpCircle}
              label="자주 묻는 질문 (FAQ)"
              sublabel="궁금한 점을 빠르게 해결하세요"
              iconBg="bg-cyan-50"
              iconColor="text-cyan-500"
              onClick={() => navigate('/settings/faq')}
            />
            <SettingItem
              icon={MessageSquare}
              label="1:1 문의"
              sublabel="직접 문의하기"
              iconBg="bg-indigo-50"
              iconColor="text-indigo-500"
              onClick={() => navigate('/settings/inquiry')}
            />
            <SettingItem
              icon={Bug}
              label="버그 신고"
              sublabel="불편한 점을 알려주세요"
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
              onClick={() => setShowBugReport(true)}
            />
          </div>
        </div>

        {/* ── 광고 ── */}
        <div className="px-4 pt-4 pb-1">
          <SectionHeader title="광고" />
          <div className="bg-white rounded-2xl border-2 border-pink-300 overflow-hidden shadow-sm">
            <SettingItem
              icon={Megaphone}
              label="광고 문의"
              sublabel="ChoraSnap에 광고를 게재하세요"
              iconBg="bg-pink-50"
              iconColor="text-pink-500"
              onClick={() => navigate('/settings/ad')}
            />
          </div>
        </div>

        {/* ── 법적 고지 ── */}
        <div className="px-4 pt-4 pb-1">
          <SectionHeader title="법적 고지" />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem
              icon={FileText}
              label="개인정보 처리방침"
              iconBg="bg-gray-100"
              iconColor="text-gray-500"
              onClick={() => navigate('/settings/privacy-policy')}
            />
            <SettingItem
              icon={FileText}
              label="서비스 이용약관"
              iconBg="bg-gray-100"
              iconColor="text-gray-500"
              onClick={() => navigate('/settings/terms')}
            />
            <SettingItem
              icon={Building2}
              label="사업자 정보"
              sublabel="회사명, 대표자, 사업자번호"
              iconBg="bg-gray-100"
              iconColor="text-gray-500"
              onClick={() => navigate('/settings/company-info')}
            />
          </div>
        </div>

        {/* ── 관리자 도구 ── */}
        {isAdmin && (
          <div className="px-4 pt-4 pb-1">
            <SectionHeader title="관리자 도구" />
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <button
                onClick={() => navigate('/settings/admin-ads')}
                className="w-full flex items-center justify-between py-3 px-4 hover:bg-violet-50 active:bg-violet-100 transition-colors border-b border-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 text-violet-600">
                    <Tv2 className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-violet-600">광고 만들기</span>
                    <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">앱 내 모든 광고 이미지와 설명을 수정합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={() => setShowGenerateConfirm(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between py-3 px-4 hover:bg-indigo-50 active:bg-indigo-100 transition-colors border-b border-gray-50 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-100 text-indigo-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-indigo-600">현재 화면 안에 포스팅 생성</span>
                    <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">지도의 현재 보이는 영역에 5개의 다양한 포스팅을 랜덤하게 배치합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between py-3 px-4 hover:bg-rose-50 active:bg-rose-100 transition-colors border-b border-gray-50 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-100 text-rose-600">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-rose-600">현재 화면 내 포스팅 일괄 삭제</span>
                    <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">지도의 현재 영역에 있는 모든 데이터를 DB에서 영구 삭제합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={() => setShowSeedConfirm(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-gray-700">전국 데이터 대량 생성</span>
                    <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">대한민국 전역에 대량의 포스팅을 골고루 배치합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <button 
                onClick={() => setShowRandomizeConfirm(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between py-3 px-4 hover:bg-orange-50 active:bg-orange-100 transition-colors last:border-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-100 text-orange-600">
                    <RefreshCw className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-orange-600">좋아요 수치 전체 랜덤화</span>
                    <span className="text-[11px] text-gray-400 font-medium mt-0.5">모든 포스팅의 좋아요를 무작위로 섞어 인기 탭을 갱신합니다.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>
        )}

        {/* ── 로그아웃 ── */}
        <div className="px-4 pt-4 pb-1">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem
              icon={LogOut}
              label="로그아웃"
              variant="danger"
              onClick={() => setShowLogoutConfirm(true)}
            />
          </div>
        </div>

        {/* ── 위험 구역 ── */}
        <div className="px-4 pt-4 pb-8">
          <SectionHeader title="위험 구역" />
          <div className="bg-white rounded-2xl border-2 border-red-100 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-[11px] font-bold text-red-400 leading-tight">
                아래 작업은 되돌릴 수 없습니다. 신중하게 진행해주세요.
              </p>
            </div>
            <SettingItem
              icon={Trash2}
              label="회원 탈퇴"
              sublabel="계정 및 모든 데이터가 영구 삭제됩니다"
              variant="danger"
              onClick={() => navigate('/settings/delete-account')}
            />
          </div>
          <p className="text-center text-[10px] text-gray-300 font-bold mt-8 uppercase tracking-tighter">
            ChoraSnap Version 1.0.0
          </p>
        </div>
      </div>

      {/* 버그 신고 다이얼로그 */}
      <Dialog open={showBugReport} onOpenChange={(open) => { setShowBugReport(open); if (!open) setBugContent(''); }}>
        <DialogContent className="rounded-[32px] w-[90%] max-w-[360px] p-6 border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-center text-xl font-black text-gray-900">
              🐛 버그 신고
            </DialogTitle>
            <p className="text-center text-[13px] text-gray-400 font-medium leading-relaxed">
              발견하신 버그나 불편한 점을 알려주세요.<br />빠르게 확인하고 수정하겠습니다.
            </p>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              value={bugContent}
              onChange={(e) => setBugContent(e.target.value)}
              placeholder={"버그 내용을 자세히 작성해주세요.\n예) 어떤 화면에서, 어떤 동작을 했을 때, 어떤 문제가 발생했는지 알려주세요."}
              className="min-h-[140px] rounded-2xl border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-300 resize-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
            />
          </div>
          <DialogFooter className="flex-row gap-3 mt-4 sm:justify-center">
            <button
              onClick={() => { setShowBugReport(false); setBugContent(''); }}
              className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleBugReport}
              className="flex-1 h-12 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 shadow-lg shadow-orange-100 active:scale-95 transition-all"
            >
              보내기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 관리자 다이얼로그들 */}
      <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">포스팅 생성</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              현재 화면 안에 5개의 포스팅을 랜덤하게 생성합니다. 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowGenerateConfirm(false); handleGenerateInView(); }} className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all m-0">생성 실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">전국 데이터 대량 생성</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              대한민국 전역에 대량의 포스팅을 생성합니다. 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSeedConfirm(false); handleSeedData(); }} className="flex-1 h-12 rounded-2xl bg-gray-700 text-white font-bold hover:bg-gray-800 shadow-lg shadow-gray-100 transition-all m-0">생성 실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRandomizeConfirm} onOpenChange={setShowRandomizeConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">좋아요 수치 랜덤화</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              모든 포스팅의 좋아요 수치를 무작위로 변경합니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowRandomizeConfirm(false); handleRandomizeLikes(); }} className="flex-1 h-12 rounded-2xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all m-0">랜덤화 실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">로그아웃</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              로그아웃 하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-100 transition-all m-0">로그아웃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">데이터 일괄 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-bold leading-relaxed">
              현재 화면 범위 내의 모든 포스팅이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInView} className="flex-1 h-12 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 shadow-lg shadow-rose-100 transition-all m-0">삭제 실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;