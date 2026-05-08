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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  /**
   * 카카오맵 내부 DOM 구조 분석:
   * #kakao-map
   *   └─ div[style="width:100%;height:100%;position:relative;overflow:hidden"]  ← mapWrapper
   *        ├─ div (타일 레이어, z-index 없음 또는 낮음)
   *        ├─ div (CustomOverlay 컨테이너, z-index: 200 이상)
   *        └─ ...
   *
   * 전략: mapWrapper 안에서 CustomOverlay 컨테이너의 실제 z-index를 읽어서
   * canvas의 z-index를 그보다 1 낮게 설정.
   * CustomOverlay 컨테이너를 못 찾으면 z-index: 150으로 fallback.
   */
  const ensureCanvas = useCallback((): HTMLCanvasElement | null => {
    if (canvasRef.current && document.contains(canvasRef.current)) {
      return canvasRef.current;
    }

    const container = containerRef.current;
    if (!container) return null;

    // 카카오맵 내부 wrapper (첫 번째 자식 div)
    const mapWrapper = container.firstElementChild as HTMLElement | null;
    if (!mapWrapper) return null;

    // 카카오맵 내부 레이어 구조:
    // - 타일 레이어: z-index 없음 (DOM 순서로 결정)
    // - CustomOverlay 컨테이너 div: z-index 3~4 (카카오맵 내부 레이어)
    // - CustomOverlay 내부 zIndex 옵션(300~500)은 컨테이너 안에서의 순서
    //
    // mapWrapper 자식들의 실제 z-index를 읽어서 가장 낮은 양수값보다 1 낮게 설정
    let minChildZIndex = Infinity;
    Array.from(mapWrapper.children).forEach(child => {
      const zi = parseInt((child as HTMLElement).style.zIndex || '0', 10);
      if (zi > 0 && zi < minChildZIndex) minChildZIndex = zi;
    });
    // 자식 z-index를 못 읽으면 2로 fallback (타일 위, 마커 아래)
    const canvasZIndex = isFinite(minChildZIndex) ? Math.max(1, minChildZIndex - 1) : 2;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-heatmap', 'true');
    canvas.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      `z-index:${canvasZIndex}`,
    ].join(';');

    mapWrapper.appendChild(canvas);
    canvasRef.current = canvas;
    return canvas;
  }, [containerRef]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawHeatmap = useCallback(() => {
    if (!mapInstance) return;

    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const canvas = ensureCanvas();
    if (!canvas) return;

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
  }, [points, mapInstance, ensureCanvas, containerRef]);

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

  // 카카오맵 초기화 후 canvas 삽입 (내부 DOM이 생성될 때까지 대기)
  useEffect(() => {
    if (!mapInstance || !visible) return;
    const timer = setTimeout(() => scheduleRedraw(), 300);
    return () => clearTimeout(timer);
  }, [mapInstance, visible, scheduleRedraw]);

  return null;
};

export default HeatmapOverlay;
