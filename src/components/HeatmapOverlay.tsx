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

const HEATMAP_RADIUS_METERS = 1800;
// 히트맵을 표시할 최소 지도 레벨. 이 레벨보다 작으면(=더 확대된 상태) 그리지 않음.
const HEATMAP_MIN_LEVEL = 7;

const PALETTE: Array<[number, [number, number, number, number]]> = [
  [0.00, [100, 180, 255,   0]],  // 하늘색 (투명)
  [0.10, [100, 200, 255, 100]],  // 하늘색
  [0.22, [  0, 210, 120, 170]],  // 초록색
  [0.38, [ 80, 230,  30, 200]],  // 연두/노랑
  [0.52, [255, 230,   0, 215]],  // 노랑
  [0.65, [255, 130,   0, 225]],  // 주황
  [0.78, [255,  20,   0, 235]],  // 빨강
  [0.90, [200,   0,  60, 240]],  // 진빨강
  [1.00, [160,   0, 200, 250]],  // 보라
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
  return [180, 0, 0, 245];
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

    // ★ 핵심: 그리는 시점에 항상 지도 레벨을 직접 체크
    // visible prop은 React 리렌더 사이클을 거쳐야 갱신되므로,
    // 카카오맵의 zoom_changed/idle 이벤트가 그보다 먼저 발생할 수 있음.
    // 그 갭에서 잘못된 강도(빨간 깜빡임)로 그려지는 것을 방지.
    if (typeof map.getLevel === 'function' && map.getLevel() < HEATMAP_MIN_LEVEL) {
      clearCanvas();
      return;
    }

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
    const radiusPx = Math.max(20, Math.min(600, HEATMAP_RADIUS_METERS / metersPerPixel));

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
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > sRadius) continue;
          const t = dist / sRadius;
          buf[py * SW + px] += Math.exp(-4.0 * t * t);
        }
      }
    }

    // SCALE_FACTOR: 화면에 실제로 그려지는 포인트 수 + 반경 크기를 함께 반영
    // radiusPx가 커질수록(줌인) 각 포인트의 buf 누적값이 커지므로 함께 보정
    const radiusNorm = sRadius / 30; // 기준 반경(30px) 대비 배율
    const SCALE_FACTOR = Math.max(1.5, visiblePoints.length * 0.8 * radiusNorm);

    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    for (let fy = 0; fy < H; fy++) {
      const sy = Math.min(SH - 1, Math.floor(fy / SCALE));
      for (let fx = 0; fx < W; fx++) {
        const sx = Math.min(SW - 1, Math.floor(fx / SCALE));
        const raw = buf[sy * SW + sx];
        if (raw < 0.003) continue;

        const intensity = Math.min(raw / SCALE_FACTOR, 1.0);
        const [r, g, b, a] = getColor(intensity);

        const idx = (fy * W + fx) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [points, mapInstance, clearCanvas]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !mapInstance || !container) return;
    const W = container.offsetWidth;
    const H = container.offsetHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    drawHeatmap();
  }, [drawHeatmap, mapInstance, containerRef]);

  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const handleUpdate = () => {
      // 그리기 직전(rAF 콜백 안)에서도 drawHeatmap이 다시 레벨을 체크하므로 안전
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
    };

    // zoom_changed: 동기적으로 레벨을 즉시 확인.
    // 레벨이 임계값 미만이면 진행 중인 rAF 취소 + 캔버스 즉시 클리어
    // (visible prop이 false로 바뀌는 React 리렌더 전에 이미 화면에서 사라짐)
    const handleZoomChanged = () => {
      const level = mapInstance.getLevel();
      if (level < HEATMAP_MIN_LEVEL) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        clearCanvas();
        return;
      }
      handleUpdate();
    };

    kakao.maps.event.addListener(mapInstance, 'idle', handleUpdate);
    kakao.maps.event.addListener(mapInstance, 'zoom_changed', handleZoomChanged);
    kakao.maps.event.addListener(mapInstance, 'dragend', handleUpdate);

    handleUpdate();

    return () => {
      kakao.maps.event.removeListener(mapInstance, 'idle', handleUpdate);
      kakao.maps.event.removeListener(mapInstance, 'zoom_changed', handleZoomChanged);
      kakao.maps.event.removeListener(mapInstance, 'dragend', handleUpdate);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapInstance, visible, resizeCanvas, clearCanvas]);

  // visible이 false로 바뀌는 순간 즉시 캔버스 클리어 (React 언마운트 전 잔상 방지)
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
