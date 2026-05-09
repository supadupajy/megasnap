import React, { useEffect, useRef, useCallback } from 'react';
// @ts-ignore – simpleheat has no bundled types
import simpleheat from 'simpleheat';

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
const HEATMAP_INTENSITY_MAX = 4.5;
const LOW_DENSITY_POINT_THRESHOLD = 3;
const SINGLE_POINT_MIN_RADIUS_PX = 58;
const SINGLE_POINT_RADIUS_MULTIPLIER = 1.55;
const OVERSCAN_RATIO = 0.65;

const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ points, mapInstance, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<any>(null);
  const pointsRef = useRef(points);
  const animFrameRef = useRef<number | null>(null);
  const redrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const pendingRedrawRef = useRef(false);
  const dragStartCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const dragStartBoundsRef = useRef<{ latRange: number; lngRange: number } | null>(null);
  const viewportRef = useRef({ width: 0, height: 0, overscanX: 0, overscanY: 0 });

  const applyCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const parent = canvas.parentElement;
    if (!parent) return false;

    const viewportWidth = parent.offsetWidth;
    const viewportHeight = parent.offsetHeight;
    if (viewportWidth === 0 || viewportHeight === 0) return false;

    const overscanX = Math.round(viewportWidth * OVERSCAN_RATIO);
    const overscanY = Math.round(viewportHeight * OVERSCAN_RATIO);
    const canvasWidth = viewportWidth + overscanX * 2;
    const canvasHeight = viewportHeight + overscanY * 2;

    const sizeChanged = canvas.width !== canvasWidth || canvas.height !== canvasHeight;
    if (sizeChanged) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      heatRef.current = null;
    }

    viewportRef.current = { width: viewportWidth, height: viewportHeight, overscanX, overscanY };
    canvas.style.left = `${-overscanX}px`;
    canvas.style.top = `${-overscanY}px`;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    return true;
  }, []);

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapInstance) return;

    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    if (!applyCanvasSize()) return;

    const map = mapInstance;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const { width: viewportWidth, height: viewportHeight, overscanX, overscanY } = viewportRef.current;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const latRange = ne.getLat() - sw.getLat();
    const lngRange = ne.getLng() - sw.getLng();
    if (latRange === 0 || lngRange === 0) return;

    const projection = map.getProjection?.();
    if (!projection?.containerPointFromCoords) return;

    if (!heatRef.current) {
      heatRef.current = simpleheat(canvas);
    }
    const heat = heatRef.current;

    const metersPerPixel = (latRange / viewportHeight) * 111320;
    const radiusPx = Math.max(10, Math.min(420, HEATMAP_RADIUS_METERS / metersPerPixel));
    const blurPx = radiusPx * 0.85;

    const toPixel = (lat: number, lng: number) => {
      const point = projection.containerPointFromCoords(new kakao.maps.LatLng(lat, lng));
      return {
        x: overscanX + (point.x ?? point.getX?.() ?? 0),
        y: overscanY + (point.y ?? point.getY?.() ?? 0),
      };
    };

    const margin = radiusPx;
    const data: [number, number, number][] = [];

    for (const point of pointsRef.current) {
      const { x, y } = toPixel(point.lat, point.lng);
      if (x < -margin || x > canvasWidth + margin || y < -margin || y > canvasHeight + margin) continue;
      data.push([x, y, 1]);
    }

    heat.clear();

    if (data.length > 0) {
      if (data.length <= LOW_DENSITY_POINT_THRESHOLD) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const singleRadius = Math.max(SINGLE_POINT_MIN_RADIUS_PX, radiusPx * SINGLE_POINT_RADIUS_MULTIPLIER);

          ctx.save();
          ctx.globalCompositeOperation = 'source-over';

          data.forEach(([x, y]) => {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, singleRadius);
            gradient.addColorStop(0.0, 'rgba(255,220,0,0.95)');
            gradient.addColorStop(0.22, 'rgba(255,220,0,0.88)');
            gradient.addColorStop(0.40, 'rgba(180,230,30,0.72)');
            gradient.addColorStop(0.62, 'rgba(60,210,80,0.44)');
            gradient.addColorStop(0.82, 'rgba(40,200,180,0.24)');
            gradient.addColorStop(1.0, 'rgba(100,210,255,0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, singleRadius, 0, Math.PI * 2);
            ctx.fill();
          });

          ctx.restore();
        }
      } else {
        heat
          .data(data)
          .max(HEATMAP_INTENSITY_MAX)
          .radius(radiusPx, blurPx)
          .gradient({
            0.0: 'rgba(100,210,255,0)',
            0.05: 'rgba(100,210,255,0.5)',
            0.20: 'rgba(40,200,180,0.67)',
            0.35: 'rgba(60,210,80,0.76)',
            0.50: 'rgba(180,230,30,0.82)',
            0.65: 'rgba(255,220,0,0.86)',
            0.78: 'rgba(255,120,0,0.91)',
            0.90: 'rgba(255,30,0,0.94)',
            1.0: 'rgba(180,0,0,0.97)',
          })
          .draw(0.05);
      }
    }

    canvas.style.transform = 'translate3d(0, 0, 0)';
    canvas.style.transformOrigin = '0 0';
    pendingRedrawRef.current = false;
  }, [applyCanvasSize, mapInstance]);

  const scheduleRedraw = useCallback(() => {
    if (isDraggingRef.current) {
      pendingRedrawRef.current = true;
      return;
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = null;
      drawHeatmap();
    });
  }, [drawHeatmap]);

  useEffect(() => {
    if (!mapInstance || !visible) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const handleDragStart = () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      isDraggingRef.current = true;
      pendingRedrawRef.current = false;

      const center = mapInstance.getCenter();
      dragStartCenterRef.current = { lat: center.getLat(), lng: center.getLng() };

      const bounds = mapInstance.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      dragStartBoundsRef.current = {
        latRange: ne.getLat() - sw.getLat(),
        lngRange: ne.getLng() - sw.getLng(),
      };
    };

    const handleDrag = () => {
      const canvas = canvasRef.current;
      if (!canvas || !dragStartCenterRef.current || !dragStartBoundsRef.current) return;

      const { latRange, lngRange } = dragStartBoundsRef.current;
      if (latRange === 0 || lngRange === 0) return;

      const { width: viewportWidth, height: viewportHeight } = viewportRef.current;
      if (viewportWidth === 0 || viewportHeight === 0) return;

      const currentCenter = mapInstance.getCenter();
      const startCenter = dragStartCenterRef.current;

      const dLat = currentCenter.getLat() - startCenter.lat;
      const dLng = currentCenter.getLng() - startCenter.lng;

      const dx = -(dLng / lngRange) * viewportWidth;
      const dy = (dLat / latRange) * viewportHeight;

      canvas.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      dragStartCenterRef.current = null;
      dragStartBoundsRef.current = null;
      scheduleRedraw();

      if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current);
      redrawTimerRef.current = setTimeout(() => {
        redrawTimerRef.current = null;
        scheduleRedraw();
      }, 160);
    };

    const handleZoomChanged = () => {
      scheduleRedraw();
    };

    const handleIdle = () => {
      if (isDraggingRef.current) return;
      if (animFrameRef.current !== null) return;
      scheduleRedraw();
    };

    kakao.maps.event.addListener(mapInstance, 'dragstart', handleDragStart);
    kakao.maps.event.addListener(mapInstance, 'drag', handleDrag);
    kakao.maps.event.addListener(mapInstance, 'dragend', handleDragEnd);
    kakao.maps.event.addListener(mapInstance, 'zoom_changed', handleZoomChanged);
    kakao.maps.event.addListener(mapInstance, 'idle', handleIdle);

    scheduleRedraw();

    return () => {
      kakao.maps.event.removeListener(mapInstance, 'dragstart', handleDragStart);
      kakao.maps.event.removeListener(mapInstance, 'drag', handleDrag);
      kakao.maps.event.removeListener(mapInstance, 'dragend', handleDragEnd);
      kakao.maps.event.removeListener(mapInstance, 'zoom_changed', handleZoomChanged);
      kakao.maps.event.removeListener(mapInstance, 'idle', handleIdle);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (redrawTimerRef.current) {
        clearTimeout(redrawTimerRef.current);
        redrawTimerRef.current = null;
      }
    };
  }, [mapInstance, visible, scheduleRedraw]);

  useEffect(() => {
    pointsRef.current = points;
    if (!visible) return;
    scheduleRedraw();
  }, [points, visible, scheduleRedraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      if (isDraggingRef.current) {
        pendingRedrawRef.current = true;
        return;
      }
      scheduleRedraw();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [scheduleRedraw]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 100,
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)',
        transformOrigin: '0 0',
      }}
    />
  );
};

export default HeatmapOverlay;