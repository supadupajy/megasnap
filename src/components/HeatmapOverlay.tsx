import React, { useEffect, useRef, useCallback } from 'react';

interface HeatmapPoint {
  lat: number;
  lng: number;
}

interface HeatmapOverlayProps {
  points: HeatmapPoint[];
  mapInstance: any;
  visible: boolean;
}

// 히트맵 1개 포인트의 영향 반경 (실제 지리 거리, 미터)
const HEATMAP_RADIUS_METERS = 1800;

const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ points, mapInstance, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    if (points.length === 0) return;

    // 지리적 거리 → 픽셀 반경 변환
    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(20, Math.min(600, HEATMAP_RADIUS_METERS / metersPerPixel));

    const toPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * W,
      y: (1 - (lat - sw.getLat()) / latRange) * H,
    });

    // 각 포인트를 radialGradient로 그려서 자연스러운 그라데이션 보장
    // globalCompositeOperation 'screen'으로 겹치는 영역이 밝아지게 합성
    ctx.globalCompositeOperation = 'screen';

    const visiblePoints = points.filter(p => {
      const { x, y } = toPixel(p.lat, p.lng);
      return x >= -radiusPx && x <= W + radiusPx && y >= -radiusPx && y <= H + radiusPx;
    });

    for (const point of visiblePoints) {
      const { x, y } = toPixel(point.lat, point.lng);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radiusPx);
      gradient.addColorStop(0.0,  'rgba(100, 220, 255, 0.85)');
      gradient.addColorStop(0.25, 'rgba(80,  200, 255, 0.60)');
      gradient.addColorStop(0.55, 'rgba(60,  180, 240, 0.30)');
      gradient.addColorStop(0.80, 'rgba(40,  160, 220, 0.10)');
      gradient.addColorStop(1.0,  'rgba(20,  140, 200, 0.00)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }, [points, mapInstance]);

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
    }
    drawHeatmap();
  }, [drawHeatmap, mapInstance]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => resizeCanvas());
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
      }}
    />
  );
};

export default HeatmapOverlay;
