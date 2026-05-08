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

// 포인트 하나의 영향 반경 (미터). 작을수록 각 마커가 좁게 표시됨.
const HEATMAP_RADIUS_METERS = 600;

// 히트맵을 표시할 최소 지도 레벨
const HEATMAP_MIN_LEVEL = 7;

// 색상 팔레트: intensity 0~1 → RGBA
// 마커가 적으면 하늘색, 많아질수록 초록→노랑→주황→빨강 순으로 변함
// 빨강/보라는 매우 밀집된 경우에만 나타나도록 상위 구간에 배치
const PALETTE: Array<[number, [number, number, number, number]]> = [
  [0.00, [100, 210, 255,   0]],  // 투명 (없음)
  [0.08, [100, 210, 255,  80]],  // 하늘색 (희박)
  [0.20, [ 60, 220, 160, 140]],  // 청록
  [0.35, [ 80, 220,  50, 180]],  // 초록
  [0.50, [200, 230,   0, 200]],  // 연두/노랑
  [0.65, [255, 180,   0, 215]],  // 주황
  [0.80, [255,  60,   0, 225]],  // 빨강
  [1.00, [200,   0,  40, 235]],  // 진빨강 (매우 밀집)
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

    // 그리는 시점에 항상 레벨 직접 체크 (React 리렌더 갭 방지)
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

    // 미터 → 픽셀 변환
    const metersPerPixel = (latRange / H) * 111320;
    const radiusPx = Math.max(15, Math.min(300, HEATMAP_RADIUS_METERS / metersPerPixel));

    // 다운샘플 스케일 (성능)
    const SCALE = Math.max(1, Math.min(4, Math.floor(radiusPx / 25)));
    const SW = Math.ceil(W / SCALE);
    const SH = Math.ceil(H / SCALE);
    const sRadius = radiusPx / SCALE;

    const toScaledPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * SW,
      y: (1 - (lat - sw.getLat()) / latRange) * SH,
    });

    const buf = new Float32Array(SW * SH);

    // 화면 범위 안(+반경 여유) 포인트만 처리
    const visiblePoints = points.filter(p => {
      const { x, y } = toScaledPixel(p.lat, p.lng);
      return x >= -sRadius && x <= SW + sRadius && y >= -sRadius && y <= SH + sRadius;
    });

    if (visiblePoints.length === 0) return;

    // 가우시안 커널로 각 포인트의 영향을 buf에 누적
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

    // buf의 실제 최댓값으로 정규화
    // → 가장 밀집된 곳이 항상 팔레트 최고값에 매핑되지 않고,
    //   전체 포인트 밀도에 비례해서 색이 결정됨
    let maxVal = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] > maxVal) maxVal = buf[i];
    }
    if (maxVal === 0) return;

    // 포인트가 적을 때 빨간색이 나오지 않도록 상한을 동적으로 조정
    // 포인트 1개: 최대 intensity ~0.4 (하늘~초록 구간)
    // 포인트 5개 이상 밀집: 최대 intensity ~0.8 (주황~빨강)
    // 포인트 15개 이상 밀집: 최대 intensity 1.0 (진빨강)
    const densityScale = Math.min(1.0, Math.log1p(visiblePoints.length) / Math.log1p(15));
    const maxIntensity = 0.35 + densityScale * 0.65; // 0.35 ~ 1.0

    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    for (let fy = 0; fy < H; fy++) {
      const sy = Math.min(SH - 1, Math.floor(fy / SCALE));
      for (let fx = 0; fx < W; fx++) {
        const sx = Math.min(SW - 1, Math.floor(fx / SCALE));
        const raw = buf[sy * SW + sx];
        if (raw < 0.005) continue;

        // 각 픽셀의 상대적 밀도(0~1) × maxIntensity
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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => resizeCanvas());
    };

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
