import React, { useEffect, useRef, useCallback } from 'react';
// @ts-ignore
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

    // simpleheat 인스턴스가 없거나 canvas가 바뀌면 재생성
    if (!heatRef.current) {
      heatRef.current = simpleheat(canvas);
    }

    const heat = heatRef.current;

    // 반경: 미터 → 픽셀 변환
    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(20, Math.min(600, HEATMAP_RADIUS_METERS / metersPerPixel));
    const blurPx = radiusPx * 0.85;

    // 위경도 → 캔버스 픽셀 좌표 변환 (화면 밖 포인트 포함해 블러가 자연스럽게)
    const heatPoints = points
      .map(p => [
        ((p.lng - sw.getLng()) / lngRange) * W,
        (1 - (p.lat - sw.getLat()) / latRange) * H,
        1,
      ] as [number, number, number])
      .filter(([x, y]) => x >= -radiusPx && x <= W + radiusPx && y >= -radiusPx && y <= H + radiusPx);

    // max를 낮게 고정 → 포인트 1개도 선명하게 표시
    // 포인트가 많아질수록 조금씩 올려 과포화 방지
    const max = Math.max(1, Math.min(3, Math.ceil(heatPoints.length / 5)));

    heat.data(heatPoints);
    heat.radius(radiusPx, blurPx);
    heat.max(max);
    heat.gradient({
      0.0:  '#64d2ff',
      0.35: '#64d2ff',
      0.55: '#ffee30',
      0.75: '#ff8c00',
      1.0:  '#c80000',
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
      // 캔버스 크기 변경 시 simpleheat 인스턴스 재생성 (내부 버퍼 크기 동기화)
      heatRef.current = simpleheat(canvas);
    }

    drawHeatmap();
  }, [drawHeatmap, mapInstance, containerRef]);

  // 지도 이벤트 연동
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

  // points 변경 시 재렌더
  useEffect(() => {
    if (!visible) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
  }, [points, visible, resizeCanvas]);

  // 컨테이너 크기 변경 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
    });
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
