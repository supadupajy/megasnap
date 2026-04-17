"use client";

import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Camera } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  // 에러 메시지를 실시간으로 감시하여 변경하는 로직
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Supabase Auth UI의 에러 메시지 클래스 선택
          const messages = document.querySelectorAll('.supabase-auth-ui_ui-message');
          messages.forEach((msg) => {
            if (msg.textContent === 'missing email or phone') {
              msg.textContent = 'invalid email';
            }
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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