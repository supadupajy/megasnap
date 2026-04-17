"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Mail, Lock, Loader2, Eye, EyeOff, Check, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          if (error.message.includes('Email limit exceeded')) {
            throw new Error('이메일 발송 제한을 초과했습니다. 잠시 후 다시 시도하거나 테스트 계정을 이용해주세요.');
          }
          throw error;
        }
        showSuccess('회원가입이 완료되었습니다. 이메일을 확인해주세요!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
        navigate('/');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      showError(err.message || '인증에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 테스트용 빠른 로그인 함수
  const handleTestLogin = async () => {
    setIsLoading(true);
    try {
      // 미리 생성된 테스트 계정 정보 (필요시 Supabase 대시보드에서 생성해두어야 합니다)
      const testEmail = "test@example.com";
      const testPassword = "password123";
      
      const { error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      
      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      showError('테스트 계정 로그인에 실패했습니다. 계정이 생성되어 있는지 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-indigo-100"
          >
            <Camera className="w-10 h-10 text-white" strokeWidth={2.5} />
          </motion.div>
          <div className="text-center">
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">
              Cho<span className="text-indigo-600">ra</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-400 mt-1 tracking-widest uppercase">
              Be here. Be seen.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-50">
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
            </div>

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

            {/* 테스트 로그인 버튼 추가 */}
            {!isSignUp && (
              <Button 
                type="button"
                variant="outline"
                onClick={handleTestLogin}
                disabled={isLoading}
                className="w-full h-14 border-2 border-indigo-100 text-indigo-600 rounded-2xl text-sm font-black hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-indigo-600" />
                테스트 계정으로 바로 시작하기
              </Button>
            )}
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

        <div className="text-center space-y-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
            By continuing, you agree to Chora's<br />
            <span className="text-gray-600">Terms of Service</span> and <span className="text-gray-600">Privacy Policy</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;