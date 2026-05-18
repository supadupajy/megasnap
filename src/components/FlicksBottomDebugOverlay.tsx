"use client";

import React, { useEffect, useState, useCallback } from "react";

/**
 * Flicks 페이지 하단(특히 BottomNav 알약 주변)에 어떤 배경/요소가 깔려 있는지
 * 진단하기 위한 디버그 오버레이.
 *
 * - 화면 우상단에 토글 버튼을 띄운다.
 * - 켜면:
 *   1) 화면 하단 BottomNav 알약 주변의 여러 좌표를 sample하여,
 *      그 좌표에 있는 element 목록(elementsFromPoint) + 각 요소의 배경색을 분석한다.
 *   2) 결과를 화면 좌측 상단의 디버그 패널과 console.log에 출력한다.
 *   3) 분석 좌표 위에 작은 컬러 핀을 띄워 어디를 측정했는지도 시각적으로 보여준다.
 */

interface SampleResult {
  label: string;
  x: number;
  y: number;
  // 해당 좌표에서 hit된 elements를 위에서부터 아래로
  stack: Array<{
    tag: string;
    classHead: string; // 첫 60자만
    bg: string;
    opacity: string;
    zIndex: string;
    rectTop: number;
    rectBottom: number;
  }>;
  // 화면상 보이는 최종 합성 색상 (가장 위 요소의 배경; transparent면 다음 요소)
  effectiveBg: string;
}

const summarizeEl = (el: Element) => {
  const cs = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    classHead:
      typeof el.className === "string"
        ? el.className.slice(0, 60)
        : ((el as any).className?.baseVal || "").slice(0, 60),
    bg: cs.backgroundColor,
    opacity: cs.opacity,
    zIndex: cs.zIndex,
    rectTop: Math.round(rect.top),
    rectBottom: Math.round(rect.bottom),
  };
};

const findEffectiveBg = (stack: ReturnType<typeof summarizeEl>[]): string => {
  // 위에서부터 내려가며 transparent / rgba(...,0)이 아닌 첫 색상을 반환
  for (const s of stack) {
    const bg = s.bg;
    if (!bg) continue;
    if (bg === "transparent") continue;
    // rgba(0,0,0,0) 같은 완전 투명 처리
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((x) => parseFloat(x.trim()));
      const a = parts.length >= 4 ? parts[3] : 1;
      if (a === 0) continue;
    }
    return bg;
  }
  return "(none)";
};

