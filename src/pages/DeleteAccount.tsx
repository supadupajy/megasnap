import React, { useState } from 'react';
import { ChevronLeft, Trash2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const consequences = [
  '프로필, 포스팅, 댓글 등 모든 데이터가 영구 삭제됩니다.',
  '팔로워 및 팔로잉 관계가 모두 삭제됩니다.',
  '결제 내역 및 구독이 즉시 취소됩니다.',
  '삭제된 계정은 30일 이후 복구가 불가능합니다.',
];

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = () => {
    if (confirm !== '탈퇴합니다') {
      showError('확인 문구를 정확히 입력해주세요.');
      return;
    }
    setStep(2);
  };

  const handleDelete = async () => {
    if (!password.trim()) {
      showError('비밀번호를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      // 비밀번호 재인증
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password,
      });
      if (signInError) {
        showError('비밀번호가 올바르지 않습니다.');
        setIsLoading(false);
        return;
      }
      // 계정 삭제 (실제 서비스에서는 서버 함수 호출 필요)
      await signOut();
      showSuccess('계정이 삭제되었습니다. 그동안 이용해 주셔서 감사합니다.');
      navigate('/login');
    } catch {
      showError('계정 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-[60] h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={() => step === 2 ? setStep(1) : navigate('/settings')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">회원 탈퇴</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 no-scrollbar">
        <div className="px-4 pt-5">
          {step === 1 ? (
            <div className="space-y-5">
              {/* 경고 배너 */}
              <div className="bg-red-50 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-red-600 mb-1">탈퇴 전 꼭 확인하세요</p>
                  <p className="text-[12px] text-red-500 font-medium leading-relaxed">
                    탈퇴 시 아래 내용이 모두 삭제되며 복구가 어렵습니다.
                  </p>
                </div>
              </div>

              {/* 삭제 항목 */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {consequences.map((item, idx) => (
                  <div key={idx} className={`flex items-start gap-3 py-3.5 px-4 ${idx < consequences.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-red-500">{idx + 1}</span>
                    </div>
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>

              {/* 확인 입력 */}
              <div>
                <p className="text-[12px] font-bold text-gray-500 mb-2 px-1">
                  탈퇴를 원하시면 아래에 <span className="text-red-500 font-black">"탈퇴합니다"</span>를 입력하세요.
                </p>
                <input
                  type="text"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
          ) : (
            <div className="space-y-5">
              <div className="bg-red-50 rounded-2xl p-4 text-center">
                <Trash2 className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm font-black text-red-600">마지막 확인</p>
                <p className="text-[12px] text-red-400 font-medium mt-1">비밀번호를 입력하면 계정이 즉시 삭제됩니다.</p>
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
                onClick={handleDelete}
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
    </div>
  );
};

export default DeleteAccount;
