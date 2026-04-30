import React from 'react';

// AdMob 테스트 광고 단위 ID (실제 출시 시 교체 필요)
const ADMOB_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

interface AdMobBannerProps {
  className?: string;
}

/**
 * AdMob 광고 배너 컴포넌트
 *
 * 현재: 테스트 광고 placeholder UI 표시
 *
 * 실제 출시 시 해야 할 작업:
 * 1. npm install @capacitor-community/admob && npx cap sync android
 * 2. AndroidManifest.xml에 AdMob App ID 추가
 * 3. build.gradle에 play-services-ads 의존성 추가
 * 4. ADMOB_TEST_BANNER_ID를 실제 광고 단위 ID로 교체
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ className = '' }) => {
  return (
    <div className={`w-full bg-gray-50 border-y border-gray-100 ${className}`}>
      {/* 광고 라벨 */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          광고
        </span>
        <span className="text-[10px] text-gray-300">Sponsored</span>
      </div>

      {/* 테스트 광고 placeholder */}
      <div className="w-full h-[100px] bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-1 border border-dashed border-indigo-200 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-500">Google AdMob</p>
            <p className="text-[10px] text-indigo-300">테스트 광고 영역</p>
          </div>
        </div>
        <p className="text-[9px] text-gray-400 mt-1">
          {ADMOB_TEST_BANNER_ID}
        </p>
      </div>
    </div>
  );
};

export default AdMobBanner;