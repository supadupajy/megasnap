import React, { useEffect, useRef, useCallback } from 'react';
// @ts-ignore – simpleheat has no bundled types
import simpleheat from 'simpleheat';

interface HeatmapPoint {
  lat: number;
  lng: number;
}

interface HeatmapOverlayProps {
  points: HeatmapPoint[];
  mapInstance: any;
  visible: boolean;
}

const HEATMAP_RADIUS_METERS = 600;

const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ points, mapInstance, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  // 드래그 시작 시점의 bounds (픽셀 변환 기준)
  const dragStartBoundsRef = useRef<{
    swLat: number; swLng: number;
    latRange: number; lngRange: number;
  } | null>(null);

  /** 현재 지도 bounds 기준으로 simpleheat 데이터를 계산하고 draw */
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapInstance) return;

    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const map = mapInstance;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const W = canvas.width;
    const H = canvas.height;
    if (W === 0 || H === 0) return;

    const latRange = ne.getLat() - sw.getLat();
    const lngRange = ne.getLng() - sw.getLng();
    if (latRange === 0 || lngRange === 0) return;

    // simpleheat 인스턴스 생성 또는 재사용
    if (!heatRef.current) {
      heatRef.current = simpleheat(canvas);
    }
    const heat = heatRef.current;

    // 반경(px) 계산
    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(10, Math.min(400, HEATMAP_RADIUS_METERS / metersPerPixel));
    const blurPx = radiusPx * 0.85;

    // 위경도 → 캔버스 픽셀 변환
    const toPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * W,
      y: (1 - (lat - sw.getLat()) / latRange) * H,
    });

    // 화면 밖 포인트 필터링 후 [x, y, intensity] 배열 생성
    const margin = radiusPx;
    const data: [number, number, number][] = points
      .filter(p => {
        const { x, y } = toPixel(p.lat, p.lng);
        return x >= -margin && x <= W + margin && y >= -margin && y <= H + margin;
      })
      .map(p => {
        const { x, y } = toPixel(p.lat, p.lng);
        return [x, y, 1];
      });

    heat.clear();

    if (data.length === 0) return;

    heat
      .data(data)
      .max(Math.max(3, data.length * 0.5))
      .radius(radiusPx, blurPx)
      .gradient({
        0.0:  'rgba(100,210,255,0)',
        0.05: 'rgba(100,210,255,0.5)',
        0.20: 'rgba(40,200,180,0.67)',
        0.35: 'rgba(60,210,80,0.76)',
        0.50: 'rgba(180,230,30,0.82)',
        0.65: 'rgba(255,220,0,0.86)',
        0.78: 'rgba(255,120,0,0.91)',
        0.90: 'rgba(255,30,0,0.94)',
        1.0:  'rgba(180,0,0,0.97)',
      })
      .draw(0.05);

    // 재계산 완료 후 CSS transform 초기화
    canvas.style.transform = '';
    canvas.style.transformOrigin = '';
  }, [points, mapInstance]);

  /** 캔버스 크기를 부모에 맞추고 다시 그림 */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapInstance) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const W = parent.offsetWidth;
    const H = parent.offsetHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      // 캔버스 크기가 바뀌면 simpleheat 인스턴스를 재생성해야 함
      heatRef.current = null;
    }
    drawHeatmap();
  }, [drawHeatmap, mapInstance]);

  const scheduleRedraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = null;
      resizeCanvas();
    });
  }, [resizeCanvas]);

  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const handleDragStart = () => {
      isDraggingRef.current = true;
      const center = mapInstance.getCenter();
      dragStartCenterRef.current = { lat: center.getLat(), lng: center.getLng() };

      // 드래그 시작 시점의 bounds를 저장 (drag 중 픽셀 계산 기준)
      const bounds = mapInstance.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      dragStartBoundsRef.current = {
        swLat: sw.getLat(),
        swLng: sw.getLng(),
        latRange: ne.getLat() - sw.getLat(),
        lngRange: ne.getLng() - sw.getLng(),
      };
    };

    const handleDrag = () => {
      const canvas = canvasRef.current;
      if (!canvas || !dragStartCenterRef.current || !dragStartBoundsRef.current) return;

      const { latRange, lngRange } = dragStartBoundsRef.current;
      if (latRange === 0 || lngRange === 0) return;

      const W = canvas.width;
      const H = canvas.height;
      const currentCenter = mapInstance.getCenter();
      const startCenter = dragStartCenterRef.current;

      const dLat = currentCenter.getLat() - startCenter.lat;
      const dLng = currentCenter.getLng() - startCenter.lng;

      const dx = -(dLng / lngRange) * W;
      const dy =  (dLat / latRange) * H;

      canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      dragStartCenterRef.current = null;
      dragStartBoundsRef.current = null;
      // 드래그 끝난 후 한 번만 재계산
      scheduleRedraw();
    };

    // zoom_changed: 드래그 중이 아닐 때만 재계산
    const handleZoomChanged = () => {
      if (!isDraggingRef.current) scheduleRedraw();
    };

    // idle: 드래그 중이거나 이미 redraw가 예약된 경우 무시
    // dragend 직후 idle이 연달아 발생해 깜빡임이 생기는 것을 방지
    const handleIdle = () => {
      if (isDraggingRef.current) return;
      if (animFrameRef.current !== null) return; // 이미 예약됨
      scheduleRedraw();
    };

    kakao.maps.event.addListener(mapInstance, 'dragstart',    handleDragStart);
    kakao.maps.event.addListener(mapInstance, 'drag',         handleDrag);
    kakao.maps.event.addListener(mapInstance, 'dragend',      handleDragEnd);
    kakao.maps.event.addListener(mapInstance, 'zoom_changed', handleZoomChanged);
    kakao.maps.event.addListener(mapInstance, 'idle',         handleIdle);

    scheduleRedraw();

    return () => {
      kakao.maps.event.removeListener(mapInstance, 'dragstart',    handleDragStart);
      kakao.maps.event.removeListener(mapInstance, 'drag',         handleDrag);
      kakao.maps.event.removeListener(mapInstance, 'dragend',      handleDragEnd);
      kakao.maps.event.removeListener(mapInstance, 'zoom_changed', handleZoomChanged);
      kakao.maps.event.removeListener(mapInstance, 'idle',         handleIdle);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [mapInstance, visible, scheduleRedraw]);

  // points / visible 변경 시 재그리기
  useEffect(() => {
    if (!visible) return;
    scheduleRedraw();
  }, [points, visible, scheduleRedraw]);

  // 부모 크기 변경 감지
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      if (!isDraggingRef.current) resizeCanvas();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
        willChange: 'transform',
      }}
    />
  );
};

export default HeatmapOverlay;
