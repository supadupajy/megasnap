import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';

const sections = [
  {
    title: '제1조 (목적)',
    content: `이 약관은 ChoraSnap(이하 "회사")이 제공하는 위치 기반 소셜 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (정의)',
    content: `① "서비스"란 회사가 제공하는 ChoraSnap 앱 및 관련 서비스를 의미합니다.\n② "이용자"란 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.\n③ "회원"이란 회사에 개인정보를 제공하여 회원 등록을 한 자를 말합니다.`,
  },
  {
    title: '제3조 (약관의 효력 및 변경)',
    content: `① 이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.\n② 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지합니다.\n③ 이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.`,
  },
  {
    title: '제4조 (서비스 이용)',
    content: `① 서비스는 연중무휴 24시간 제공을 원칙으로 합니다.\n② 회사는 시스템 점검, 장애 등의 사유로 서비스 제공을 일시 중단할 수 있습니다.\n③ 이용자는 서비스 이용 시 관련 법령 및 이 약관을 준수해야 합니다.`,
  },
  {
    title: '제5조 (금지 행위)',
    content: `이용자는 다음 행위를 해서는 안 됩니다.\n\n• 타인의 개인정보 도용\n• 허위 정보 등록\n• 음란물, 폭력적 콘텐츠 게시\n• 타인에 대한 비방, 명예훼손\n• 서비스 운영 방해\n• 상업적 광고 무단 게시`,
  },
  {
    title: '제6조 (면책 조항)',
    content: `① 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중단 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.\n② 이용자의 귀책 사유로 인한 서비스 이용 장애에 대해 회사는 책임을 지지 않습니다.`,
  },
];

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-none h-16"><Header /></div>

      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate('/settings')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">서비스 이용약관</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 no-scrollbar">
        <div className="px-4 pt-5">
          <div className="bg-amber-50 rounded-2xl p-4 mb-5">
            <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
              시행일: 2025년 5월 1일<br />
              서비스를 이용하시기 전에 이용약관을 주의 깊게 읽어 주시기 바랍니다.
            </p>
          </div>

          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.title} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 mb-2">{section.title}</h3>
                <p className="text-[12px] text-gray-500 font-medium leading-relaxed whitespace-pre-line">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
