"use client";

/**
 * 스마트폰에서도 console 로그를 화면에서 보고 복사할 수 있는 온스크린 디버거.
 *
 * - 화면 우하단의 작은 "DBG" 버블을 탭하면 패널이 열린다.
 * - 패널 안에서 "복사"를 누르면 모든 로그가 클립보드(또는 fallback textarea 선택)로 복사된다.
 * - 기본적으로 [edit-scroll-bug] 태그가 붙은 로그만 필터링하지만, "전체" 토글로 모든 로그를 볼 수 있다.
 * - console.log/info/warn/error를 monkey-patch해서 로그를 가로채고, 원본 console에도 그대로 전달한다.
 *
 * 운영 환경에 영향이 없도록 단독 React 컴포넌트로 격리되어 있고,
 * App 트리 최상단에 한 번만 마운트되면 된다.
 */

import React, { useEffect, useRef, useState } from "react";

type LogLevel = "log" | "info" | "warn" | "error";
type LogEntry = {
  id: number;
  ts: number;
  level: LogLevel;
  text: string;
};

const FILTER_TAG = "[edit-scroll-bug]";
const MAX_LOGS = 500;

// 모든 인자를 사람이 읽을 수 있는 한 줄 문자열로 변환
const stringifyArgs = (args: unknown[]): string => {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a, (_k, v) => {
          if (typeof v === "bigint") return v.toString();
          return v;
        });
      } catch {
        try {
          return String(a);
        } catch {
          return "[Unserializable]";
        }
      }
    })
    .join(" ");
};

// 전역 로그 버퍼 — 컴포넌트가 mount되기 전에 발생한 로그도 잡기 위해 모듈 스코프에서 관리
const buffer: LogEntry[] = [];
const listeners = new Set<() => void>();
let logIdCounter = 0;
let consolePatched = false;

const pushLog = (level: LogLevel, args: unknown[]) => {
  const entry: LogEntry = {
    id: ++logIdCounter,
    ts: Date.now(),
    level,
    text: stringifyArgs(args),
  };
  buffer.push(entry);
  if (buffer.length > MAX_LOGS) buffer.splice(0, buffer.length - MAX_LOGS);
  listeners.forEach((cb) => cb());
};

const patchConsole = () => {
  if (consolePatched) return;
  consolePatched = true;

  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  (["log", "info", "warn", "error"] as LogLevel[]).forEach((level) => {
    (console as any)[level] = (...args: unknown[]) => {
      try {
        pushLog(level, args);
      } catch {
        /* swallow */
      }
      orig[level](...args);
    };
  });

  // 처리되지 않은 에러도 잡아서 보여주기
  window.addEventListener("error", (e) => {
    pushLog("error", [
      `[window.error] ${e.message}`,
      `at ${e.filename}:${e.lineno}:${e.colno}`,
    ]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    pushLog("error", [`[unhandledrejection]`, (e as any).reason]);
  });
};

// 즉시 console patch (컴포넌트 mount 이전 로그도 캡쳐)
if (typeof window !== "undefined") {
  patchConsole();
}

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

const OnScreenDebugger: React.FC = () => {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fallback">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cb = () => force((n) => n + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  // 새 로그가 들어오면 자동으로 아래로 스크롤
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const visible = showAll
    ? buffer
    : buffer.filter((l) => l.text.includes(FILTER_TAG));

  const allText = visible
    .map((l) => `[${formatTime(l.ts)}] [${l.level.toUpperCase()}] ${l.text}`)
    .join("\n");

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(allText);
        setCopyState("ok");
        setTimeout(() => setCopyState("idle"), 1500);
        return;
      }
      throw new Error("no-clipboard-api");
    } catch {
      // Fallback: textarea를 선택해서 사용자가 직접 길게 눌러 복사할 수 있게 함
      const ta = textareaRef.current;
      if (ta) {
        ta.value = allText;
        ta.style.display = "block";
        ta.focus();
        ta.select();
        try {
          // 일부 환경에선 execCommand가 동작함
          document.execCommand?.("copy");
        } catch {
          /* ignore */
        }
        setCopyState("fallback");
        setTimeout(() => setCopyState("idle"), 4000);
      }
    }
  };

  const handleClear = () => {
    buffer.length = 0;
    force((n) => n + 1);
  };

  // 토글 버블 — 항상 보이며, 다른 UI를 가리지 않도록 작게 유지
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="디버거 토글"
        style={{
          position: "fixed",
          right: 8,
          bottom: 96,
          zIndex: 2147483647,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: visible.length > 0 ? "#dc2626" : "#374151",
          color: "white",
          fontSize: 11,
          fontWeight: 700,
          boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          border: "2px solid white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1,
        }}
      >
        DBG
        <span style={{ position: "absolute", bottom: 2, fontSize: 9, fontWeight: 600 }}>
          {visible.length}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="온스크린 디버거"
          style={{
            position: "fixed",
            left: 8,
            right: 8,
            bottom: 8,
            top: 80,
            zIndex: 2147483646,
            background: "rgba(17,24,39,0.97)",
            color: "#f9fafb",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 11,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: 12 }}>디버거</strong>
            <span style={{ opacity: 0.7, fontSize: 10 }}>
              {visible.length} / {buffer.length}
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              style={btnStyle(showAll ? "#2563eb" : "#374151")}
            >
              {showAll ? "전체" : "필터"}
            </button>
            <button type="button" onClick={handleCopy} style={btnStyle("#059669")}>
              {copyState === "ok"
                ? "복사됨!"
                : copyState === "fallback"
                ? "선택됨, 길게눌러복사"
                : "복사"}
            </button>
            <button type="button" onClick={handleClear} style={btnStyle("#b45309")}>
              지우기
            </button>
            <button type="button" onClick={() => setOpen(false)} style={btnStyle("#4b5563")}>
              닫기
            </button>
          </div>

          {/* Log list */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "6px 10px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {visible.length === 0 ? (
              <div style={{ opacity: 0.6, padding: 12, textAlign: "center" }}>
                {showAll
                  ? "아직 로그가 없습니다."
                  : `"${FILTER_TAG}" 태그 로그가 없습니다. "전체" 버튼을 눌러 모든 로그를 보세요.`}
              </div>
            ) : (
              visible.map((l) => (
                <div
                  key={l.id}
                  style={{
                    padding: "4px 0",
                    borderBottom: "1px dashed rgba(255,255,255,0.08)",
                    color: levelColor(l.level),
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  <span style={{ opacity: 0.55 }}>{formatTime(l.ts)}</span>{" "}
                  <span style={{ fontWeight: 700 }}>[{l.level.toUpperCase()}]</span>{" "}
                  {l.text}
                </div>
              ))
            )}
          </div>

          {/* Fallback textarea — 클립보드 API가 실패할 때만 보임 */}
          <textarea
            ref={textareaRef}
            readOnly
            style={{
              display: "none",
              width: "100%",
              minHeight: 120,
              background: "#111827",
              color: "#f9fafb",
              border: "1px solid #374151",
              padding: 8,
              fontSize: 11,
              fontFamily: "inherit",
            }}
          />
        </div>
      )}
    </>
  );
};

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg,
  color: "white",
  border: 0,
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
});

const levelColor = (level: LogLevel) => {
  switch (level) {
    case "error":
      return "#fca5a5";
    case "warn":
      return "#fde68a";
    case "info":
      return "#93c5fd";
    default:
      return "#e5e7eb";
  }
};

export default OnScreenDebugger;
