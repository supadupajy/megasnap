import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { DebugLogEntry } from '@/utils/debug-log';

const MAX_LOGS = 80;

const DebugLogOverlay = () => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<DebugLogEntry>).detail;
      if (!detail) return;
      setLogs((prev) => {
        const next = [...prev, detail];
        return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
      });
    };
    window.addEventListener('debug-log', handle);
    return () => window.removeEventListener('debug-log', handle);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed left-2 right-2 z-[2147483647] pointer-events-none"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
      }}
    >
      <div className="pointer-events-auto rounded-2xl bg-black/85 text-white shadow-2xl backdrop-blur-sm border border-white/10 overflow-hidden max-w-md mx-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
          <span className="text-[11px] font-black tracking-wide text-emerald-300">
            DEBUG · {logs.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLogs([])}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/10 active:scale-90 transition"
              aria-label="로그 지우기"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/10 active:scale-90 transition"
              aria-label={collapsed ? '펼치기' : '접기'}
            >
              {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {!collapsed && (
          <div
            ref={scrollRef}
            className="max-h-[200px] overflow-y-auto px-3 py-2 font-mono text-[10px] leading-[14px] space-y-0.5"
          >
            {logs.length === 0 ? (
              <p className="text-white/40 text-center py-2">로그 없음</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="break-all">
                  <span className="text-emerald-300/80">{log.time.slice(3)}</span>{' '}
                  <span className="text-white/90">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default DebugLogOverlay;
