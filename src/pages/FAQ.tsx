import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const faqs = [
  {
    category: '계정',
    items: [
      {
        q: '비밀번호를 잊어버렸어요.',
        a: '로그인 화면에서 "비밀번호 찾기"를 눌러 이메일로 재설정 링크를 받으세요. 이메일이 오지 않는다면 스팸함을 확인해 주세요.',
      },
      {
        q: '닉네임은 어떻게 변경하나요?',
        a: '설정 > 프로필 편집에서 닉네임을 변경할 수 있습니다. 닉네임은 30일에 한 번 변경 가능합니다.',
      },
      {
        q: '계정을 삭제하면 데이터가 복구되나요?',
        a: '계정 삭제 후 30일 이내에는 복구 요청이 가능합니다. 30일이 지나면 모든 데이터가 영구 삭제됩니다.',
      },
    ],
  },
  {
    category: '컨텐츠',
    items: [
      {
        q: '컨텐츠는 어떻게 삭제하나요?',
        a: '컨텐츠 상세 화면에서 우측 상단 메뉴(···)를 눌러 삭제할 수 있습니다. 삭제된 컨텐츠는 복구되지 않습니다.',
      },
      {
        q: '컨텐츠가 지도에 표시되지 않아요.',
        a: '위치 정보가 정확하지 않거나 GPS 신호가 약한 경우 발생할 수 있습니다. 위치 권한을 허용하고 다시 시도해 주세요.',
      },
    ],
  },
];

const FAQ = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">자주 묻는 질문</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-4">
          {/* 검색 */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="궁금한 내용을 검색하세요"
              className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <p className="text-sm font-bold">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((cat) => (
                <div key={cat.category}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{cat.category}</p>
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    {cat.items.map((item, idx) => {
                      const key = `${cat.category}-${idx}`;
                      const isOpen = expanded === key;
                      return (
                        <div key={key} className={idx < cat.items.length - 1 ? 'border-b border-gray-50' : ''}>
                          <button
                            onClick={() => setExpanded(isOpen ? null : key)}
                            className="w-full flex items-center justify-between py-4 px-4 hover:bg-gray-50 transition-colors text-left"
                          >
                            <span className="text-sm font-bold text-gray-800 flex-1 pr-2">{item.q}</span>
                            {isOpen
                              ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0" />
                              : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            }
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4">
                              <div className="bg-indigo-50 rounded-xl p-3.5">
                                <p className="text-[13px] text-indigo-700 font-medium leading-relaxed">{item.a}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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

export default FAQ;