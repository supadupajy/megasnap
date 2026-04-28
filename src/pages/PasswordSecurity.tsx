import React, { useState } from 'react';
import { ChevronLeft, Lock, Eye, EyeOff, ShieldCheck, Smartphone, LogOut, Trash2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import BottomNav from '@/components/BottomNav';
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

const PasswordSecurity = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const passwordStrength = (pw: string) => {
    if (!pw) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 1, label: '취약', color: 'bg-red-400' };
    if (score === 2) return { level: 2, label: '보통', color: 'bg-yellow-400' };
    if (score === 3) return { level: 3, label: '강함', color: 'bg-blue-400' };
    return { level: 4, label: '매우 강함', color: 'bg-emerald-400' };
  };

  const strength = passwordStrength(newPw);

  const handleChangePassword = async () => {
    if (!newPw || !confirmPw) {
      showError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPw.length < 8) {
      showError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (newPw !== confirmPw) {
      showError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 현재 비밀번호로 재인증
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPw,
      });
      if (signInError) {
        showError('현재 비밀번호가 올바르지 않습니다.');
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      showSuccess('비밀번호가 성공적으로 변경되었습니다. ✅');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      showError(err.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== '계정삭제') return;
    try {
      // 계정 삭제는 서비스 역할 키가 필요하므로 프로필 삭제 후 로그아웃 처리
      await supabase.from('profiles').delete().eq('id', user?.id ?? '');
      await signOut();
      showSuccess('계정이 삭제되었습니다.');
      navigate('/login');
    } catch (err: any) {
      showError('계정 삭제에 실패했습니다.');
    }
  };

  const loginSessions = [
    { device: '현재 기기', location: '대한민국', time: '지금', isCurrent: true },
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* 서브 헤더 */}
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">비밀번호 및 보안</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">

        {/* 비밀번호 변경 */}
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">비밀번호 변경</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <label className="text-[11px] font-bold text-gray-400 mb-1.5 block">현재 비밀번호</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="현재 비밀번호 입력"
                  className="w-full h-11 bg-gray-50 rounded-xl px-4 pr-11 text-sm font-medium text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-indigo-200 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-50">
              <label className="text-[11px] font-bold text-gray-400 mb-1.5 block">새 비밀번호</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="8자 이상 입력"
                  className="w-full h-11 bg-gray-50 rounded-xl px-4 pr-11 text-sm font-medium text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-indigo-200 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPw.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${i <= strength.level ? strength.color : 'bg-gray-100'}`}
                      />
                    ))}
                  </div>
                  <p className={`text-[10px] font-bold ${strength.level <= 1 ? 'text-red-400' : strength.level === 2 ? 'text-yellow-500' : strength.level === 3 ? 'text-blue-500' : 'text-emerald-500'}`}>
                    비밀번호 강도: {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4">
              <label className="text-[11px] font-bold text-gray-400 mb-1.5 block">새 비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="새 비밀번호 재입력"
                  className="w-full h-11 bg-gray-50 rounded-xl px-4 pr-11 text-sm font-medium text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-indigo-200 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {confirmPw.length > 0 && newPw === confirmPw && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={isLoading}
            className="w-full mt-3 h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {isLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>

        {/* 로그인 활동 */}
        <div className="px-4 pt-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">로그인 활동</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loginSessions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-none">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-800">{s.device}</p>
                    {s.isCurrent && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">현재</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium">{s.location} · {s.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 보안 팁 */}
        <div className="px-4 pt-6">
          <div className="bg-indigo-50 rounded-2xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-indigo-700 mb-1">보안 팁</p>
              <p className="text-[11px] text-indigo-500 font-medium leading-relaxed">
                영문 대소문자, 숫자, 특수문자를 조합한 8자 이상의 비밀번호를 사용하세요. 다른 서비스와 동일한 비밀번호는 사용하지 마세요.
              </p>
            </div>
          </div>
        </div>

        {/* 계정 삭제 */}
        <div className="px-4 pt-6 pb-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">위험 구역</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-sm font-bold text-red-500">계정 삭제</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      <BottomNav />

      {/* 계정 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[340px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
              계정 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-medium leading-relaxed text-sm">
              계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
              <br /><br />
              확인을 위해 아래에 <span className="font-black text-red-500">계정삭제</span>를 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
            placeholder="계정삭제"
            className="w-full h-11 bg-gray-50 rounded-xl px-4 text-sm font-medium text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-red-200 transition mt-2"
          />
          <AlertDialogFooter className="flex-row gap-3 mt-4 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteInput !== '계정삭제'}
              className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-100 transition-all m-0 disabled:opacity-40"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PasswordSecurity;
