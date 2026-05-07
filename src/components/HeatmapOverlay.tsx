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

    const toPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * W,
      y: (1 - (lat - sw.getLat()) / latRange) * H,
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    if (points.length === 0) return;

    // 지도 레벨에 따라 반경 조정
    const level = map.getLevel();
    const radius = Math.max(40, Math.min(160, level * 18));

    // ── Step 1: 오프스크린 캔버스에 강도 맵 그리기 (흑백) ──
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.globalCompositeOperation = 'source-over';

    for (const point of points) {
      const { x, y } = toPixel(point.lat, point.lng);
      if (x < -radius || x > W + radius || y < -radius || y > H + radius) continue;

      const gradient = offCtx.createRadialGradient(x, y, 0, x, y, radius);
      // 중심은 강하게, 가장자리는 0으로
      gradient.addColorStop(0,   'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
      gradient.addColorStop(1,   'rgba(255,255,255,0)');

      offCtx.fillStyle = gradient;
      offCtx.beginPath();
      offCtx.arc(x, y, radius, 0, Math.PI * 2);
      offCtx.fill();
    }

    // ── Step 2: 강도 맵 픽셀 읽기 + 최대값 정규화 ──
    const imageData = offCtx.getImageData(0, 0, W, H);
    const data = imageData.data;

    // 최대 강도값 찾기 (정규화 기준)
    let maxVal = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > maxVal) maxVal = data[i];
    }

    if (maxVal === 0) return; // 아무것도 없으면 종료

    // ── Step 3: 색상 팔레트 적용 ──
    // 하늘색(낮음) → 노란색 → 주황색 → 빨간색(높음)
    // intensity 0~1 기준
    const getColor = (intensity: number): [number, number, number, number] => {
      if (intensity < 0.01) return [0, 0, 0, 0]; // 완전 투명

      // 팔레트: [threshold, [R, G, B, A]]
      const palette: Array<[number, [number, number, number, number]]> = [
        [0.0,  [100, 210, 255,   0]],  // 하늘색 투명
        [0.08, [100, 210, 255, 140]],  // 하늘색
        [0.25, [ 80, 200, 240, 180]],  // 하늘색 진하게
        [0.45, [255, 240,  50, 210]],  // 노란색
        [0.65, [255, 140,   0, 225]],  // 주황색
        [0.82, [255,  50,   0, 235]],  // 주황-빨간
        [1.0,  [200,   0,   0, 245]],  // 진한 빨간색
      ];

      for (let i = 0; i < palette.length - 1; i++) {
        const [t0, c0] = palette[i];
        const [t1, c1] = palette[i + 1];
        if (intensity >= t0 && intensity <= t1) {
          const t = (t1 === t0) ? 0 : (intensity - t0) / (t1 - t0);
          return [
            Math.round(c0[0] + (c1[0] - c0[0]) * t),
            Math.round(c0[1] + (c1[1] - c0[1]) * t),
            Math.round(c0[2] + (c1[2] - c0[2]) * t),
            Math.round(c0[3] + (c1[3] - c0[3]) * t),
          ];
        }
      }
      return [200, 0, 0, 245];
    };

    for (let i = 0; i < data.length; i += 4) {
      // 최대값으로 정규화 → 실제 밀도에 비례한 강도
      const rawIntensity = data[i] / maxVal;
      // 감마 보정: 낮은 밀도 영역을 더 잘 보이게
      const intensity = Math.pow(rawIntensity, 0.6);
      const [r, g, b, a] = getColor(intensity);
      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }

    ctx.putImageData(imageData, 0, 0);
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
      animFrameRef.current = requestAnimationFrame(() => {
        resizeCanvas();
      });
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
    animFrameRef.current = requestAnimationFrame(() => {
      resizeCanvas();
    });
  }, [points, visible, resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      resizeCanvas();
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
      }}
    />
  );
};

export default HeatmapOverlay;
