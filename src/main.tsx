import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";
import { initStatusBar } from "./utils/statusBar";

// 네이티브 앱에서 상태바(시간/배터리/WiFi 아이콘)를 어두운 색으로 설정
initStatusBar();

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
  root.render(<App />);
}
