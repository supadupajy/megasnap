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

    const level = map.getLevel();
    const radius = Math.max(40, Math.min(160, level * 18));

    // ── Step 1: 화면 안에 있는 포인트만 필터링 ──
    const visiblePoints = points.filter(p => {
      const { x, y } = toPixel(p.lat, p.lng);
      return x >= -radius && x <= W + radius && y >= -radius && y <= H + radius;
    });

    if (visiblePoints.length === 0) return;

    // ── Step 2: Float32 강도 누적 버퍼 (픽셀당 실제 강도 합산) ──
    // 각 포인트가 기여하는 강도를 직접 float 버퍼에 누적
    // → 정규화를 "최대값" 기준이 아닌 "포인트 수" 기준으로 할 수 있음
    const intensityBuf = new Float32Array(W * H);

    for (const point of visiblePoints) {
      const { x: cx, y: cy } = toPixel(point.lat, point.lng);

      const x0 = Math.max(0, Math.floor(cx - radius));
      const x1 = Math.min(W - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const y1 = Math.min(H - 1, Math.ceil(cy + radius));

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;

          // 가우시안 감쇠: 중심 1.0, 가장자리 0
          const t = dist / radius;
          const weight = Math.exp(-3.5 * t * t); // 가우시안 커널
          intensityBuf[py * W + px] += weight;
        }
      }
    }

    // ── Step 3: 절대적 포인트 수 기반 상한값 설정 ──
    // 포인트 1개가 중심에서 기여하는 최대값 ≈ 1.0 (exp(0) = 1)
    // 포인트 N개가 완전히 겹치면 최대값 ≈ N
    // → 상한값을 포인트 수에 비례하되, 최소 3 이상으로 설정
    //   (포인트 1개면 상한 3 → 중심 강도 1/3 ≈ 0.33 → 하늘색~노란색 사이)
    const maxPossible = Math.max(3, visiblePoints.length * 0.6);

    // ── Step 4: 색상 팔레트 적용 ──
    // 하늘색(낮음) → 노란색 → 주황색 → 빨간색(높음)
    const getColor = (intensity: number): [number, number, number, number] => {
      if (intensity < 0.005) return [0, 0, 0, 0];

      const palette: Array<[number, [number, number, number, number]]> = [
        [0.0,  [100, 210, 255,   0]],  // 하늘색 투명
        [0.05, [100, 210, 255, 130]],  // 하늘색
        [0.25, [ 60, 190, 240, 180]],  // 하늘색 진하게
        [0.45, [255, 235,  40, 210]],  // 노란색
        [0.65, [255, 130,   0, 225]],  // 주황색
        [0.82, [255,  40,   0, 235]],  // 주황-빨간
        [1.0,  [200,   0,   0, 245]],  // 진한 빨간색
      ];

      const clamped = Math.min(intensity, 1.0);

      for (let i = 0; i < palette.length - 1; i++) {
        const [t0, c0] = palette[i];
        const [t1, c1] = palette[i + 1];
        if (clamped >= t0 && clamped <= t1) {
          const t = (t1 === t0) ? 0 : (clamped - t0) / (t1 - t0);
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

    // ── Step 5: ImageData에 색상 쓰기 ──
    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    for (let i = 0; i < intensityBuf.length; i++) {
      const raw = intensityBuf[i];
      if (raw < 0.001) continue;

      // 절대적 상한값으로 정규화
      const normalized = Math.min(raw / maxPossible, 1.0);
      // 감마 보정: 낮은 밀도도 색상이 잘 보이게
      const intensity = Math.pow(normalized, 0.7);

      const [r, g, b, a] = getColor(intensity);
      const idx = i * 4;
      data[idx]     = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
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
