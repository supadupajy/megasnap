import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  // GitHub Pages 배포 시 레포지토리 이름을 경로로 인식하도록 설정
  // 환경 변수가 없으면 상대 경로('./')를 사용하여 어디서든 작동하게 합니다.
  base: "./",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));