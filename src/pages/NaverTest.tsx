import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadNaverMapsSdk } from '@/utils/naver-maps';
import { ArrowLeft, Plus, Minus, Locate } from 'lucide-react';

// 서울 주요 위치 샘플 마커 (카카오 마커 디자인과 유사한 모양)
const SAMPLE_MARKERS = [
  { id: 'm1', lat: 37.5665, lng: 126.978, label: '서울시청', color: '#6366F1' },
  { id: 'm2', lat: 37.5512, lng: 126.9882, label: '남산타워', color: '#EC4899' },
  { id: 'm3', lat: 37.5796, lng: 126.977, label: '경복궁', color: '#F59E0B' },
  { id: 'm4', lat: 37.5172, lng: 127.0473, label: '강남역', color: '#10B981' },
  { id: 'm5', lat: 37.5759, lng: 126.9769, label: '광화문', color: '#3B82F6' },
];

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

const NaverTest = () => {
  const navigate = useNavigate();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [zoom, setZoom] = useState<number>(14);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadNaverMapsSdk()
      .then(() => {
        if (cancelled || !mapEl.current) return;
        const naver = (window as any).naver;

        // 컨테이너 크기가 잡힌 후 생성하도록 한 프레임 지연
        const container = mapEl.current;
        console.log('[NaverTest] container size before init:', {
          width: container.offsetWidth,
          height: container.offsetHeight,
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
        });

        const map = new naver.maps.Map(container, {
          center: new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          zoom: 14,
          minZoom: 6,
          maxZoom: 21,
          zoomControl: false,
          scaleControl: false,
          mapDataControl: false,
          logoControl: true,
          // 스무스 줌 핵심 옵션
          scrollWheel: true,
          pinchZoom: true,
          disableDoubleClickZoom: false,
        });
        mapRef.current = map;

        // 컨테이너 크기가 늦게 잡히는 경우 대비 — 리사이즈 트리거
        const triggerResize = () => {
          if (!mapRef.current) return;
          naver.maps.Event.trigger(mapRef.current, 'resize');
          console.log('[NaverTest] resize triggered. container size:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
          });
        };
        // 여러 시점에 시도 (마운트 직후, 다음 프레임, 100ms, 500ms)
        requestAnimationFrame(triggerResize);
        const t1 = window.setTimeout(triggerResize, 100);
        const t2 = window.setTimeout(triggerResize, 500);

        // ResizeObserver로 컨테이너 크기 변화 감지
        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => {
            if (mapRef.current) {
              naver.maps.Event.trigger(mapRef.current, 'resize');
            }
          });
          ro.observe(container);
        }

        // cleanup 등록
        (mapRef.current as any).__cleanupExtras = () => {
          window.clearTimeout(t1);
          window.clearTimeout(t2);
          ro?.disconnect();
        };

        // 줌 변경 감지
        naver.maps.Event.addListener(map, 'zoom_changed', (z: number) => {
          setZoom(z);
        });

        // 샘플 마커 생성 (카카오의 CustomOverlay 대응 = 네이버는 Marker + HtmlIcon)
        SAMPLE_MARKERS.forEach((m) => {
          const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(m.lat, m.lng),
            map,
            icon: {
              content: `
                <div class="naver-test-marker" data-id="${m.id}" style="
                  position: relative;
                  width: 44px;
                  height: 56px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  cursor: pointer;
                  transform: translateY(-28px);
                ">
                  <div style="
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: ${m.color};
                    border: 3px solid white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: 13px;
                  ">${m.label.slice(0, 2)}</div>
                  <div style="
                    width: 0;
                    height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 8px solid ${m.color};
                    margin-top: -2px;
                  "></div>
                </div>
              `,
              anchor: new naver.maps.Point(22, 56),
            },
          });

          naver.maps.Event.addListener(marker, 'click', () => {
            setSelected(m.id);
            map.panTo(new naver.maps.LatLng(m.lat, m.lng));
          });

          markersRef.current.push(marker);
        });

        setStatus('ready');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error('[NaverTest] SDK load failed:', err);
        setErrorMsg(err.message || 'SDK 로드 실패');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (mapRef.current?.__cleanupExtras) {
        mapRef.current.__cleanupExtras();
      }
      mapRef.current = null;
    };
  }, []);

  const handleZoomIn = () => {
    const map = mapRef.current;
    if (!map) return;
    const naver = (window as any).naver;
    // 두 번째 인자 true = 부드러운 줌 애니메이션
    map.setZoom(map.getZoom() + 1, true);
  };

  const handleZoomOut = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() - 1, true);
  };

  const handleResetCenter = () => {
    const map = mapRef.current;
    if (!map) return;
    const naver = (window as any).naver;
    map.panTo(new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
  };

  const selectedMarker = SAMPLE_MARKERS.find((m) => m.id === selected);

  return (
    <div
      className="fixed inset-0 bg-gray-100"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* 지도 컨테이너 — 명시적 크기 필수 (네이버 SDK가 0x0이면 타일 안 그림) */}
      <div
        ref={mapEl}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', minHeight: '100vh' }}
      />

      {/* 상단 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">네이버 지도 테스트</h1>
            <p className="text-xs text-gray-500">스무스 줌 / 마커 / 인터랙션 체험용</p>
          </div>
          <div className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
            zoom {zoom}
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-600">네이버 지도 SDK 로딩 중...</p>
          </div>
        </div>
      )}

      {/* 에러 상태 */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 z-20 p-6">
          <div className="max-w-sm text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">SDK 로드 실패</h2>
            <p className="text-sm text-gray-600 mb-4">{errorMsg}</p>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 text-left space-y-1">
              <p><strong>체크리스트:</strong></p>
              <p>1. 네이버 클라우드 콘솔에서 Web Dynamic Map 활성화 확인</p>
              <p>2. 등록한 Web 서비스 URL이 현재 도메인과 일치하는지 확인</p>
              <p>3. Client ID: <code className="bg-white px-1">ipu2vry3sw</code></p>
              <p>4. 현재 도메인: <code className="bg-white px-1">{window.location.origin}</code></p>
            </div>
          </div>
        </div>
      )}

      {/* 줌 컨트롤 (오른쪽 하단) */}
      {status === 'ready' && (
        <div className="absolute right-4 bottom-32 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
            aria-label="확대"
          >
            <Plus className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
            aria-label="축소"
          >
            <Minus className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleResetCenter}
            className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
            aria-label="중심 초기화"
          >
            <Locate className="w-5 h-5 text-indigo-600" />
          </button>
        </div>
      )}

      {/* 하단 안내 패널 */}
      {status === 'ready' && (
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-4 max-w-md mx-auto">
            {selectedMarker ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: selectedMarker.color }}
                  />
                  <h3 className="font-bold text-gray-900">{selectedMarker.label}</h3>
                </div>
                <p className="text-xs text-gray-500">
                  {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="mt-2 text-xs text-indigo-600 font-medium"
                >
                  선택 해제
                </button>
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">🧪 체험해보세요</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 마우스 휠 / 핀치로 <strong>줌</strong>해보기 (부드러움 확인)</li>
                  <li>• 마커 클릭 → 부드러운 panTo 이동</li>
                  <li>• +/- 버튼으로 애니메이션 줌 테스트</li>
                  <li>• 카카오맵과 직접 비교: 본 서비스로 돌아가서 줌해보기</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NaverTest;
