import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const sections = [
  {
    title: '1. 수집하는 개인정보 항목',
    content: `ChoraSnap은 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.\n\n• 필수 항목: 이메일 주소, 닉네임, 비밀번호\n• 선택 항목: 프로필 사진, 자기소개\n• 자동 수집: 위치 정보(GPS), 기기 정보, 접속 로그, 쿠키`,
  },
  {
    title: '2. 개인정보 수집 및 이용 목적',
    content: `수집한 개인정보는 다음 목적으로 이용됩니다.\n\n• 서비스 제공 및 운영\n• 회원 관리 및 본인 확인\n• 위치 기반 서비스 제공\n• 서비스 개선 및 신규 서비스 개발\n• 마케팅 및 광고 활용 (동의 시)`,
  },
  {
    title: '3. 개인정보 보유 및 이용 기간',
    content: `회원 탈퇴 시 즉시 파기합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.\n\n• 계약 또는 청약철회 기록: 5년\n• 대금결제 및 재화 공급 기록: 5년\n• 소비자 불만 또는 분쟁처리 기록: 3년`,
  },
  {
    title: '4. 개인정보의 제3자 제공',
    content: `ChoraSnap은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자가 사전에 동의한 경우 또는 법령의 규정에 의한 경우에는 예외로 합니다.`,
  },
  {
    title: '5. 이용자의 권리',
    content: `이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다.\n\n• 개인정보 열람 요청\n• 개인정보 정정·삭제 요청\n• 개인정보 처리 정지 요청\n• 개인정보 이동 요청\n\n권리 행사는 설정 > 1:1 문의를 통해 요청하실 수 있습니다.`,
  },
  {
    title: '6. 개인정보 보호책임자',
    content: `개인정보 보호책임자: ChoraSnap 개인정보보호팀\n이메일: privacy@chorasnap.com\n\n개인정보 관련 문의, 불만, 피해구제 등에 관한 사항은 위 연락처로 문의해 주시기 바랍니다.`,
  },
];

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]" style={{ pointerEvents: 'auto' }}>
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">개인정보 처리방침</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5">
          <div className="bg-indigo-50 rounded-2xl p-4 mb-5">
            <p className="text-[12px] text-indigo-700 font-medium leading-relaxed">
              시행일: 2025년 5월 1일<br />
              ChoraSnap(이하 "회사")은 이용자의 개인정보를 중요시하며, 개인정보보호법 등 관련 법령을 준수합니다.
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

export default PrivacyPolicy;