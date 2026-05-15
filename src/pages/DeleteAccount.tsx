import React, { useState } from 'react';
import { ChevronLeft, Trash2, AlertTriangle, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

const consequences = [
  '프로필, 컨텐츠, 댓글 등 모든 데이터가 영구 삭제됩니다.',
  '팔로워 및 팔로잉 관계가 모두 삭제됩니다.',
  '결제 내역 및 구독이 즉시 취소됩니다.',
  '삭제된 계정은 복구가 불가능합니다.',
];

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Step 1: 안내 + "탈퇴합니다" 입력
  // Step 2: 비밀번호 입력
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 최종 확인 다이얼로그
  const [showFinalDialog, setShowFinalDialog] = useState(false);
  const [finalConfirmText, setFinalConfirmText] = useState('');

  const handleNext = () => {
    if (confirmText !== '탈퇴합니다') {
      showError('확인 문구를 정확히 입력해주세요.');
      return;
    }
    setStep(2);
  };

  const handleOpenFinalDialog = () => {
    if (!password.trim()) {
      showError('비밀번호를 입력해주세요.');
      return;
    }
    setFinalConfirmText('');
    setShowFinalDialog(true);
  };

  const handleDelete = async () => {
    if (finalConfirmText !== '회원탈퇴') {
      showError('"회원탈퇴"를 정확히 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setShowFinalDialog(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        showError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { password },
      });

      if (error || data?.error) {
        const msg = data?.error || error?.message || '계정 삭제 중 오류가 발생했습니다.';
        showError(msg);
        return;
      }

      await signOut();
      showSuccess('계정이 완전히 삭제되었습니다. 그동안 이용해 주셔서 감사합니다. 🙏');
      navigate('/login');
    } catch (err: any) {
      console.error('[DeleteAccount] 오류:', err);
      showError('계정 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button
          onClick={() => step === 2 ? setStep(1) : navigate('/settings')}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">회원 탈퇴</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5">

          {/* ── Step 1: 안내 + 확인 문구 ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* 경고 배너 */}
              <div className="bg-red-50 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-red-600 mb-1">탈퇴 전 꼭 확인하세요</p>
                  <p className="text-[12px] text-red-500 font-medium leading-relaxed">
                    탈퇴 시 아래 내용이 모두 삭제되며 복구가 불가능합니다.
                  </p>
                </div>
              </div>

              {/* 삭제 항목 */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {consequences.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 py-3.5 px-4 ${idx < consequences.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-red-500">{idx + 1}</span>
                    </div>
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>

              {/* 확인 문구 입력 */}
              <div>
                <p className="text-[12px] font-bold text-gray-500 mb-2 px-1">
                  탈퇴를 원하시면 아래에{' '}
                  <span className="text-red-500 font-black">"탈퇴합니다"</span>를 입력하세요.
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="탈퇴합니다"
                  className="w-full px-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-200 shadow-sm"
                />
              </div>

              <button
                onClick={handleNext}
                className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-100"
              >
                다음 단계
              </button>
            </div>
          )}

          {/* ── Step 2: 비밀번호 입력 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-red-50 rounded-2xl p-5 text-center">
                <Trash2 className="w-9 h-9 text-red-400 mx-auto mb-2" />
                <p className="text-sm font-black text-red-600">마지막 단계</p>
                <p className="text-[12px] text-red-400 font-medium mt-1 leading-relaxed">
                  현재 비밀번호를 입력하고<br />계정 삭제를 진행하세요.
                </p>
              </div>

              <div>
                <p className="text-[12px] font-bold text-gray-500 mb-2 px-1">현재 비밀번호</p>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full px-4 py-3 pr-12 bg-white rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-200 shadow-sm"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleOpenFinalDialog}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
              >
                {isLoading ? '처리 중...' : '계정 영구 삭제'}
              </button>

              <button
                onClick={() => navigate('/settings')}
                className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 최종 확인 다이얼로그 ── */}
      <AlertDialog open={showFinalDialog} onOpenChange={(open) => { if (!isLoading) setShowFinalDialog(open); }}>
        <AlertDialogContent className="rounded-[32px] w-[88%] max-w-[360px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-red-500" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
              정말 탈퇴하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[13px] text-gray-500 font-medium leading-relaxed">
              이 작업은 <span className="text-red-500 font-black">되돌릴 수 없습니다.</span><br />
              계속하려면 아래에{' '}
              <span className="text-red-500 font-black">"회원탈퇴"</span>를 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-2">
            <input
              type="text"
              value={finalConfirmText}
              onChange={e => setFinalConfirmText(e.target.value)}
              placeholder="회원탈퇴"
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-300 text-center tracking-widest"
            />
          </div>

          <AlertDialogFooter className="flex-row gap-3 mt-4 sm:justify-center">
            <button
              onClick={() => { setShowFinalDialog(false); setFinalConfirmText(''); }}
              className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={finalConfirmText !== '회원탈퇴' || isLoading}
              className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-40"
            >
              탈퇴 확정
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeleteAccount;
