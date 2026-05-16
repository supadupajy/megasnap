import React, { useEffect, useMemo, useRef, useState } from 'react';

type DebugEntry = {
  id: number;
  time: string;
  label: string;
  payload: unknown;
};

const entries: DebugEntry[] = [];
const listeners = new Set<() => void>();
let idCounter = 0;

const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getScrollSnapshot = () => {
  const vv = window.visualViewport;
  const scrollingElement = document.scrollingElement || document.documentElement;
  const active = document.activeElement as HTMLElement | null;

  return {
    location: window.location.pathname,
    windowScroll: { x: window.scrollX, y: window.scrollY },
    documentScroll: { left: scrollingElement.scrollLeft, top: scrollingElement.scrollTop },
    bodyScroll: { left: document.body.scrollLeft, top: document.body.scrollTop },
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visual: vv
        ? {
            width: vv.width,
            height: vv.height,
            offsetLeft: vv.offsetLeft,
            offsetTop: vv.offsetTop,
            pageLeft: vv.pageLeft,
            pageTop: vv.pageTop,
            scale: vv.scale,
          }
        : null,
    },
    activeElement: active
      ? {
          tag: active.tagName,
          id: active.id || null,
          className: active.className?.toString().slice(0, 160) || null,
        }
      : null,
  };
};

const addEntry = (label: string, extra?: unknown) => {
  const mapSnapshot = (window as any).__tocaGetMapDebugSnapshot?.() ?? null;
  const entry: DebugEntry = {
    id: ++idCounter,
    time: new Date().toISOString(),
    label,
    payload: {
      label,
      extra,
      map: mapSnapshot,
      page: getScrollSnapshot(),
    },
  };

  entries.push(entry);
  if (entries.length > 200) entries.splice(0, entries.length - 200);
  listeners.forEach((listener) => listener());
};

const EditMapDebugger = () => {
  const [, forceRender] = useState(0);
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (window as any).__tocaCaptureEditMapDebug = addEntry;
    addEntry('debugger-mounted');

    const listener = () => forceRender((value) => value + 1);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if ((window as any).__tocaCaptureEditMapDebug === addEntry) {
        delete (window as any).__tocaCaptureEditMapDebug;
      }
    };
  }, []);

  const text = useMemo(
    () =>
      entries
        .map((entry) => `[${entry.time}] ${entry.label}\n${safeJson(entry.payload)}`)
        .join('\n\n---\n\n'),
    [entries.length]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alert('지도 디버그 로그를 복사했습니다.');
    } catch {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.display = 'block';
      textarea.value = text;
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {}
      alert('복사가 안 되면 아래 텍스트를 길게 눌러 복사해주세요.');
    }
  };

  const clear = () => {
    entries.length = 0;
    forceRender((value) => value + 1);
  };

  const manualSnapshot = () => {
    addEntry('manual-snapshot');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          position: 'fixed',
          right: 8,
          bottom: 150,
          zIndex: 2147483647,
          width: 58,
          height: 44,
          borderRadius: 14,
          border: '2px solid white',
          background: '#7c3aed',
          color: 'white',
          fontSize: 10,
          fontWeight: 800,
          boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
        }}
      >
        MAP
        <br />
        {entries.length}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            left: 10,
            right: 10,
            top: 92,
            bottom: 12,
            zIndex: 2147483646,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 14,
            background: 'rgba(15,23,42,0.97)',
            color: 'white',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10 }}>
            <strong style={{ fontSize: 13 }}>지도 위치 디버거</strong>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{entries.length}</span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={manualSnapshot} style={buttonStyle('#2563eb')}>스냅샷</button>
            <button type="button" onClick={copy} style={buttonStyle('#059669')}>복사</button>
            <button type="button" onClick={clear} style={buttonStyle('#b45309')}>지우기</button>
            <button type="button" onClick={() => setOpen(false)} style={buttonStyle('#4b5563')}>닫기</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 10px', fontSize: 11, whiteSpace: 'pre-wrap' }}>
            {text || '아직 로그가 없습니다.'}
          </div>

          <textarea
            ref={textareaRef}
            readOnly
            style={{ display: 'none', minHeight: 120, background: '#020617', color: 'white', fontSize: 11 }}
          />
        </div>
      )}
    </>
  );
};

const buttonStyle = (background: string): React.CSSProperties => ({
  border: 0,
  borderRadius: 8,
  background,
  color: 'white',
  padding: '7px 9px',
  fontSize: 11,
  fontWeight: 800,
});

export default EditMapDebugger;
