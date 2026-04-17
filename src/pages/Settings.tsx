"use client";

import React from 'react';
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
  Languages
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';

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

import { cn } from '@/lib/utils';

const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    showSuccess('로그아웃 되었습니다.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-100">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-gray-50 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-lg text-gray-900 mr-10">설정</h1>
      </header>

      <div className="pt-[88px]">
        {/* Account Section */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">계정 설정</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem icon={User} label="프로필 편집" />
            <SettingItem icon={Lock} label="비밀번호 및 보안" />
            <SettingItem icon={Bell} label="알림 설정" />
          </div>
        </div>

        {/* App Settings Section */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">앱 설정</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem icon={Moon} label="다크 모드" />
            <SettingItem icon={Languages} label="언어 설정" />
            <SettingItem icon={Shield} label="개인정보 보호" />
          </div>
        </div>

        {/* Support Section */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">지원</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem icon={HelpCircle} label="고객 센터" />
            <SettingItem icon={Info} label="정보" />
          </div>
        </div>

        {/* Login Section */}
        <div className="px-4 py-8">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <SettingItem 
              icon={LogOut} 
              label="로그아웃" 
              variant="danger" 
              onClick={handleSignOut}
            />
          </div>
          <p className="text-center text-[10px] text-gray-300 font-bold mt-8 uppercase tracking-tighter">
            Chora Version 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;