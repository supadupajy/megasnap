import React from 'react';

// AdMob 테스트 광고 단위 ID (실제 출시 시 교체 필요)
const ADMOB_TEST_NATIVE_ID = 'ca-app-pub-3940256099942544/2247696110';

interface AdMobBannerProps {
  className?: string;
}

/**
 * AdMob 네이티브 광고 컴포넌트 (인스타그램 스타일)
 *
 * 실제 출시 시 해야 할 작업:
 * 1. npm install @capacitor-community/admob && npx cap sync android
 * 2. AndroidManifest.xml에 AdMob App ID 추가
 * 3. build.gradle에 play-services-ads 의존성 추가
 * 4. ADMOB_TEST_NATIVE_ID를 실제 네이티브 광고 단위 ID로 교체
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ className = '' }) => {
  return (
    <div className={`w-full bg-white border-b border-gray-100 ${className}`}>
      {/* 광고 헤더 - 포스팅 유저 정보처럼 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {/* 광고주 로고 자리 */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900">Google AdMob</span>
              <span className="text-[10px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-full leading-none">광고</span>
            </div>
            <span className="text-xs text-gray-400">Sponsored</span>
          </div>
        </div>
        <button className="text-gray-300 hover:text-gray-500 transition-colors p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 광고 이미지 영역 - 포스팅 이미지처럼 풀 너비 */}
      <div className="w-full aspect-[4/3] bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-64 h-64 bg-blue-200/30 rounded-full -top-10 -right-10" />
          <div className="absolute w-48 h-48 bg-indigo-200/30 rounded-full -bottom-8 -left-8" />
        </div>

        {/* 광고 콘텐츠 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-gray-800 mb-1">광고 영역</p>
            <p className="text-sm text-gray-500 font-medium">
              실제 출시 후 AdMob 광고가<br />이 자리에 표시됩니다
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-indigo-100">
            <p className="text-[10px] text-indigo-400 font-mono font-bold">{ADMOB_TEST_NATIVE_ID}</p>
          </div>
        </div>
      </div>

      {/* 광고 텍스트 + CTA 버튼 */}
      <div className="px-4 py-3">
        <p className="text-sm font-bold text-gray-900 mb-0.5">지금 바로 시작해보세요</p>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          여기에 광고 설명 문구가 들어갑니다. 실제 광고 출시 후 AdMob에서 자동으로 채워집니다.
        </p>
        <button className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform shadow-sm">
          자세히 보기
        </button>
      </div>
    </div>
  );
};

export default AdMobBanner;
