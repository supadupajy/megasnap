import React from 'react';
import { ChevronLeft, Receipt, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const mockBilling = [
  { id: '1', date: '2025.04.01', plan: 'Pro 월간', amount: '₩4,900', status: '결제 완료' },
  { id: '2', date: '2025.03.01', plan: 'Pro 월간', amount: '₩4,900', status: '결제 완료' },
  { id: '3', date: '2025.02.01', plan: 'Pro 월간', amount: '₩4,900', status: '결제 완료' },
];

const BillingHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">결제 내역</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 no-scrollbar">
        <div className="px-4 pt-5">
          {mockBilling.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Receipt className="w-12 h-12 mb-3" />
              <p className="text-sm font-bold">결제 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {mockBilling.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-4 px-4 ${idx < mockBilling.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{item.plan}</p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{item.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-800">{item.amount}</p>
                      <p className="text-[10px] text-emerald-500 font-bold mt-0.5">{item.status}</p>
                    </div>
                    <button className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all">
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingHistory;
