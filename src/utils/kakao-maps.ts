const KAKAO_MAPS_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=79d8615ee18c3979de0b737fd62b2f90&libraries=services,clusterer&autoload=false';
const KAKAO_MAPS_SCRIPT_ID = 'kakao-maps-sdk';

let kakaoMapsSdkPromise: Promise<void> | null = null;

export const loadKakaoMapsSdk = () => {
  const win = window as any;
  if (win.kakao?.maps?.Map && win.kakao?.maps?.LatLng && win.kakao?.maps?.services) {
    return Promise.resolve();
  }
  if (kakaoMapsSdkPromise) return kakaoMapsSdkPromise;

  kakaoMapsSdkPromise = new Promise<void>((resolve, reject) => {
    const completeLoad = () => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps) {
        reject(new Error('Kakao Maps SDK is unavailable'));
        return;
      }
      if (kakao.maps.Map && kakao.maps.LatLng && kakao.maps.services) {
        resolve();
        return;
      }
      if (typeof kakao.maps.load === 'function') {
        kakao.maps.load(() => resolve());
      } else {
        resolve();
      }
    };

    const existingScript = document.getElementById(KAKAO_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if ((window as any).kakao?.maps) completeLoad();
      else {
        existingScript.addEventListener('load', completeLoad, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Kakao Maps SDK')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_MAPS_SCRIPT_ID;
    script.type = 'text/javascript';
    script.async = true;
    script.src = KAKAO_MAPS_SDK_URL;
    script.onload = completeLoad;
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'));
    document.head.appendChild(script);
  }).catch((error) => {
    kakaoMapsSdkPromise = null;
    throw error;
  });

  return kakaoMapsSdkPromise;
};
