import React, { useEffect, useState } from 'react';
import { ChevronLeft, Link2, Unlink, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess } from '@/utils/toast';

const allProviders = [
  { id: 'google', name: '구글', icon: '🔵', description: 'Google 계정으로 로그인' },
  { id: 'kakao', name: '카카오', icon: '🟡', description: 'Kakao 계정으로 로그인' },
  { id: 'naver', name: '네이버', icon: '🟢', description: 'Naver 계정으로 로그인' },
  { id: 'apple', name: 'Apple', icon: '⚫', description: 'Apple ID로 로그인' },
];

const ConnectedAccounts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Supabase user.identities에서 실제 연결된 provider 목록을 읽어옴
  const [accounts, setAccounts] = useState(() =>
    allProviders.map(p => {
      const identity = user?.identities?.find(i => i.provider === p.id);
      return {
        ...p,
        connected: !!identity,
        email: identity?.identity_data?.email ?? null,
      };
    })
  );

  useEffect(() => {
    if (!user) return;
    setAccounts(
      allProviders.map(p => {
        const identity = user.identities?.find(i => i.provider === p.id);
        return {
          ...p,
          connected: !!identity,
          email: (identity?.identity_data?.email as string) ?? null,
        };
      })
    );
  }, [user]);

  const handleToggle = (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    if (account.connected) {
      // 실제 연결 해제는 supabase.auth.unlinkIdentity() 필요 — 현재는 UI 안내만
      showSuccess(`${account.name} 연결 해제는 고객센터를 통해 요청해 주세요.`);
    } else {
      showSuccess(`${account.name} 연결은 준비 중입니다. 곧 지원될 예정입니다.`);
    }
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">SNS 계정 연동</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5">
          <p className="text-[13px] text-gray-400 font-medium mb-4 px-1">
            소셜 계정을 연결하면 해당 계정으로 간편하게 로그인할 수 있습니다.
          </p>

          {/* 현재 로그인 방식 안내 */}
          {user?.identities && user.identities.length > 0 && (
            <div className="bg-indigo-50 rounded-2xl p-3.5 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-[12px] text-indigo-600 font-medium">
                현재 <span className="font-black">{user.identities[0].provider}</span> 계정으로 로그인되어 있습니다.
              </p>
            </div>
          )}

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
                    ) : account.connected ? (
                      <p className="text-[11px] text-indigo-500 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 연결됨
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

          <p className="text-[11px] text-gray-300 font-medium text-center mt-4">
            소셜 계정 연결/해제는 순차적으로 지원될 예정입니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectedAccounts;