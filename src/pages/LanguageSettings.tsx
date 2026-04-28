import React, { useState } from 'react';
import { ChevronLeft, Check, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { showSuccess } from '@/utils/toast';

const LANGUAGES = [
  { code: 'ko', label: '한국어', native: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', native: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', native: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文 (简体)', native: '中文', flag: '🇨🇳' },
  { code: 'es', label: 'Español', native: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', native: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', native: 'Deutsch', flag: '🇩🇪' },
];

const LanguageSettings = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('ko');

  const handleSelect = (code: string) => {
    setSelected(code);
    const lang = LANGUAGES.find(l => l.code === code);
    showSuccess(`언어가 ${lang?.label}(으)로 변경되었습니다.`);
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
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">언어 설정</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">

        {/* 안내 배너 */}
        <div className="px-4 pt-5">
          <div className="bg-indigo-50 rounded-2xl p-4 flex gap-3 items-start">
            <Globe className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-indigo-600 font-medium leading-relaxed">
              앱에서 사용할 언어를 선택하세요. 변경 사항은 즉시 적용됩니다.
            </p>
          </div>
        </div>

        {/* 언어 목록 */}
        <div className="px-4 pt-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">언어 선택</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {LANGUAGES.map((lang, i) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-3 p-4 border-b border-gray-50 last:border-none transition-colors ${selected === lang.code ? 'bg-indigo-50' : 'hover:bg-gray-50 active:bg-gray-100'}`}
              >
                <span className="text-2xl leading-none">{lang.flag}</span>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-bold ${selected === lang.code ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {lang.label}
                  </p>
                  {lang.label !== lang.native && (
                    <p className="text-[11px] text-gray-400 font-medium">{lang.native}</p>
                  )}
                </div>
                {selected === lang.code && (
                  <Check className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 현재 선택 표시 */}
        <div className="px-4 pt-4 pb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <span className="text-lg">{LANGUAGES.find(l => l.code === selected)?.flag}</span>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold">현재 선택된 언어</p>
              <p className="text-sm font-black text-indigo-700">{LANGUAGES.find(l => l.code === selected)?.label}</p>
            </div>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default LanguageSettings;
