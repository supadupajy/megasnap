import React, { useEffect, useRef, useCallback } from 'react';

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

const HEATMAP_RADIUS_METERS = 600;
// 마커 주변에 뚫을 구멍 반경 (px) — 마커 크기(60px)의 절반보다 약간 크게
const MARKER_HOLE_RADIUS = 38;

const PALETTE: Array<[number, [number, number, number, number]]> = [
  [0.00, [100, 210, 255,   0]],
  [0.08, [100, 210, 255,  70]],
  [0.20, [ 60, 220, 160, 130]],
  [0.35, [120, 220,  40, 170]],
  [0.50, [210, 230,   0, 195]],
  [0.65, [255, 220,   0, 210]],
  [0.78, [255, 160,   0, 220]],
  [0.88, [255,  60,   0, 228]],
  [0.95, [160,   0,  30, 238]],
  [1.00, [ 90,   0, 160, 245]],
];

function getColor(intensity: number): [number, number, number, number] {
  if (intensity <= 0) return [0, 0, 0, 0];
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
  return PALETTE[PALETTE.length - 1][1];
}

const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ points, mapInstance, visible, containerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapInstance) return;

    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const map = mapInstance;
    const container = containerRef.current;
    if (!container) return;

    const W = container.offsetWidth;
    const H = container.offsetHeight;
    if (W === 0 || H === 0) return;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const latRange = ne.getLat() - sw.getLat();
    const lngRange = ne.getLng() - sw.getLng();
    if (latRange === 0 || lngRange === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (points.length === 0) return;

    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(15, Math.min(300, HEATMAP_RADIUS_METERS / metersPerPixel));

    const SCALE = Math.max(1, Math.min(4, Math.floor(radiusPx / 25)));
    const SW = Math.ceil(W / SCALE);
    const SH = Math.ceil(H / SCALE);
    const sRadius = radiusPx / SCALE;

    const toScaledPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * SW,
      y: (1 - (lat - sw.getLat()) / latRange) * SH,
    });

    const toPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * W,
      y: (1 - (lat - sw.getLat()) / latRange) * H,
    });

    const buf = new Float32Array(SW * SH);

    const visiblePoints = points.filter(p => {
      const { x, y } = toScaledPixel(p.lat, p.lng);
      return x >= -sRadius && x <= SW + sRadius && y >= -sRadius && y <= SH + sRadius;
    });

    if (visiblePoints.length === 0) return;

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
          buf[py * SW + px] += Math.exp(-3.0 * t * t);
        }
      }
    }

    let maxVal = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] > maxVal) maxVal = buf[i];
    }
    if (maxVal === 0) return;

    const densityScale = Math.min(1.0, Math.log1p(visiblePoints.length) / Math.log1p(150));
    const maxIntensity = 0.40 + densityScale * 0.60;

    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    for (let fy = 0; fy < H; fy++) {
      const sy = Math.min(SH - 1, Math.floor(fy / SCALE));
      for (let fx = 0; fx < W; fx++) {
        const sx = Math.min(SW - 1, Math.floor(fx / SCALE));
        const raw = buf[sy * SW + sx];
        if (raw < 0.005) continue;

        const intensity = Math.min((raw / maxVal) * maxIntensity, 1.0);
        const [r, g, b, a] = getColor(intensity);

        const idx = (fy * W + fx) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // 마커 위치에 구멍을 뚫어서 마커가 히트맵에 가려지지 않도록 함
    // destination-out: 그린 영역을 투명하게 지움
    ctx.globalCompositeOperation = 'destination-out';
    for (const point of visiblePoints) {
      const { x: px, y: py } = toPixel(point.lat, point.lng);
      // 마커는 yAnchor:1 이므로 좌표가 마커 하단 중앙 → 마커 중심은 위로 MARKER_HOLE_RADIUS만큼
      const markerCenterY = py - MARKER_HOLE_RADIUS;
      const gradient = ctx.createRadialGradient(px, markerCenterY, 0, px, markerCenterY, MARKER_HOLE_RADIUS);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.6, 'rgba(0,0,0,0.8)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, markerCenterY, MARKER_HOLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [points, mapInstance, containerRef]);

  const scheduleRedraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => drawHeatmap());
  }, [drawHeatmap]);

  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    kakao.maps.event.addListener(mapInstance, 'idle', scheduleRedraw);
    kakao.maps.event.addListener(mapInstance, 'zoom_changed', scheduleRedraw);
    kakao.maps.event.addListener(mapInstance, 'dragend', scheduleRedraw);

    scheduleRedraw();

    return () => {
      kakao.maps.event.removeListener(mapInstance, 'idle', scheduleRedraw);
      kakao.maps.event.removeListener(mapInstance, 'zoom_changed', scheduleRedraw);
      kakao.maps.event.removeListener(mapInstance, 'dragend', scheduleRedraw);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapInstance, visible, scheduleRedraw]);

  useEffect(() => {
    if (!visible) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      clearCanvas();
    }
  }, [visible, clearCanvas]);

  useEffect(() => {
    if (!visible) return;
    scheduleRedraw();
  }, [points, visible, scheduleRedraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => scheduleRedraw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [scheduleRedraw, containerRef]);

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
