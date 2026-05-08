import React, { useEffect, useRef, useCallback } from 'react';
// @ts-ignore — heatmapjs has no bundled type declarations
import h337 from 'heatmapjs';

interface HeatmapPoint {
  lat: number;
  lng: number;
}

interface HeatmapOverlayProps {
  points: HeatmapPoint[];
  mapInstance: any;
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

const HEATMAP_RADIUS_METERS = 1800;

const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ points, mapInstance, visible, containerRef }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const heatInstanceRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // heatmap.js 인스턴스 초기화
  const initHeat = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || heatInstanceRef.current) return;

    heatInstanceRef.current = h337.create({
      container: wrapper,
      radius: 40,
      maxOpacity: 0.85,
      minOpacity: 0,
      blur: 0.85,
      gradient: {
        '0.0': '#64d2ff',
        '0.4': '#64d2ff',
        '0.55': '#ffee30',
        '0.70': '#ff8c00',
        '1.0': '#c80000',
      },
    });
  }, []);

  const drawHeatmap = useCallback(() => {
    if (!heatInstanceRef.current || !mapInstance) return;

    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const wrapper = wrapperRef.current;
    const mapContainer = containerRef.current;
    if (!wrapper || !mapContainer) return;

    const W = mapContainer.offsetWidth;
    const H = mapContainer.offsetHeight;
    if (W === 0 || H === 0) return;

    const map = mapInstance;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const latRange = ne.getLat() - sw.getLat();
    const lngRange = ne.getLng() - sw.getLng();
    if (latRange === 0 || lngRange === 0) return;

    // 반경: 미터 → 픽셀 변환
    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(20, Math.min(600, HEATMAP_RADIUS_METERS / metersPerPixel));

    // 위경도 → 픽셀 좌표 변환
    const heatPoints = points
      .map(p => ({
        x: Math.round(((p.lng - sw.getLng()) / lngRange) * W),
        y: Math.round((1 - (p.lat - sw.getLat()) / latRange) * H),
        value: 1,
      }))
      .filter(p => p.x >= -radiusPx && p.x <= W + radiusPx && p.y >= -radiusPx && p.y <= H + radiusPx);

    // 포인트 수에 따라 max 조정 (밀도 정규화)
    const max = Math.max(1, Math.ceil(points.length * 0.8));

    heatInstanceRef.current.configure({ radius: radiusPx });
    heatInstanceRef.current.setData({ max, min: 0, data: heatPoints });
  }, [points, mapInstance, containerRef]);

  const resizeWrapper = useCallback(() => {
    const wrapper = wrapperRef.current;
    const mapContainer = containerRef.current;
    if (!wrapper || !mapContainer) return;

    const W = mapContainer.offsetWidth;
    const H = mapContainer.offsetHeight;

    wrapper.style.width = `${W}px`;
    wrapper.style.height = `${H}px`;

    // heatmap.js 내부 canvas 크기 동기화
    if (heatInstanceRef.current) {
      const canvas = wrapper.querySelector('canvas');
      if (canvas && (canvas.width !== W || canvas.height !== H)) {
        canvas.width = W;
        canvas.height = H;
      }
    }

    drawHeatmap();
  }, [drawHeatmap, containerRef]);

  // 마운트 시 인스턴스 생성
  useEffect(() => {
    if (!visible) return;
    initHeat();
  }, [visible, initHeat]);

  // 지도 이벤트 연동
  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const handleUpdate = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => resizeWrapper());
    };

    kakao.maps.event.addListener(mapInstance, 'idle', handleUpdate);
    kakao.maps.event.addListener(mapInstance, 'zoom_changed', handleUpdate);
    kakao.maps.event.addListener(mapInstance, 'drag', handleUpdate);
    kakao.maps.event.addListener(mapInstance, 'dragend', handleUpdate);

    handleUpdate();

    return () => {
      kakao.maps.event.removeListener(mapInstance, 'idle', handleUpdate);
      kakao.maps.event.removeListener(mapInstance, 'zoom_changed', handleUpdate);
      kakao.maps.event.removeListener(mapInstance, 'drag', handleUpdate);
      kakao.maps.event.removeListener(mapInstance, 'dragend', handleUpdate);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapInstance, visible, resizeWrapper]);

  // points 변경 시 재렌더
  useEffect(() => {
    if (!visible) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => resizeWrapper());
  }, [points, visible, resizeWrapper]);

  // 컨테이너 크기 변경 감지
  useEffect(() => {
    const mapContainer = containerRef.current;
    if (!mapContainer) return;
    const ro = new ResizeObserver(() => resizeWrapper());
    ro.observe(mapContainer);
    return () => ro.disconnect();
  }, [resizeWrapper, containerRef]);

  if (!visible) return null;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};

export default HeatmapOverlay;
