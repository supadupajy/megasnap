import React, { useEffect, useRef, useCallback } from 'react';

interface HeatmapPoint {
  lat: number;
  lng: number;
}

interface HeatmapOverlayProps {
  points: HeatmapPoint[];
  mapInstance: any; // kakao map instance
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

    const mapEl = map.getNode ? map.getNode() : canvas.parentElement;
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
    const radius = Math.max(30, Math.min(120, level * 14));

    // 오프스크린 캔버스에 가우시안 블러 히트맵 그리기
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // 각 포인트에 방사형 그라디언트 그리기 (흑백 강도 맵)
    offCtx.globalCompositeOperation = 'source-over';
    for (const point of points) {
      const { x, y } = toPixel(point.lat, point.lng);
      // 화면 밖 포인트는 스킵 (약간의 여유 허용)
      if (x < -radius || x > W + radius || y < -radius || y > H + radius) continue;

      const gradient = offCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.15)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');

      offCtx.fillStyle = gradient;
      offCtx.beginPath();
      offCtx.arc(x, y, radius, 0, Math.PI * 2);
      offCtx.fill();
    }

    // 강도 맵을 컬러 히트맵으로 변환
    const imageData = offCtx.getImageData(0, 0, W, H);
    const data = imageData.data;

    // 컬러 팔레트: 투명 → 노란색 → 주황 → 빨간색
    // intensity 0~1 → color
    const getColor = (intensity: number): [number, number, number, number] => {
      if (intensity < 0.01) return [0, 0, 0, 0];

      // 팔레트 정의 (intensity 구간별 색상)
      const palette: Array<[number, [number, number, number, number]]> = [
        [0.0,  [255, 255,  80, 0]],    // 투명 노란색
        [0.15, [255, 255,  80, 120]],  // 노란색
        [0.35, [255, 200,  20, 180]],  // 진한 노란색
        [0.55, [255, 130,   0, 210]],  // 주황색
        [0.75, [255,  50,   0, 230]],  // 주황-빨간
        [1.0,  [200,   0,   0, 245]],  // 진한 빨간색
      ];

      for (let i = 0; i < palette.length - 1; i++) {
        const [t0, c0] = palette[i];
        const [t1, c1] = palette[i + 1];
        if (intensity >= t0 && intensity <= t1) {
          const t = (intensity - t0) / (t1 - t0);
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
      const intensity = data[i] / 255; // R 채널을 강도로 사용
      const [r, g, b, a] = getColor(intensity);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [points, mapInstance]);

  // 캔버스 크기를 지도 컨테이너에 맞게 조정
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapInstance) return;

    const mapNode = canvas.parentElement;
    if (!mapNode) return;

    const W = mapNode.offsetWidth;
    const H = mapNode.offsetHeight;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    drawHeatmap();
  }, [drawHeatmap, mapInstance]);

  // 지도 이벤트에 연결
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

    // 초기 렌더
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
    animFrameRef.current = requestAnimationFrame(() => {
      resizeCanvas();
    });
  }, [points, visible, resizeCanvas]);

  // ResizeObserver로 컨테이너 크기 변경 감지
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
        opacity: 1,
        transition: 'opacity 0.4s ease',
      }}
    />
  );
};

export default HeatmapOverlay;
