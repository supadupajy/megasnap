"use client";

import React from 'react';

export interface DebugLogEntry {
  id: number;
  t: number;
  msg: string;
}

let _id = 0;
const listeners = new Set<(entries: DebugLogEntry[]) => void>();
let _entries: DebugLogEntry[] = [];

export function pushDebugLog(msg: string) {
  const entry: DebugLogEntry = { id: ++_id, t: Date.now(), msg };
  _entries = [..._entries.slice(-99), entry]; // 최근 100개
  listeners.forEach(fn => fn(_entries));
  // eslint-disable-next-line no-console
  console.log('[banner-debug]', msg);
}

// 초기 진단 로그 — 모듈 로딩 시점에 한 번 (코드가 실제 빌드에 반영되었는지 확인용)
pushDebugLog(`🚀 DebugBannerOverlay module loaded @ ${new Date().toISOString()}`);

const DebugBannerOverlay: React.FC = () => {
  const [entries, setEntries] = React.useState<DebugLogEntry[]>(_entries);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    pushDebugLog(`🐞 DebugBannerOverlay MOUNT`);
    const fn = (es: DebugLogEntry[]) => setEntries(es);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // body의 인라인 스타일 변화를 감지 (Radix Dialog 영향 확인용)
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          const s = document.body.getAttribute('style') || '';
          pushDebugLog(`👀 body style="${s.slice(0, 80)}"`);
        }
        if (m.type === 'attributes' && m.attributeName === 'data-scroll-locked') {
          pushDebugLog(`👀 body data-scroll-locked=${document.body.getAttribute('data-scroll-locked')}`);
        }
      });
    });
    observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="fixed z-[99999] bg-black/95 text-white text-[10px] font-mono rounded-lg shadow-2xl border-2 border-red-500 pointer-events-auto"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        left: 8,
        right: 8,
        maxHeight: collapsed ? 28 : '50vh',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center justify-between px-2 py-1 bg-red-600 text-white text-[10px] font-black">
        <span>🐞 BANNER DEBUG ({entries.length})</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              _entries = [];
              listeners.forEach(fn => fn(_entries));
            }}
            className="bg-white/20 px-2 rounded"
          >
            CLR
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="bg-white/20 px-2 rounded"
          >
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-2 overflow-auto" style={{ maxHeight: 'calc(50vh - 28px)' }}>
          {entries.length === 0 ? (
            <div className="text-white/50">no logs yet…</div>
          ) : (
            entries
              .slice()
              .reverse()
              .map(e => {
                const d = new Date(e.t);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const ss = String(d.getSeconds()).padStart(2, '0');
                const ms = String(d.getMilliseconds()).padStart(3, '0');
                return (
                  <div key={e.id} className="leading-tight break-all">
                    <span className="text-emerald-300">
                      {hh}:{mm}:{ss}.{ms}
                    </span>{' '}
                    {e.msg}
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
};

export default DebugBannerOverlay;
