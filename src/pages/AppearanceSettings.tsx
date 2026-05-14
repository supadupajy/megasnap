import React, { useState } from 'react';
import { ChevronLeft, Sun, Moon, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess } from '@/utils/toast';

const themes = [
  { id: 'light', label: '라이트 모드', icon: Sun, desc: '밝은 화면', color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'dark', label: '다크 모드', icon: Moon, desc: '어두운 화면', color: 'text-slate-600', bg: 'bg-slate-100' },
  { id: 'system', label: '시스템 설정', icon: Monitor, desc: '기기 설정에 따름', color: 'text-indigo-500', bg: 'bg-indigo-50' },
];

const AppearanceSettings = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('light');

  const handleSelect = (id: string) => {
    setSelected(id);
    const label = themes.find(t => t.id === id)?.label;
    showSuccess(`${label}으로 변경되었습니다.`);
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">다크 모드</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5 space-y-3">
          {themes.map((theme) => {
            const Icon = theme.icon;
            const isSelected = selected === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                  isSelected ? 'border-indigo-300 bg-white shadow-md' : 'border-gray-100 bg-white'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl ${theme.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${theme.color}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-black text-gray-900">{theme.label}</p>
                  <p className="text-[12px] text-gray-400 font-medium mt-0.5">{theme.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-200'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
