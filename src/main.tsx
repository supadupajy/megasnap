import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";
import { initStatusBar } from "./utils/statusBar";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

// 네이티브 앱에서 상태바(시간/배터리/WiFi 아이콘)를 어두운 색으로 설정
initStatusBar();

const configureNativeKeyboard = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // iOS WKWebView가 input 포커스 시 화면 전체를 자동으로 밀어 올리는 동작을 끈다.
    // 댓글 입력 시 지도까지 같이 위로 튀는 현상은 이 WebView 자동 스크롤이 원인이다.
    await Keyboard.setScroll({ isDisabled: true });
  } catch (error) {
    console.warn('[Keyboard] Failed to disable native WebView scroll:', error);
  }
};

configureNativeKeyboard();

// iOS Safari는 user-scalable=no를 무시하므로 JS로 페이지 핀치 줌 차단
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
// touchmove에서 두 손가락 제스처(ctrlKey=true)로 오는 브라우저 줌도 차단
document.addEventListener('touchmove', (e) => {
  if ((e as TouchEvent).touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}