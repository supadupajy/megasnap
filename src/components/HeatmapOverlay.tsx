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

  // 카카오맵 내부에서 실제 지도 타일이 그려지는 컨테이너를 찾아 반환
  // 카카오맵은 containerRef.current 안에 여러 div 레이어를 만드는데,
  // 첫 번째 자식 div가 지도 레이어 컨테이너임
  const getMapInnerContainer = useCallback((): HTMLElement | null => {
    const el = containerRef.current;
    if (!el) return null;
    // 카카오맵 내부 구조: #kakao-map > div (지도 레이어 wrapper)
    const inner = el.querySelector('div') as HTMLElement | null;
    return inner || el;
  }, [containerRef]);

  // canvas를 카카오맵 내부 DOM에 삽입 (마커 레이어보다 낮은 zIndex)
  const ensureCanvas = useCallback((): HTMLCanvasElement | null => {
    if (canvasRef.current && document.contains(canvasRef.current)) {
      return canvasRef.current;
    }

    const container = containerRef.current;
    if (!container) return null;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:10',  // 카카오맵 타일(z-index 없음) 위, CustomOverlay(z-index 300+) 아래
    ].join(';');
    canvas.setAttribute('data-heatmap', 'true');

    // 카카오맵 내부 첫 번째 div에 삽입 (타일 레이어 위, 마커 레이어 아래)
    const inner = container.querySelector('div') as HTMLElement | null;
    if (inner) {
      inner.appendChild(canvas);
    } else {
      container.appendChild(canvas);
    }

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

    // canvas 크기를 컨테이너에 맞춤
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

  // 지도 이벤트 구독
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

  // visible 꺼지면 캔버스 지우기
  useEffect(() => {
    if (!visible) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      clearCanvas();
    }
  }, [visible, clearCanvas]);

  // points 변경 시 다시 그리기
  useEffect(() => {
    if (!visible) return;
    scheduleRedraw();
  }, [points, visible, scheduleRedraw]);

  // 컨테이너 크기 변경 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => scheduleRedraw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [scheduleRedraw, containerRef]);

  // 카카오맵이 초기화되면 canvas 삽입 시도 (mapInstance가 생긴 직후)
  useEffect(() => {
    if (!mapInstance || !visible) return;
    // 카카오맵 내부 DOM이 생성될 때까지 잠깐 대기
    const timer = setTimeout(() => {
      scheduleRedraw();
    }, 300);
    return () => clearTimeout(timer);
  }, [mapInstance, visible, scheduleRedraw]);

  // canvas는 DOM에 직접 삽입하므로 React render에서는 아무것도 반환하지 않음
  return null;
};

export default HeatmapOverlay;