const FlicksBottomDebugOverlay: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [results, setResults] = useState<SampleResult[]>([]);
  const [tick, setTick] = useState(0);

  const runSample = useCallback(() => {
    if (typeof window === "undefined") return;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // BottomNav가 떠 있는 하단 영역 위주로 여러 좌표를 샘플링
    // (BottomNav 알약 위쪽 가장자리 / 알약 좌측 바깥 / 알약 우측 바깥 / 화면 정중앙 하단 등)
    const samples: Array<{ label: string; x: number; y: number }> = [
      { label: "하단 중앙(BottomNav 바로 위)", x: W / 2, y: H - 90 },
      { label: "하단 중앙(알약 위쪽 가장자리)", x: W / 2, y: H - 80 },
      { label: "알약 좌측 바깥(좌측 끝)", x: 8, y: H - 50 },
      { label: "알약 우측 바깥(우측 끝)", x: W - 8, y: H - 50 },
      { label: "알약 위쪽 좌측 바깥", x: 30, y: H - 90 },
      { label: "알약 위쪽 우측 바깥", x: W - 30, y: H - 90 },
      { label: "화면 정중앙", x: W / 2, y: H / 2 },
    ];

    const newResults: SampleResult[] = samples.map((s) => {
      const els = document.elementsFromPoint(s.x, s.y);
      const stack = els.slice(0, 10).map(summarizeEl);
      const effectiveBg = findEffectiveBg(stack);
      return { ...s, stack, effectiveBg };
    });

    setResults(newResults);

    // 콘솔에도 가독성 좋게 출력 (그룹 없이 평탄하게 — 사용자가 복사하기 쉽게)
    // eslint-disable-next-line no-console
    console.log(
      "%c[FlicksDebug] ===== 하단 영역 stacking 분석 =====",
      "color:#fff;background:#7c3aed;padding:2px 6px;border-radius:4px;font-weight:bold;"
    );
    newResults.forEach((r) => {
      // 그룹이 아니라 평탄하게 출력해서 한 번에 다 보이도록 함
      // eslint-disable-next-line no-console
      console.log(
        `📍 ${r.label}  (x=${Math.round(r.x)}, y=${Math.round(r.y)}) → 합성 배경: ${r.effectiveBg}`
      );
      r.stack.forEach((s, i) => {
        // eslint-disable-next-line no-console
        console.log(
          `   [${i}] <${s.tag}> bg=${s.bg} opacity=${s.opacity} z=${s.zIndex} class="${s.classHead}" top=${s.rectTop} bottom=${s.rectBottom}`
        );
      });
    });
    // eslint-disable-next-line no-console
    console.log(
      "[FlicksDebug] body bg:",
      window.getComputedStyle(document.body).backgroundColor,
      "| html bg:",
      window.getComputedStyle(document.documentElement).backgroundColor,
      "| window=", window.innerWidth, "x", window.innerHeight
    );
    // eslint-disable-next-line no-console
    console.log("%c[FlicksDebug] ===== 분석 끝 =====", "color:#a78bfa;");
  }, []);

  // 켜졌을 때 1회 측정. 이후엔 "↻ 재측정" 버튼으로 수동 갱신.
  useEffect(() => {
    if (!enabled) return;
    runSample();
  }, [enabled, runSample]);

  // 토글 버튼은 항상 노출 (화면 우상단)
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 80,
          right: 8,
          zIndex: 999999,
          display: "flex",
          gap: 4,
        }}
      >
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            background: enabled ? "#7c3aed" : "rgba(0,0,0,0.65)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.3)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {enabled ? `DEBUG ON (${tick})` : "DEBUG"}
        </button>
        {enabled && (
          <button
            type="button"
            onClick={() => {
              runSample();
              setTick((t) => t + 1);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              background: "#0ea5e9",
              color: "white",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            ↻ 재측정
          </button>
        )}
      </div>

      {enabled && (
        <>
          {/* 샘플링 좌표 위에 핀 표시 */}
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                position: "fixed",
                left: r.x - 6,
                top: r.y - 6,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "magenta",
                border: "2px solid white",
                zIndex: 999998,
                pointerEvents: "none",
                boxShadow: "0 0 0 1px black",
              }}
              aria-hidden
            />
          ))}

          {/* 분석 결과 패널 */}
          <div
            style={{
              position: "fixed",
              top: 110,
              left: 8,
              right: 8,
              maxHeight: "55vh",
              overflowY: "auto",
              zIndex: 999997,
              background: "rgba(0,0,0,0.85)",
              color: "white",
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              padding: 8,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 6, color: "#a78bfa" }}>
              [FlicksDebug] 하단 영역 stacking (tick {tick})
            </div>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: "1px dashed rgba(255,255,255,0.15)",
                }}
              >
                <div style={{ color: "#fbbf24" }}>
                  📍 {r.label} (x={Math.round(r.x)}, y={Math.round(r.y)})
                </div>
                <div>
                  <span style={{ color: "#9ca3af" }}>합성 배경:</span>{" "}
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      background: r.effectiveBg !== "(none)" ? r.effectiveBg : "transparent",
                      border: "1px solid white",
                      verticalAlign: "middle",
                      marginRight: 4,
                    }}
                  />
                  <span style={{ color: "#34d399" }}>{r.effectiveBg}</span>
                </div>
                {r.stack.map((s, j) => (
                  <div key={j} style={{ paddingLeft: 8, color: "#e5e7eb" }}>
                    [{j}] &lt;{s.tag}&gt; bg=
                    <span style={{ color: "#fca5a5" }}>{s.bg || "(none)"}</span> z={s.zIndex} cls="
                    <span style={{ color: "#93c5fd" }}>{s.classHead}</span>"
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};

export default FlicksBottomDebugOverlay;
