import React, { useState } from 'react';
import { ChevronLeft, Megaphone, Mail, MessageSquare, Send, CheckCircle2, MapPin, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';

const AD_TYPES = [
  { id: 'map', icon: MapPin, label: '지도 마커 광고', desc: '지도 위에 브랜드 마커를 노출합니다' },
  { id: 'feed', icon: MessageSquare, label: '피드 광고', desc: '포스팅 피드 사이에 광고를 삽입합니다' },
  { id: 'banner', icon: TrendingUp, label: '배너 광고', desc: '앱 상단/하단 배너 영역을 활용합니다' },
  { id: 'sponsored', icon: Sparkles, label: '스폰서드 콘텐츠', desc: '브랜드 스토리를 콘텐츠로 제작합니다' },
];

const BackButton = ({ onPress }: { onPress: () => void }) => (
  <button
    onClick={onPress}
    className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
    style={{ pointerEvents: 'auto' }}
  >
    <ChevronLeft className="w-6 h-6 text-gray-400" />
  </button>
);

const AdInquiry = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const goBack = () => navigate('/settings');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) { showError('광고 유형을 선택해주세요.'); return; }
    if (!company.trim()) { showError('회사/브랜드명을 입력해주세요.'); return; }
    if (!contact.trim()) { showError('연락처(이메일 또는 전화번호)를 입력해주세요.'); return; }
    setSubmitted(true);
    showSuccess('광고 문의가 접수되었습니다! 빠른 시일 내에 연락드리겠습니다. 🎉');
  };

  if (submitted) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
          <BackButton onPress={goBack} />
          <div className="flex-1 flex justify-center -ml-10">
            <h1 className="text-[17px] font-black text-gray-900 tracking-tight">광고 문의</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 text-center">문의 접수 완료!</h2>
          <p className="text-sm text-gray-500 font-medium text-center leading-relaxed mb-8">
            광고 문의가 성공적으로 접수되었습니다.{'\n'}
            영업일 기준 1~2일 내에 담당자가 연락드리겠습니다.
          </p>
          <Button
            onClick={goBack}
            className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100"
          >
            설정으로 돌아가기
          </Button>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
        <BackButton onPress={goBack} />
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">광고 문의</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">

        {/* 히어로 배너 */}
        <div className="mx-4 mt-5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/70 uppercase tracking-widest">ChoraSnap Ads</p>
              <p className="text-lg font-black leading-tight">지도 위에서 브랜드를 알리세요</p>
            </div>
          </div>
          <p className="text-sm text-white/80 font-medium leading-relaxed">
            실시간 위치 기반 플랫폼 ChoraSnap에서 타겟 고객에게 정확하게 도달하세요.
          </p>
          {/* <div className="flex gap-4 mt-4">
            <div className="text-center">
              <p className="text-xl font-black">10만+</p>
              <p className="text-[10px] text-white/70 font-bold">월간 사용자</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-xl font-black">98%</p>
              <p className="text-[10px] text-white/70 font-bold">위치 정확도</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-xl font-black">3배</p>
              <p className="text-[10px] text-white/70 font-bold">평균 CTR</p>
            </div>
          </div> */}
        </div>

        {/* 광고 유형 선택 */}
        <div className="px-4 pt-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">광고 유형 선택</p>
          <div className="grid grid-cols-2 gap-3">
            {AD_TYPES.map(({ id, icon: Icon, label, desc }) => (
              <button
                key={id}
                onClick={() => setSelectedType(id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                  selectedType === id
                    ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                    : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
                  selectedType === id ? 'bg-indigo-600' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-4 h-4 ${selectedType === id ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <p className={`text-xs font-black leading-tight mb-1 ${selectedType === id ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {label}
                </p>
                <p className="text-[10px] text-gray-400 font-medium leading-tight">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 문의 폼 */}
        <form onSubmit={handleSubmit} className="px-4 pt-6 space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">문의 정보 입력</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block mb-2">
                회사 / 브랜드명 <span className="text-red-400">*</span>
              </label>
              <Input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="예: 스타벅스 코리아"
                className="border-none bg-gray-50 rounded-xl focus-visible:ring-indigo-300 font-medium text-sm"
              />
            </div>
            <div className="p-4">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block mb-2">
                연락처 (이메일 또는 전화번호) <span className="text-red-400">*</span>
              </label>
              <Input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="예: ad@company.com"
                className="border-none bg-gray-50 rounded-xl focus-visible:ring-indigo-300 font-medium text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block mb-2">
              추가 문의 사항
            </label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="광고 목적, 예산, 기간 등 자유롭게 작성해주세요."
              className="border-none bg-gray-50 rounded-xl focus-visible:ring-indigo-300 font-medium text-sm resize-none min-h-[100px]"
            />
          </div>

          {/* 이메일 직접 문의 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold">직접 이메일 문의</p>
              <p className="text-sm font-black text-indigo-600">ad@chora.app</p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full rounded-2xl bg-indigo-600 text-white font-black text-base shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 py-3.5"
          >
            <Send className="w-4 h-4" />
            문의 접수하기
          </Button>
        </form>

        <p className="text-center text-[10px] text-gray-300 font-bold mt-6 mb-2">
          문의 접수 후 영업일 기준 1~2일 내 회신드립니다
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default AdInquiry;
