"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/**
 * FlicksAmbientFlow
 *
 * Flicks 페이지 하단(BottomNav가 떠 있는 검은 영역)을 단순 검정에서
 * "Ambient Light + Particle Flow" 효과를 가진 동적 배경으로 바꾼다.
 *
 * 디자인 원칙:
 *  - 검은색을 완전히 대체하지 않는다. 어디까지나 검은 베이스 위에 은은한 빛이 깔리는 정도.
 *  - 위쪽(영상이 끝나는 지점)은 거의 완전한 검정 → 영상 컨테이너의 어두운 그라데이션과
 *    이음새 없이 자연스럽게 이어진다.
 *  - 영상이 바뀌면 ambient 색이 부드럽게 cross-fade 된다.
 *  - 위로 천천히 떠오르는 작은 빛 입자(particle)들이 "flick" 의미를 시각적으로 표현.
 *
 * 동작:
 *  - posterUrl이 주어지면 캔버스에 작게 다운샘플 → 평균색 추출 → ambient color로 저장.
 *  - posterUrl이 없으면 인디고 계열 fallback 톤을 쓴다.
 *
 * 렌더 위치:
 *  - document.body 직속으로 portal 렌더한다. App.tsx의 AnimatePresence/motion.div가
 *    transform stacking context를 만들기 때문에 그 안에서 position:fixed를 써도
 *    motion.div 영역 밖(=BottomNav 영역)으로 빠져나갈 수 없다. portal로 body 직속에
 *    띄워야 진짜 viewport 기준 fixed가 되어 BottomNav 알약 주변까지 채울 수 있다.
 */

