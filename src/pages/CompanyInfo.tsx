import React from 'react';
import { ChevronLeft, Building2, Mail, Phone, MapPin, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const info = [
  { icon: Building2, label: '상호명', value: '주식회사 코라' },
  { icon: Building2, label: '대표자', value: '연상훈' },
  { icon: Building2, label: '사업자등록번호', value: '123-45-67890' },
  { icon: Building2, label: '통신판매업 신고번호', value: '제2025-서울강남-0001호' },
  { icon: MapPin, label: '주소', value: '서울특별시 강남구 테헤란로 123, 4층' },
  { icon: Mail, label: '이메일', value: 'support@thetocatoca.com' },
  { icon: Phone, label: '고객센터', value: '02-1234-5678' },
  { icon: Globe, label: '웹사이트', value: 'www.chorasnap.com' },
];

const CompanyInfo = () => {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">사업자 정보</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5">
          {/* 로고 영역 */}
          <div className="flex flex-col items-center py-6 mb-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 shadow-lg shadow-yellow-200/60">
              <img src="/tocatoca-logo.png" alt="TocaToca" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-lg font-black text-gray-900">TocaToca</h2>
            <p className="text-[12px] text-gray-400 font-medium mt-1">위치 기반 소셜 플랫폼</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {info.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 py-3.5 px-4 ${idx < info.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-[11px] text-gray-300 font-medium mt-6 leading-relaxed">
            TocaToca는 통신판매중개자로서 거래 당사자가 아니며,<br />
            판매자가 등록한 상품 정보 및 거래에 대한 책임은 판매자에게 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompanyInfo;
