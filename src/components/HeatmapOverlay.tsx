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

const HEATMAP_RADIUS_METERS = 600;

const PALETTE: Array<[number, [number, number, number, number]]> = [
  [0.0,  [100, 210, 255,   0]],   // 투명 하늘색
  [0.05, [100, 210, 255, 130]],   // 하늘색
  [0.20, [ 40, 200, 180, 170]],   // 청록색
  [0.35, [ 60, 210,  80, 195]],   // 초록색
  [0.50, [180, 230,  30, 210]],   // 연두-노란색
  [0.65, [255, 220,   0, 220]],   // 노란색
  [0.78, [255, 120,   0, 232]],   // 주황색
  [0.90, [255,  30,   0, 240]],   // 빨간색
  [1.0,  [180,   0,   0, 248]],   // 진한 빨간색
];

function getColor(intensity: number): [number, number, number, number] {
  if (intensity < 0.005) return [0, 0, 0, 0];
  const v = Math.min(intensity, 1.0);
  for (let i = 0; i < PALETTE.length - 1; i++) {
    const [t0, c0] = PALETTE[i];
    const [t1, c1] = PALETTE[i + 1];
    if (v >= t0 && v <= t1) {
      const t = t1 === t0 ? 0 : (v - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
        Math.round(c0[3] + (c1[3] - c0[3]) * t),
      ];
    }
  }
  return [200, 0, 0, 245];
}

const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ points, mapInstance, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  // 드래그 시작 시점의 지도 중심 (위경도)
  const dragStartCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  // 히트맵을 현재 지도 bounds 기준으로 캔버스에 그림
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

    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(6, Math.min(400, HEATMAP_RADIUS_METERS / metersPerPixel));

    const SCALE = Math.max(1, Math.min(4, Math.floor(radiusPx / 30)));
    const SW = Math.ceil(W / SCALE);
    const SH = Math.ceil(H / SCALE);
    const sRadius = radiusPx / SCALE;

    const toScaledPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * SW,
      y: (1 - (lat - sw.getLat()) / latRange) * SH,
    });

    const buf = new Float32Array(SW * SH);

    const visiblePoints = points.filter(p => {
      const { x, y } = toScaledPixel(p.lat, p.lng);
      return x >= -sRadius && x <= SW + sRadius && y >= -sRadius && y <= SH + sRadius;
    });

    if (visiblePoints.length === 0) return;

    const maxPossible = Math.max(3, points.length * 0.7);

    for (const point of visiblePoints) {
      const { x: cx, y: cy } = toScaledPixel(point.lat, point.lng);
      const x0 = Math.max(0, Math.floor(cx - sRadius));
      const x1 = Math.min(SW - 1, Math.ceil(cx + sRadius));
      const y0 = Math.max(0, Math.floor(cy - sRadius));
      const y1 = Math.min(SH - 1, Math.ceil(cy + sRadius));

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const distSq = dx * dx + dy * dy;
          if (distSq > sRadius * sRadius) continue;
          const t = Math.sqrt(distSq) / sRadius;
          buf[py * SW + px] += Math.exp(-3.5 * t * t);
        }
      }
    }

    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    for (let fy = 0; fy < H; fy++) {
      const sy = Math.min(SH - 1, Math.floor(fy / SCALE));
      for (let fx = 0; fx < W; fx++) {
        const sx = Math.min(SW - 1, Math.floor(fx / SCALE));
        const raw = buf[sy * SW + sx];
        if (raw < 0.001) continue;
        const normalized = Math.min(raw / maxPossible, 1.0);
        // 감마 < 1: 낮은 강도 영역도 색상이 잘 보이게 (1개짜리 포인트도 표시)
        const intensity = Math.pow(normalized, 0.7);
        const [r, g, b, a] = getColor(intensity);
        const idx = (fy * W + fx) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    // 재계산 후 transform 초기화
    canvas.style.transform = '';
    canvas.style.transformOrigin = '';
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

  const scheduleRedraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
  }, [resizeCanvas]);

  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    // 드래그 시작: 현재 중심 기록, 드래그 플래그 ON
    const handleDragStart = () => {
      isDraggingRef.current = true;
      const center = mapInstance.getCenter();
      dragStartCenterRef.current = {
        lat: center.getLat(),
        lng: center.getLng(),
      };
    };

    // 드래그 중: 지도가 이동한 픽셀만큼 캔버스를 CSS translate로 실시간 이동
    const handleDrag = () => {
      const canvas = canvasRef.current;
      if (!canvas || !dragStartCenterRef.current) return;

      const map = mapInstance;
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const W = canvas.width;
      const H = canvas.height;

      const latRange = ne.getLat() - sw.getLat();
      const lngRange = ne.getLng() - sw.getLng();
      if (latRange === 0 || lngRange === 0) return;

      const currentCenter = map.getCenter();
      const startCenter = dragStartCenterRef.current;

      // 드래그 시작 중심과 현재 중심의 차이를 픽셀로 변환
      const dLat = currentCenter.getLat() - startCenter.lat;
      const dLng = currentCenter.getLng() - startCenter.lng;

      const dx = -(dLng / lngRange) * W;
      const dy =  (dLat / latRange) * H;

      canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    // 드래그 끝: 플래그 OFF, 히트맵 재계산 (transform 초기화 포함)
    const handleDragEnd = () => {
      isDraggingRef.current = false;
      dragStartCenterRef.current = null;
      scheduleRedraw();
    };

    // 줌 변경 / idle: 재계산
    const handleUpdate = () => {
      if (!isDraggingRef.current) scheduleRedraw();
    };

    kakao.maps.event.addListener(mapInstance, 'dragstart', handleDragStart);
    kakao.maps.event.addListener(mapInstance, 'drag',      handleDrag);
    kakao.maps.event.addListener(mapInstance, 'dragend',   handleDragEnd);
    kakao.maps.event.addListener(mapInstance, 'zoom_changed', handleUpdate);
    kakao.maps.event.addListener(mapInstance, 'idle',      handleUpdate);

    scheduleRedraw();

    return () => {
      kakao.maps.event.removeListener(mapInstance, 'dragstart', handleDragStart);
      kakao.maps.event.removeListener(mapInstance, 'drag',      handleDrag);
      kakao.maps.event.removeListener(mapInstance, 'dragend',   handleDragEnd);
      kakao.maps.event.removeListener(mapInstance, 'zoom_changed', handleUpdate);
      kakao.maps.event.removeListener(mapInstance, 'idle',      handleUpdate);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapInstance, visible, scheduleRedraw]);

  useEffect(() => {
    if (!visible) return;
    scheduleRedraw();
  }, [points, visible, scheduleRedraw]);

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
        willChange: 'transform',
      }}
    />
  );
};

export default HeatmapOverlay;
