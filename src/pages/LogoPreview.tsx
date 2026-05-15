import React from 'react';

// T 캐릭터 - 왼쪽 (눈이 왼쪽을 바라봄, 살짝 윙크)
const TCharLeft = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 몸통 (T 세로획) */}
    <rect x="20" y="22" width="16" height="36" rx="8" fill="#1a1a1a"/>
    {/* 팔 (T 가로획) */}
    <rect x="2" y="14" width="52" height="14" rx="7" fill="#1a1a1a"/>
    {/* 얼굴 원 */}
    <circle cx="28" cy="14" r="13" fill="#FFD93D"/>
    {/* 볼터치 */}
    <ellipse cx="18" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
    <ellipse cx="38" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
    {/* 왼쪽 눈 (윙크) */}
    <path d="M21 12 Q23 10 25 12" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* 오른쪽 눈 */}
    <circle cx="33" cy="12" r="2.5" fill="#1a1a1a"/>
    <circle cx="34" cy="11" r="0.8" fill="white"/>
    {/* 입 (웃음) */}
    <path d="M23 18 Q28 22 33 18" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* 작은 발 */}
    <ellipse cx="23" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
    <ellipse cx="33" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
  </svg>
);

// T 캐릭터 - 오른쪽 (눈이 오른쪽을 바라봄, 신나는 표정)
const TCharRight = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 몸통 (T 세로획) */}
    <rect x="20" y="22" width="16" height="36" rx="8" fill="#1a1a1a"/>
    {/* 팔 (T 가로획) */}
    <rect x="2" y="14" width="52" height="14" rx="7" fill="#1a1a1a"/>
    {/* 얼굴 원 */}
    <circle cx="28" cy="14" r="13" fill="#FFD93D"/>
    {/* 볼터치 */}
    <ellipse cx="18" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
    <ellipse cx="38" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
    {/* 왼쪽 눈 */}
    <circle cx="23" cy="12" r="2.5" fill="#1a1a1a"/>
    <circle cx="24" cy="11" r="0.8" fill="white"/>
    {/* 오른쪽 눈 (반짝이는 별눈) */}
    <path d="M31 10 L32 12 L34 12 L32.5 13.5 L33 16 L31 14.5 L29 16 L29.5 13.5 L28 12 L30 12 Z" fill="#1a1a1a"/>
    {/* 입 (활짝 웃음) */}
    <path d="M22 18 Q28 23 34 18" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    {/* 작은 발 */}
    <ellipse cx="23" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
    <ellipse cx="33" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
  </svg>
);

// 전체 로고 컴포넌트
const TocaTocaLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const charSize = size === 'sm' ? 32 : size === 'md' ? 52 : 80;
  const textSize = size === 'sm' ? 'text-xl' : size === 'md' ? 'text-3xl' : 'text-5xl';
  const gap = size === 'sm' ? 'gap-1' : size === 'md' ? 'gap-2' : 'gap-3';

  return (
    <div className={`flex flex-col items-center ${gap}`}>
      {/* 두 T 캐릭터 */}
      <div className="flex items-end gap-1">
        <div className="animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }}>
          <TCharLeft size={charSize} />
        </div>
        <div className="animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }}>
          <TCharRight size={charSize} />
        </div>
      </div>

      {/* 텍스트 로고 */}
      <div className={`font-black tracking-tight ${textSize} leading-none`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <span className="text-gray-900">toca</span>
        <span className="text-yellow-400">toca</span>
      </div>
    </div>
  );
};

// 헤더용 인라인 로고 (작고 가로형)
const TocaTocaHeaderLogo = () => (
  <div className="flex items-center gap-2">
    {/* 미니 T 캐릭터 두 개 */}
    <div className="flex items-end gap-0.5">
      <svg width="18" height="22" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="22" width="16" height="36" rx="8" fill="#1a1a1a"/>
        <rect x="2" y="14" width="52" height="14" rx="7" fill="#1a1a1a"/>
        <circle cx="28" cy="14" r="13" fill="#FFD93D"/>
        <ellipse cx="18" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
        <ellipse cx="38" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
        <path d="M21 12 Q23 10 25 12" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <circle cx="33" cy="12" r="2.5" fill="#1a1a1a"/>
        <circle cx="34" cy="11" r="0.8" fill="white"/>
        <path d="M23 18 Q28 22 33 18" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <ellipse cx="23" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
        <ellipse cx="33" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
      </svg>
      <svg width="18" height="22" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="22" width="16" height="36" rx="8" fill="#1a1a1a"/>
        <rect x="2" y="14" width="52" height="14" rx="7" fill="#1a1a1a"/>
        <circle cx="28" cy="14" r="13" fill="#FFD93D"/>
        <ellipse cx="18" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
        <ellipse cx="38" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
        <circle cx="23" cy="12" r="2.5" fill="#1a1a1a"/>
        <circle cx="24" cy="11" r="0.8" fill="white"/>
        <path d="M31 10 L32 12 L34 12 L32.5 13.5 L33 16 L31 14.5 L29 16 L29.5 13.5 L28 12 L30 12 Z" fill="#1a1a1a"/>
        <path d="M22 18 Q28 23 34 18" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <ellipse cx="23" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
        <ellipse cx="33" cy="58" rx="5" ry="3" fill="#1a1a1a"/>
      </svg>
    </div>
    <span className="text-2xl font-black tracking-tighter" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <span className="text-gray-900">toca</span>
      <span className="text-yellow-400">toca</span>
    </span>
  </div>
);

