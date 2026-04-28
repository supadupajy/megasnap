import React, { useState } from 'react';
import { ChevronLeft, Bell, Heart, MessageCircle, UserPlus, MapPin, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { showSuccess } from '@/utils/toast';

interface NotifToggleProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const NotifToggle = ({ icon: Icon, iconBg, iconColor, label, description, checked, onChange }: NotifToggleProps) => (
  <div className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-none">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-800">{label}</p>
      <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">{description}</p>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${checked ? 'bg-indigo-500' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${checked ? 'left-6' : 'left-0.5'}`}
      />
    </button>
  </div>
);

const NotificationSettings = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState({
    likes: true,
    comments: true,
    follows: true,
    nearbyPosts: false,
    announcements: true,
    messages: true,
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      showSuccess('알림 설정이 저장되었습니다.');
      return next;
    });
  };

  const allOn = Object.values(settings).every(Boolean);
  const toggleAll = () => {
    const next = !allOn;
    setSettings({
      likes: next,
      comments: next,
      follows: next,
      nearbyPosts: next,
      announcements: next,
      messages: next,
    });
    showSuccess(next ? '모든 알림이 켜졌습니다.' : '모든 알림이 꺼졌습니다.');
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate('/settings');
          }}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">알림 설정</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">

        {/* 전체 토글 */}
        <div className="px-4 pt-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800">모든 알림</p>
                  <p className="text-[11px] text-gray-400 font-medium">전체 알림을 한 번에 켜거나 끕니다</p>
                </div>
              </div>
              <button
                onClick={toggleAll}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${allOn ? 'bg-indigo-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${allOn ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 소셜 알림 */}
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">소셜</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <NotifToggle
              icon={Heart}
              iconBg="bg-rose-50"
              iconColor="text-rose-500"
              label="좋아요"
              description="내 포스팅에 좋아요가 달리면 알려드려요"
              checked={settings.likes}
              onChange={() => toggle('likes')}
            />
            <NotifToggle
              icon={MessageCircle}
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
              label="댓글"
              description="내 포스팅에 댓글이 달리면 알려드려요"
              checked={settings.comments}
              onChange={() => toggle('comments')}
            />
            <NotifToggle
              icon={UserPlus}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-500"
              label="팔로우"
              description="새로운 팔로워가 생기면 알려드려요"
              checked={settings.follows}
              onChange={() => toggle('follows')}
            />
            <NotifToggle
              icon={MessageCircle}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-500"
              label="메시지"
              description="새 메시지가 도착하면 알려드려요"
              checked={settings.messages}
              onChange={() => toggle('messages')}
            />
          </div>
        </div>

        {/* 지역 알림 */}
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">지역</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <NotifToggle
              icon={MapPin}
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
              label="주변 새 포스팅"
              description="내 주변에 새 포스팅이 올라오면 알려드려요"
              checked={settings.nearbyPosts}
              onChange={() => toggle('nearbyPosts')}
            />
          </div>
        </div>

        {/* 공지 알림 */}
        <div className="px-4 pt-5 pb-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">서비스</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <NotifToggle
              icon={Megaphone}
              iconBg="bg-purple-50"
              iconColor="text-purple-500"
              label="공지 및 이벤트"
              description="Chora의 새 소식과 이벤트를 알려드려요"
              checked={settings.announcements}
              onChange={() => toggle('announcements')}
            />
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationSettings;