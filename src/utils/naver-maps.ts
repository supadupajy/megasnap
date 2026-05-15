// 네이버 지도 SDK 로더 (테스트 페이지 전용)
// 본 서비스의 카카오맵 로직과는 완전히 분리되어 있음.
const NAVER_CLIENT_ID = 'ipu2vry3sw';
const NAVER_MAPS_SDK_URL = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}`;
const NAVER_MAPS_SCRIPT_ID = 'naver-maps-sdk';

let naverMapsSdkPromise: Promise<void> | null = null;

export const loadNaverMapsSdk = (): Promise<void> => {
  const win = window as any;
  if (win.naver?.maps?.Map && win.naver?.maps?.LatLng) {
    return Promise.resolve();
  }
  if (naverMapsSdkPromise) return naverMapsSdkPromise;

  naverMapsSdkPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(NAVER_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    const completeLoad = () => {
      const naver = (window as any).naver;
      if (naver?.maps?.Map) {
        resolve();
      } else {
        reject(new Error('Naver Maps SDK loaded but maps API is unavailable'));
      }
    };

    if (existingScript) {
      if ((window as any).naver?.maps) {
        completeLoad();
      } else {
        existingScript.addEventListener('load', completeLoad, { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Failed to load Naver Maps SDK')),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.id = NAVER_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = NAVER_MAPS_SDK_URL;
    script.onload = completeLoad;
    script.onerror = () => reject(new Error('Failed to load Naver Maps SDK'));
    document.head.appendChild(script);
  }).catch((err) => {
    naverMapsSdkPromise = null;
    throw err;
  });

  return naverMapsSdkPromise;
};