export default function LogoPreview() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-16 p-8">
      <h1 className="text-2xl font-bold text-gray-700">🎨 tocatoca 로고 미리보기</h1>

      {/* 스플래시 스크린 미리보기 */}
      <div className="bg-white rounded-3xl shadow-xl p-12 flex flex-col items-center gap-4 w-80">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">스플래시 화면</p>
        <TocaTocaLogo size="lg" />
        <p className="text-[10px] font-bold text-gray-400 mt-2 tracking-widest uppercase">Be here, Be seen.</p>
      </div>

      {/* 헤더 미리보기 */}
      <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-4 w-80">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">헤더 로고</p>
        <div className="border-b border-gray-100 pb-4">
          <TocaTocaHeaderLogo />
        </div>
        <p className="text-xs text-gray-400">헤더에 들어가는 작은 버전</p>
      </div>

      {/* 사이즈별 미리보기 */}
      <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-8 w-80">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">사이즈 비교</p>
        <div className="flex items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <TocaTocaLogo size="sm" />
            <span className="text-xs text-gray-400">Small</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TocaTocaLogo size="md" />
            <span className="text-xs text-gray-400">Medium</span>
          </div>
        </div>
      </div>

      {/* 다크 배경 미리보기 */}
      <div className="bg-gray-900 rounded-3xl shadow-xl p-12 flex flex-col items-center gap-4 w-80">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">다크 배경</p>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-1">
            <div className="animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }}>
              <svg width="52" height="60" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="22" width="16" height="36" rx="8" fill="white"/>
                <rect x="2" y="14" width="52" height="14" rx="7" fill="white"/>
                <circle cx="28" cy="14" r="13" fill="#FFD93D"/>
                <ellipse cx="18" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
                <ellipse cx="38" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
                <path d="M21 12 Q23 10 25 12" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <circle cx="33" cy="12" r="2.5" fill="#1a1a1a"/>
                <circle cx="34" cy="11" r="0.8" fill="white"/>
                <path d="M23 18 Q28 22 33 18" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <ellipse cx="23" cy="58" rx="5" ry="3" fill="white"/>
                <ellipse cx="33" cy="58" rx="5" ry="3" fill="white"/>
              </svg>
            </div>
            <div className="animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }}>
              <svg width="52" height="60" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="22" width="16" height="36" rx="8" fill="white"/>
                <rect x="2" y="14" width="52" height="14" rx="7" fill="white"/>
                <circle cx="28" cy="14" r="13" fill="#FFD93D"/>
                <ellipse cx="18" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
                <ellipse cx="38" cy="17" rx="4" ry="2.5" fill="#FFB347" opacity="0.5"/>
                <circle cx="23" cy="12" r="2.5" fill="#1a1a1a"/>
                <circle cx="24" cy="11" r="0.8" fill="white"/>
                <path d="M31 10 L32 12 L34 12 L32.5 13.5 L33 16 L31 14.5 L29 16 L29.5 13.5 L28 12 L30 12 Z" fill="#1a1a1a"/>
                <path d="M22 18 Q28 23 34 18" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                <ellipse cx="23" cy="58" rx="5" ry="3" fill="white"/>
                <ellipse cx="33" cy="58" rx="5" ry="3" fill="white"/>
              </svg>
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span className="text-white">toca</span>
            <span className="text-yellow-400">toca</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 max-w-xs text-center">
          💛 마음에 드시면 <strong>"적용해줘"</strong>라고 말씀해 주세요!<br/>
          수정이 필요하면 피드백 주세요 😊
        </div>
      </div>
    </div>
  );
}
