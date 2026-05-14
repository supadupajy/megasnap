import React, { useState } from 'react';
import { ChevronLeft, Check, Zap, Crown, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess } from '@/utils/toast';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '무료',
    period: '',
    icon: Star,
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    features: ['기본 지도 탐색', '하루 5개 포스팅', '기본 알림'],
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₩4,900',
    period: '/ 월',
    icon: Zap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    features: ['무제한 포스팅', '광고 없음', '고급 필터', '우선 고객 지원'],
    current: false,
    badge: '인기',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₩9,900',
    period: '/ 월',
    icon: Crown,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    features: ['Pro 모든 기능', '독점 배지', '분석 대시보드', '전담 매니저'],
    current: false,
  },
];

const Subscription = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('free');

  const handleSubscribe = (planId: string) => {
    if (planId === 'free') return;
    setSelected(planId);
    showSuccess(`${plans.find(p => p.id === planId)?.name} 플랜으로 업그레이드되었습니다! 🎉`);
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">구독 플랜</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5 space-y-3">
          <p className="text-[13px] text-gray-400 font-medium px-1 mb-4">
            현재 플랜: <span className="text-indigo-600 font-black">Free</span>
          </p>

          {plans.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selected === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-5 transition-all ${isSelected ? plan.border + ' shadow-md' : 'border-gray-100'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl ${plan.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${plan.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-gray-900">{plan.name}</span>
                        {plan.badge && (
                          <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">{plan.badge}</span>
                        )}
                        {plan.current && (
                          <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">현재 플랜</span>
                        )}
                      </div>
                      <p className="text-sm font-black text-gray-800 mt-0.5">
                        {plan.price}<span className="text-xs font-medium text-gray-400">{plan.period}</span>
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-gray-600 font-medium">
                      <Check className={`w-3.5 h-3.5 ${plan.color} flex-shrink-0`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.id !== 'free' && (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : `${plan.bg} ${plan.color} hover:opacity-80`
                    }`}
                  >
                    {isSelected ? '현재 구독 중' : '구독하기'}
                  </button>
                )}
              </div>
            );
          })}

          <p className="text-center text-[11px] text-gray-300 font-medium pt-2">
            구독은 언제든지 취소할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
