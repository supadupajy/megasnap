import React from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import App from "./App";
import "./globals.css";
import { initStatusBar } from "./utils/statusBar";

// 네이티브 앱에서 상태바(시간/배터리/WiFi 아이콘)를 어두운 색으로 설정
initStatusBar();

if (Capacitor.isNativePlatform()) {
  Keyboard.setScroll({ isDisabled: true }).catch(() => {});
}

const keepRootViewportStableDuringCommentFocus = () => {
  const isCommentInput = (element: EventTarget | null) =>
    element instanceof HTMLElement && element.matches('[data-comment-input="true"]');

  const stabilize = () => {
    if (!document.body.hasAttribute('data-comment-keyboard-focus')) return;

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    document.documentElement.style.setProperty('--keyboard-viewport-pan-y', `${Math.max(0, viewportTop)}px`);
  };

  let frameId: number | null = null;
  let endAt = 0;

  const tick = () => {
    stabilize();
    if (performance.now() < endAt) {
      frameId = window.requestAnimationFrame(tick);
    } else {
      frameId = null;
    }
  };

  const start = () => {
    document.body.setAttribute('data-comment-keyboard-focus', 'true');
    endAt = performance.now() + 900;
    if (frameId === null) frameId = window.requestAnimationFrame(tick);
    [0, 80, 180, 360, 620, 900].forEach((delay) => window.setTimeout(stabilize, delay));
  };

  const stop = () => {
    document.body.removeAttribute('data-comment-keyboard-focus');
    document.documentElement.style.setProperty('--keyboard-viewport-pan-y', '0px');
  };

  document.addEventListener('focusin', (event) => {
    if (isCommentInput(event.target)) start();
  });
  document.addEventListener('focusout', (event) => {
    if (isCommentInput(event.target)) window.setTimeout(stop, 120);
  });
  window.visualViewport?.addEventListener('resize', stabilize);
  window.visualViewport?.addEventListener('scroll', stabilize);
};

keepRootViewportStableDuringCommentFocus();

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