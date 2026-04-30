import React, { useEffect, useRef, useState } from 'react';

// AdMob 테스트 광고 단위 ID (실제 출시 시 교체 필요)
const ADMOB_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

interface AdMobBannerProps {
  className?: string;
}

/**
 * AdMob 광고 배너 컴포넌트
 *
 * - Capacitor 네이티브 환경: @capacitor-community/admob 플러그인으로 실제 광고 표시
 * - 웹/개발 환경: 광고 자리 표시자(placeholder) UI 표시
 *
 * 실제 출시 시:
 * 1. ADMOB_TEST_BANNER_ID를 실제 광고 단위 ID로 교체
 * 2. AndroidManifest.xml에 AdMob App ID 추가
 * 3. build.gradle에 play-services-ads 의존성 추가
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ className = '' }) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAdMob = async () => {
      try {
        const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

        if (!isNative) {
          // 웹 환경: placeholder 표시
          setAdLoaded(false);
          return;
        }

        // 네이티브 환경: AdMob 플러그인 동적 로드
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admobModule = await import('@capacitor-community/admob' as any);
        const { AdMob, BannerAdSize, BannerAdPosition } = admobModule;

        await AdMob.initialize({
          testingDevices: [],
          initializeForTesting: true,
        });

        await AdMob.showBanner({
          adId: ADMOB_TEST_BANNER_ID,
          adSize: BannerAdSize.BANNER,
          position: BannerAdPosition.CENTER,
          margin: 0,
          isTesting: true,
        });

        setAdLoaded(true);
      } catch (err) {
        console.error('[AdMobBanner] 광고 로드 실패:', err);
        setAdError(true);
      }
    };

    initAdMob();
  }, []);

  // 광고 로드 실패 시 숨김
  if (adError) return null;

  return (
    <div className={`w-full bg-gray-50 border-y border-gray-100 ${className}`}>
      {/* 광고 라벨 */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          광고
        </span>
        <span className="text-[10px] text-gray-300">Sponsored</span>
      </div>

      {/* 광고 영역 */}
      <div className="w-full min-h-[100px] flex items-center justify-center bg-gray-100 mx-0 mb-2 rounded-none">
        {!adLoaded ? (
          // 웹/개발 환경 또는 광고 로딩 중: 테스트 광고 placeholder
          <div className="w-full h-[100px] bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-1 border border-dashed border-indigo-200">
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
        ) : (
          // 네이티브 환경: AdMob이 이 영역에 광고를 렌더링
          <div id="admob-banner-container" className="w-full h-[100px]" />
        )}
      </div>
    </div>
  );
};

export default AdMobBanner;