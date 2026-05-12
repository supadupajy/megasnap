import React from 'react';

// AdMob 테스트 광고 단위 ID (실제 출시 시 교체 필요)
const ADMOB_TEST_NATIVE_ID = 'ca-app-pub-3940256099942544/2247696110';

interface AdMobBannerProps {
  className?: string;
}

/**
 * AdMob 네이티브 광고 컴포넌트 (릴스 전면 광고와 동일한 비주얼 언어)
 *
 * 포스팅 피드 사이에 카드 형태로 삽입되며,
 * 릴스 슬라이드의 AdMobInterstitialPlaceholder와 동일한 다크 그라데이션 +
 * 글래스모피즘 디자인을 사용합니다.
 *
 * 실제 출시 시 해야 할 작업:
 * 1. npm install @capacitor-community/admob && npx cap sync android
 * 2. AndroidManifest.xml에 AdMob App ID 추가
 * 3. build.gradle에 play-services-ads 의존성 추가
 * 4. ADMOB_TEST_NATIVE_ID를 실제 네이티브 광고 단위 ID로 교체
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ className = '' }) => {
  return (
    <div
      className={`relative w-full max-w-full overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-black border-b border-white/5 ${className}`}
    >
      {/* 배경 글로우 장식 */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8">
        {/* AD 배지 */}
        <div className="flex items-center gap-2">
          <span className="bg-white text-indigo-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
            Ad
          </span>
          <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider">
            Sponsored · Native
          </span>
        </div>

        {/* AdMob 아이콘 */}
        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
            />
          </svg>
        </div>

        {/* 메인 카피 */}
        <div className="text-center">
          <h2 className="text-white text-xl font-black leading-tight tracking-tight mb-1.5">
            AdMob 네이티브 광고
          </h2>
          <p className="text-white/70 text-xs font-medium leading-relaxed px-2">
            실제 출시 후 이 자리에 AdMob 광고가 표시됩니다.
          </p>
        </div>

        {/* 테스트 ID 정보 */}
        <div className="w-full max-w-xs bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
            Test Ad Unit ID
          </p>
          <p className="text-[11px] text-white/80 font-mono font-bold break-all leading-tight">
            {ADMOB_TEST_NATIVE_ID}
          </p>
        </div>

        {/* 활성 상태 표시 */}
        <div className="flex items-center gap-2 text-white/50 pt-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Ad Active</span>
        </div>
      </div>
    </div>
  );
};

export default AdMobBanner;
