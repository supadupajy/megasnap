import React, { useState } from 'react';
import { ChevronLeft, Link2, Unlink, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { showSuccess, showError } from '@/utils/toast';

const providers = [
  {
    id: 'google',
    name: '구글',
    icon: '🔵',
    description: 'Google 계정으로 로그인',
    connected: true,
    email: 'user@gmail.com',
  },
  {
    id: 'kakao',
    name: '카카오',
    icon: '🟡',
    description: 'Kakao 계정으로 로그인',
    connected: false,
    email: null,
  },
  {
    id: 'naver',
    name: '네이버',
    icon: '🟢',
    description: 'Naver 계정으로 로그인',
    connected: false,
    email: null,
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: '⚫',
    description: 'Apple ID로 로그인',
    connected: false,
    email: null,
  },
];

const ConnectedAccounts = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState(providers);

  const handleToggle = (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    if (account.connected) {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, connected: false, email: null } : a));
      showSuccess(`${account.name} 연결이 해제되었습니다.`);
    } else {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, connected: true, email: `user@${id}.com` } : a));
      showSuccess(`${account.name} 계정이 연결되었습니다.`);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-none h-16"><Header /></div>

      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate('/settings')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">연결된 소셜 계정</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 no-scrollbar">
        <div className="px-4 pt-5">
          <p className="text-[13px] text-gray-400 font-medium mb-4 px-1">
            소셜 계정을 연결하면 해당 계정으로 간편하게 로그인할 수 있습니다.
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {accounts.map((account, idx) => (
              <div
                key={account.id}
                className={`flex items-center justify-between py-4 px-4 ${idx < accounts.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl">
                    {account.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{account.name}</p>
                    {account.connected && account.email ? (
                      <p className="text-[11px] text-indigo-500 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {account.email}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{account.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(account.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    account.connected
                      ? 'bg-red-50 text-red-500 hover:bg-red-100'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  }`}
                >
                  {account.connected ? (
                    <><Unlink className="w-3.5 h-3.5" /> 연결 해제</>
                  ) : (
                    <><Link2 className="w-3.5 h-3.5" /> 연결하기</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectedAccounts;
