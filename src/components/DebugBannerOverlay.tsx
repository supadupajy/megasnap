"use client";

import React from 'react';

export interface DebugLogEntry {
  id: number;
  t: number; // timestamp ms
  msg: string;
}

let _id = 0;
const listeners = new Set<(entries: DebugLogEntry[]) => void>();
let _entries: DebugLogEntry[] = [];

export function pushDebugLog(msg: string) {
  const entry: DebugLogEntry = { id: ++_id, t: Date.now(), msg };
  _entries = [..._entries.slice(-49), entry]; // 최근 50개만
  listeners.forEach(fn => fn(_entries));
  // 콘솔에도 같이
  // eslint-disable-next-line no-console
  console.log('[banner-debug]', msg);
}

const DebugBannerOverlay: React.FC = () => {
  const [entries, setEntries] = React.useState<DebugLogEntry[]>(_entries);
  const [open, setOpen] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const fn = (es: DebugLogEntry[]) => setEntries(es);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-2 z-[99999] bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg"
      >
        DBG
      </button>
    );
  }

  return (
    <div
      className="fixed z-[99999] bg-black/90 text-white text-[10px] font-mono rounded-lg shadow-2xl border border-red-500"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        left: 8,
        right: 8,
        maxHeight: collapsed ? 32 : '40vh',
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
          <button
            onClick={() => setOpen(false)}
            className="bg-white/20 px-2 rounded"
          >
            ✕
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-2 overflow-auto" style={{ maxHeight: 'calc(40vh - 28px)' }}>
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
