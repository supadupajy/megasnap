import React, { useEffect, useRef, useCallback } from 'react';
// @ts-ignore — simpleheat has no bundled type declarations
import simpleheat from 'simpleheat';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

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

    // simpleheat 인스턴스 초기화 (캔버스 크기 변경 시 재생성)
    if (!heatRef.current) {
      heatRef.current = simpleheat(canvas);
    }

    const heat = heatRef.current;

    // 반경: 미터 → 픽셀 변환
    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(20, Math.min(600, HEATMAP_RADIUS_METERS / metersPerPixel));
    const blurPx = radiusPx * 0.85;

    // 위경도 → 캔버스 픽셀 좌표 변환
    const heatPoints = points
      .filter(p => {
        const x = ((p.lng - sw.getLng()) / lngRange) * W;
        const y = (1 - (p.lat - sw.getLat()) / latRange) * H;
        return x >= -radiusPx && x <= W + radiusPx && y >= -radiusPx && y <= H + radiusPx;
      })
      .map(p => {
        const x = ((p.lng - sw.getLng()) / lngRange) * W;
        const y = (1 - (p.lat - sw.getLat()) / latRange) * H;
        return [x, y, 1] as [number, number, number];
      });

    heat.data(heatPoints);
    heat.radius(radiusPx, blurPx);
    heat.max(Math.max(1, points.length * 0.8));
    heat.gradient({
      0.00: '#64d2ff',
      0.35: '#64d2ff',
      0.50: '#ffee30',
      0.65: '#ff8c00',
      1.00: '#c80000',
    });

    heat.draw(0.0);
  }, [points, mapInstance]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !mapInstance || !container) return;

    const W = container.offsetWidth;
    const H = container.offsetHeight;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      // 캔버스 크기 변경 시 simpleheat 인스턴스 재생성
      heatRef.current = simpleheat(canvas);
    }

    drawHeatmap();
  }, [drawHeatmap, mapInstance, containerRef]);

  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const handleUpdate = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
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
  }, [mapInstance, visible, resizeCanvas]);

  useEffect(() => {
    if (!visible) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
  }, [points, visible, resizeCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [resizeCanvas, containerRef]);

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
        zIndex: 10,
      }}
    />
  );
};

export default HeatmapOverlay;
