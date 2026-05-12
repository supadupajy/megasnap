import React from 'react';

// AdMob 테스트 전면 광고 단위 ID (출시 시 실제 ID로 교체 필요)
// Google 공식 테스트 ID: https://developers.google.com/admob/android/test-ads
const ADMOB_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

interface AdMobInterstitialPlaceholderProps {
  isActive?: boolean;
}

/**
 * AdMob 전면 광고 플레이스홀더 (릴스 슬라이드용)
 *
 * 실제 출시 시 해야 할 작업:
 * 1. npm install @capacitor-community/admob && npx cap sync android
 * 2. AndroidManifest.xml에 AdMob App ID 추가
 * 3. build.gradle에 play-services-ads 의존성 추가
 * 4. ADMOB_TEST_INTERSTITIAL_ID를 실제 전면 광고 단위 ID로 교체
 * 5. AdMob.prepareInterstitial({ adId: ADMOB_TEST_INTERSTITIAL_ID })로 미리 로드
 * 6. 슬라이드 활성화 시 AdMob.showInterstitial() 호출
 *
 * 현재는 출시 전이므로 시각적 플레이스홀더만 표시.
 */
const AdMobInterstitialPlaceholder: React.FC<AdMobInterstitialPlaceholderProps> = ({ isActive }) => {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-black flex items-center justify-center"
      style={{ height: '100dvh' }}
    >
      {/* 배경 장식 */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center gap-6">
        {/* AD 배지 */}
        <div className="flex items-center gap-2">
          <span className="bg-white text-indigo-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
            Ad
          </span>
          <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider">
            Sponsored · Interstitial
          </span>
        </div>

        {/* AdMob 로고/아이콘 */}
        <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <h2 className="text-white text-2xl font-black leading-tight tracking-tight mb-2">
            AdMob 전면 광고
          </h2>
          <p className="text-white/70 text-sm font-medium leading-relaxed">
            실제 출시 후 이 자리에 AdMob 전면 광고가 표시됩니다.
          </p>
        </div>

        {/* 테스트 ID 정보 */}
        <div className="w-full bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
            Test Ad Unit ID
          </p>
          <p className="text-[11px] text-white/80 font-mono font-bold break-all leading-tight">
            {ADMOB_TEST_INTERSTITIAL_ID}
          </p>
        </div>

        {/* 활성 상태 표시 */}
        {isActive && (
          <div className="flex items-center gap-2 text-white/50">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ad Active</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdMobInterstitialPlaceholder;
