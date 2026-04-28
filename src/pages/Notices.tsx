import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
const notices = [
  {
    id: '1',
    title: 'ChoraSnap v1.1.0 업데이트 안내',
    date: '2025.04.25',
    badge: '업데이트',
    badgeColor: 'bg-indigo-100 text-indigo-600',
    content: `안녕하세요, ChoraSnap 팀입니다.\n\nv1.1.0 업데이트 내용을 안내드립니다.\n\n• 지도 성능 개선 및 로딩 속도 향상\n• 친구 피드 UI 개선\n• 알림 설정 세분화\n• 버그 수정 및 안정성 향상\n\n항상 ChoraSnap을 이용해 주셔서 감사합니다.`,
  },
  {
    id: '2',
    title: '[공지] 서버 점검 안내 (4/30 새벽 2시~4시)',
    date: '2025.04.22',
    badge: '점검',
    badgeColor: 'bg-amber-100 text-amber-600',
    content: `안녕하세요.\n\n서비스 안정화를 위한 정기 서버 점검이 진행됩니다.\n\n• 일시: 2025년 4월 30일 (수) 새벽 02:00 ~ 04:00\n• 영향: 서비스 전체 이용 불가\n\n점검 시간 동안 불편을 드려 죄송합니다.`,
  },
  {
    id: '3',
    title: '개인정보 처리방침 개정 안내',
    date: '2025.04.10',
    badge: '정책',
    badgeColor: 'bg-rose-100 text-rose-600',
    content: `개인정보 처리방침이 2025년 5월 1일부터 개정됩니다.\n\n주요 변경 사항:\n• 위치정보 수집 항목 명확화\n• 제3자 제공 내용 업데이트\n\n자세한 내용은 개인정보 처리방침 페이지를 확인해 주세요.`,
  },
];

const Notices = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>('1');

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
        <button onClick={() => navigate('/settings')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">공지사항</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 no-scrollbar">
        <div className="px-4 pt-5 space-y-2">
          {notices.map((notice) => (
            <div key={notice.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpanded(expanded === notice.id ? null : notice.id)}
                className="w-full flex items-center justify-between py-4 px-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3 text-left flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Megaphone className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${notice.badgeColor}`}>{notice.badge}</span>
                      <span className="text-[11px] text-gray-400 font-medium">{notice.date}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800 leading-snug">{notice.title}</p>
                  </div>
                </div>
                {expanded === notice.id
                  ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                  : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                }
              </button>
              {expanded === notice.id && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed whitespace-pre-line">{notice.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Notices;
