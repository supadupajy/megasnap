import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { DebugLogEntry } from '@/utils/debug-log';

const MAX_LOGS = 80;

const DebugLogOverlay = () => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    const text = logs.map((l) => `${l.time} ${l.message}`).join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 폴백: textarea로 복사
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 무시
    }
  };

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
              onClick={handleCopy}
              disabled={logs.length === 0}
              className={`h-7 px-2 flex items-center gap-1 rounded-lg active:scale-90 transition text-[10px] font-black ${
                copied ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white disabled:opacity-40'
              }`}
              aria-label="로그 복사"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? '복사됨' : '복사'}</span>
            </button>
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
