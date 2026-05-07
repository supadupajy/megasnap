import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * 상태바를 흰색 배경 + 어두운 아이콘(시간/배터리/WiFi)으로 설정합니다.
 * 헤더가 흰색 배경이라서 상태바 아이콘이 잘 보이지 않는 문제를 해결합니다.
 */
export const initStatusBar = async () => {
  // 네이티브 플랫폼에서만 동작 (웹 미리보기에서는 무시)
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 아이콘/텍스트를 어두운 색으로 (밝은 배경에서 잘 보이도록)
    await StatusBar.setStyle({ style: Style.Light });

    // Android의 경우 상태바 배경색도 흰색으로 설정
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
    }

    // 상태바가 웹뷰를 덮지 않도록 (overlay 비활성화)
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (error) {
    console.warn('[StatusBar] 상태바 초기화 실패:', error);
  }
};
