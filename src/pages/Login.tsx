"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Mail, Lock, Loader2, Eye, EyeOff, AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate, useLocation } from 'react-router-dom';

// Supabase 에러 메시지 → 한국어 매핑 (User Enumeration 방지)
const getAuthErrorMessage = (message: string): string => {
  if (!message) return '인증에 실패했습니다. 다시 시도해주세요.';
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (m.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return '이미 가입된 이메일입니다. 로그인을 시도해보세요.';
  }
  if (m.includes('password should be at least')) {
    return '비밀번호는 8자 이상이어야 합니다.';
  }
  if (m.includes('unable to validate email address') || m.includes('invalid email')) {
    return '유효하지 않은 이메일 형식입니다.';
  }
  if (m.includes('email rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate_limit')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
  }
  return '인증에 실패했습니다. 다시 시도해주세요.';
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as any)?.redirectTo || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [agreedToAll, setAgreedToAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('chora_remembered_email');
    const savedPref = localStorage.getItem('chora_remember_me_pref');
    
    if (savedEmail) setEmail(savedEmail);
    if (savedPref === 'true') setRememberMe(true);
  }, []);

  // 회원가입 ↔ 로그인 전환 시 약관 동의 초기화
  useEffect(() => {
    setAgreedToAll(false);
  }, [isSignUp]);

  // 약관 동의 정보를 localStorage에 임시 저장 (세션 없이 INSERT 불가하므로 SIGNED_IN 시점에 처리)
  const storeAgreementLocally = () => {
    localStorage.setItem('pending_agreement', JSON.stringify({
      agreed_to_terms: true,
      agreed_to_privacy: true,
      agreed_at: new Date().toISOString(),
      terms_version: '2025-05-01',
      privacy_version: '2025-05-01',
    }));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (isSignUp) {
      if (!agreedToAll) {
        showError('서비스 이용약관 및 개인정보 처리방침에 동의해주세요.');
        return;
      }
      if (password.length < 8) {
        showError('비밀번호는 8자 이상이어야 합니다.');
        return;
      }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        showError('비밀번호는 영문과 숫자를 모두 포함해야 합니다.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'com.chorasnap.chorasnap://login-callback',
          },
        });
        if (error) throw error;

        // 약관 동의 정보를 localStorage에 임시 저장 → AuthProvider의 SIGNED_IN 이벤트에서 DB에 저장
        storeAgreementLocally();

        if (data.user && data.session) {
          showSuccess('회원가입이 완료되었습니다! ✨');
          navigate(redirectTo, { replace: true });
        } else {
          showSuccess('인증 이메일이 발송되었습니다. 메일함을 확인해주세요!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (rememberMe) {
          localStorage.setItem('chora_remembered_email', email);
          localStorage.setItem('chora_remember_me_pref', 'true');
        } else {
          localStorage.removeItem('chora_remembered_email');
          localStorage.setItem('chora_remember_me_pref', 'false');
        }

        navigate(redirectTo, { replace: true });
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      showError(getAuthErrorMessage(err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-white overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex flex-col items-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-24 h-24 rounded-[28px] overflow-hidden shadow-2xl shadow-yellow-200/60"
          >
            <img
              src="/tocatoca-logo.png"
              alt="TocaToca"
              className="w-full h-full object-cover"
            />
          </motion.div>
          <div className="text-center">
            <h1
              className="text-4xl font-black text-gray-900 tracking-tighter"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Toca<span className="text-yellow-500">Toca</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-400 mt-1 tracking-widest uppercase">
              Tap, Talk, Together.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-50">
          {isSignUp && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                인증 메일이 오지 않는다면 스팸함을 확인하거나, 잠시 후 다시 시도해주세요.</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">이메일 주소</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input 
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 pl-12 rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 pl-12 pr-12 rounded-2xl bg-gray-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-600 font-bold"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isSignUp && (
                <p className="text-[10px] text-gray-400 font-medium px-1">
                  영문 + 숫자 조합 8자 이상
                </p>
              )}
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="w-5 h-5 rounded-lg border-gray-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  <label htmlFor="remember" className="text-xs font-bold text-gray-500 cursor-pointer select-none">
                    로그인 정보 저장하기
                  </label>
                </div>
              </div>
            )}

            {/* 회원가입 시 약관 동의 */}
            <AnimatePresence>
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    {/* 전체 동의 */}
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => setAgreedToAll(!agreedToAll)}
                    >
                      <Checkbox
                        id="agree-all"
                        checked={agreedToAll}
                        onCheckedChange={(checked) => setAgreedToAll(checked as boolean)}
                        className="w-5 h-5 rounded-lg border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label htmlFor="agree-all" className="text-[13px] font-black text-gray-800 cursor-pointer select-none">
                        서비스 이용약관 및 개인정보 처리방침 동의 (필수)
                      </label>
                    </div>

                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      {/* 이용약관 링크 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${agreedToAll ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                          <span className="text-[11px] font-medium text-gray-500">서비스 이용약관 (필수)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/terms')}
                          className="flex items-center gap-0.5 text-[11px] font-bold text-indigo-500 active:opacity-70"
                        >
                          보기 <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* 개인정보 처리방침 링크 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${agreedToAll ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                          <span className="text-[11px] font-medium text-gray-500">개인정보 처리방침 (필수)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/privacy-policy')}
                          className="flex items-center gap-0.5 text-[11px] font-bold text-indigo-500 active:opacity-70"
                        >
                          보기 <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {!agreedToAll && (
                      <p className="text-[10px] text-rose-500 font-medium pt-1">
                        회원가입을 위해 약관 동의가 필요합니다.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                isSignUp ? '회원가입' : '로그인'
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-50 text-center">
            <p className="text-sm text-gray-500 font-medium">
              {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="ml-2 text-indigo-600 font-black hover:underline"
              >
                {isSignUp ? '로그인하기' : '회원가입하기'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>      
      </div>
    </div>
  );
};

export default Login;