interface FlicksAmbientFlowProps {
  /** BottomNav 알약 주변 검은 영역의 높이 (env(safe-area-inset-bottom) + 64px 등) */
  height: string;
  /** 현재 활성 슬라이드의 대표 이미지 URL (영상 썸네일/첫 이미지). 없으면 fallback 톤 사용. */
  posterUrl?: string | null;
  /** 최상단에 어느 정도 darken을 더 줄지 (영상 아래 그라데이션과 이음새를 자연스럽게). 기본 'auto' */
  topFadeStrength?: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const FALLBACK_COLOR: RGB = { r: 79, g: 70, b: 229 }; // indigo-600

const FlicksAmbientFlow: React.FC<FlicksAmbientFlowProps> = ({
  height,
  posterUrl,
  topFadeStrength = 0.85,
}) => {
  // 현재 그려지고 있는 ambient color (cross-fade 결과)
  const [color, setColor] = useState<RGB>(FALLBACK_COLOR);

  // [DEBUG] 마운트/렌더 추적
  useEffect(() => {
    console.log("[FlicksAmbientFlow] mounted. posterUrl=", posterUrl, "height=", height);
    return () => {
      console.log("[FlicksAmbientFlow] unmounted");
    };
  }, []);

  useEffect(() => {
    console.log("[FlicksAmbientFlow] posterUrl changed:", posterUrl);
  }, [posterUrl]);

  useEffect(() => {
    console.log("[FlicksAmbientFlow] color updated:", color);
  }, [color]);

  // posterUrl → 평균색 추출
  useEffect(() => {
    if (!posterUrl) {
      setColor(FALLBACK_COLOR);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (cancelled) return;
      try {
        const W = 16;
        const H = 16;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        // 1차: 적당한 밝기 + 어느 정도 채도 있는 픽셀만 골라 평균
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const pa = data[i + 3];
          if (pa < 200) continue;
          const lum = (pr * 0.299 + pg * 0.587 + pb * 0.114) / 255;
          if (lum < 0.05 || lum > 0.97) continue;
          r += pr;
          g += pg;
          b += pb;
          count += 1;
        }
        // 2차 fallback: 1차에서 하나도 안 잡히면 모든 픽셀 단순 평균
        if (count === 0) {
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }
        }
        if (count === 0) return;
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // 결과가 너무 어두우면 밝기를 끌어올려준다 (밤/어두운 영상도 ambient가 보이도록).
        // luminance 기준 0.18 이하라면 비율을 유지한 채 전체적으로 톤업.
        let lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        if (lum < 0.18) {
          // 무채색에 가까운(R,G,B 차이 < 20) 진한 검정이면 그냥 fallback indigo 사용.
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          if (maxC - minC < 20) {
            setColor(FALLBACK_COLOR);
            return;
          }
          // 비율 유지 톤업 — 가장 큰 채널을 ~140 정도로 끌어올리고 나머지를 비례 조정
          const target = 140;
          const scale = maxC > 0 ? target / maxC : 1;
          r = Math.min(255, Math.round(r * scale));
          g = Math.min(255, Math.round(g * scale));
          b = Math.min(255, Math.round(b * scale));
        }

        // 너무 칙칙하지 않도록 살짝 채도를 올려준다 (간단한 saturation boost)
        const boosted = boostSaturation({ r, g, b }, 1.35);

        // [DEBUG] 색 추출 결과를 보고 싶을 때
        console.log("[FlicksAmbientFlow] extracted color:", { r, g, b, lum, boosted });

        setColor(boosted);
      } catch {
        // CORS 오류 등은 무시하고 fallback 유지
      }
    };
    img.onerror = () => {
      if (cancelled) return;
      setColor(FALLBACK_COLOR);
    };
    img.src = posterUrl;
    return () => {
      cancelled = true;
    };
  }, [posterUrl]);

  // 파티클은 컴포넌트 마운트 시 한 번만 랜덤 생성 (각자 다른 delay/duration으로 흘러감)
  const particles = useMemo(() => {
    const COUNT = 14;
    return Array.from({ length: COUNT }, (_, i) => {
      const size = 2 + Math.random() * 4; // 2~6px
      const left = Math.random() * 100; // %
      const duration = 6 + Math.random() * 6; // 6~12s
      const delay = -Math.random() * duration; // 마운트 직후에도 흩어진 상태에서 시작
      const drift = (Math.random() - 0.5) * 30; // 좌우로 살짝 흔들리는 정도 (px)
      const opacityPeak = 0.35 + Math.random() * 0.35; // 0.35~0.7
      return { id: i, size, left, duration, delay, drift, opacityPeak };
    });
  }, []);

  const colorStr = `${color.r}, ${color.g}, ${color.b}`;
  // 부드럽게 cross-fade 되도록 background-color에 transition을 건다.
  const ambientStyle: React.CSSProperties = {
    height,
    // base: 거의 검정 + ambient color의 미세한 wash
    backgroundColor: "#000",
    // CSS 변수로 색을 노출하면 자식 레이어/keyframes에서 재사용 가능
    ["--ambient-r" as any]: color.r,
    ["--ambient-g" as any]: color.g,
    ["--ambient-b" as any]: color.b,
    ["--ambient-rgb" as any]: colorStr,
    transition: "background-color 600ms ease",
  };

  if (typeof document === "undefined") return null;

  const content = (
    <div
      aria-hidden="true"
      data-flicks-ambient-flow="true"
      className="fixed left-0 right-0 bottom-0 overflow-hidden cursor-default select-none"
      style={{
        ...ambientStyle,
        zIndex: 19998,
        pointerEvents: "auto",
        touchAction: "none",
      }}
    >
      {/* 1) Ambient color wash — 큰 두 개의 radial glow가 좌/우에서 천천히 숨쉬듯 펄스 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(120% 180% at 20% 120%, rgba(${colorStr}, 0.55) 0%, rgba(${colorStr}, 0.18) 35%, transparent 65%),
            radial-gradient(120% 180% at 80% 130%, rgba(${colorStr}, 0.42) 0%, rgba(${colorStr}, 0.12) 35%, transparent 65%)
          `,
          transition: "background 600ms ease",
        }}
      />

      {/* 2) 살짝 호흡하는 ambient layer — opacity만 천천히 변동시켜 "살아있는" 느낌 */}
      <div
        className="absolute inset-0 pointer-events-none flicks-ambient-breathe"
        style={{
          background: `radial-gradient(100% 160% at 50% 130%, rgba(${colorStr}, 0.35) 0%, transparent 60%)`,
        }}
      />

      {/* 3) 위로 천천히 떠오르는 빛 입자들 */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p) => (
          <span
            key={p.id}
            className="flicks-ambient-particle"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              ["--drift" as any]: `${p.drift}px`,
              ["--peak" as any]: p.opacityPeak,
              backgroundColor: `rgba(${colorStr}, 0.9)`,
              boxShadow: `0 0 ${p.size * 2}px rgba(${colorStr}, 0.7)`,
            }}
          />
        ))}
      </div>

      {/* 4) 상단 fade — 영상 컨테이너 하단의 검은 그라데이션과 자연스럽게 이어지도록
              위쪽일수록 진한 검정. 이게 없으면 영상과 ambient 영역의 경계가 띠처럼 보일 수 있음. */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "55%",
          background: `linear-gradient(to bottom, rgba(0,0,0,${topFadeStrength}) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)`,
        }}
      />

      {/* keyframes는 컴포넌트 안에 함께 둬서 다른 곳에 영향이 가지 않게 한다. */}
      <style>{`
        @keyframes flicksAmbientBreathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .flicks-ambient-breathe {
          animation: flicksAmbientBreathe 6s ease-in-out infinite;
        }

        @keyframes flicksParticleRise {
          0% {
            transform: translate(0, 100%) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: var(--peak, 0.6);
          }
          85% {
            opacity: var(--peak, 0.6);
          }
          100% {
            transform: translate(var(--drift, 0px), -120%) scale(1);
            opacity: 0;
          }
        }
        .flicks-ambient-particle {
          position: absolute;
          bottom: 0;
          border-radius: 9999px;
          will-change: transform, opacity;
          animation-name: flicksParticleRise;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          filter: blur(0.3px);
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
};

/** 단순 채도 부스트 (RGB → HSL → RGB가 정석이지만 가볍게 처리) */
function boostSaturation(c: RGB, factor: number): RGB {
  const avg = (c.r + c.g + c.b) / 3;
  const r = Math.round(clamp(avg + (c.r - avg) * factor, 0, 255));
  const g = Math.round(clamp(avg + (c.g - avg) * factor, 0, 255));
  const b = Math.round(clamp(avg + (c.b - avg) * factor, 0, 255));
  return { r, g, b };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export default FlicksAmbientFlow;
