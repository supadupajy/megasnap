// 화면에 떠 있는 디버그 로그 오버레이용 유틸리티.
// 스마트폰에서도 콘솔을 열지 않고 로그를 볼 수 있도록 window 이벤트로 발송한다.

export type DebugLogEntry = {
  id: number;
  time: string;
  message: string;
};

let counter = 0;

export function debugLog(message: string, data?: any) {
  let formatted = message;
  if (data !== undefined) {
    try {
      formatted += ' ' + (typeof data === 'string' ? data : JSON.stringify(data));
    } catch {
      formatted += ' [unserializable]';
    }
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

  const entry: DebugLogEntry = {
    id: ++counter,
    time,
    message: formatted,
  };

  // 콘솔에도 출력
  // eslint-disable-next-line no-console
  console.log('[debug]', time, formatted);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<DebugLogEntry>('debug-log', { detail: entry }));
  }
}
