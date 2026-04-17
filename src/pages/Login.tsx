"use client";

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Camera } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-[22px] flex items-center justify-center shadow-xl shadow-indigo-100">
            <Camera className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter italic">
              Cho<span className="text-indigo-600">ra</span>
            </h1>
            <p className="text-xs font-bold text-gray-400 mt-1 tracking-widest uppercase">
              Be here. Be seen.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-2xl shadow-gray-100 border border-gray-50">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                  },
                  radii: {
                    borderRadiusButton: '16px',
                    inputBorderRadius: '16px',
                  }
                }
              }
            }}
            providers={[]}
            // 세션은 기본적으로 로그아웃 전까지 유지됩니다.
            // 로그인 실패 시 메시지를 한국어로 설정합니다.
            localization={{
              variables: {
                sign_in: {
                  email_label: '이메일',
                  password_label: '비밀번호',
                  button_label: '로그인',
                  loading_button_label: '로그인 중...',
                  email_input_placeholder: '이메일 주소를 입력하세요',
                  password_input_placeholder: '비밀번호를 입력하세요',
                },
                sign_up: {
                  email_label: '이메일',
                  password_label: '비밀번호',
                  button_label: '회원가입',
                  loading_button_label: '가입 중...',
                }
              }
            }}
          />
          <p className="text-[10px] text-center text-gray-400 mt-4 font-medium">
            로그인 정보가 틀리면 상단에 오류 메시지가 표시됩니다.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;