import React from 'react';
import { ChevronLeft, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BillingHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">결제 내역</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5">
          <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mb-4">
              <Receipt className="w-8 h-8 text-indigo-500" />
            </div>
            <h2 className="text-base font-black text-gray-900">아직 결제 내역이 없습니다</h2>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mt-2">
              실 결제가 발생하면 이 화면에 실제 결제 내역이 표시됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingHistory;
