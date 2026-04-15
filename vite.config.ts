import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  // Vercel 배포 시 루트 경로 설정을 명확히 합니다.
  base: "/",
  server: {
    host: "localhost",
    port: 52193,
    strictPort: true, // 해당 포트가 사용 중일 경우 다른 포트로 자동 전환되지 않도록 설정
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 빌드 결과물이 생성될 폴더를 명시합니다.
    outDir: "dist",
    // 청크 파일 크기 경고 제한을 조절합니다.
    chunkSizeWarningLimit: 1000,
  }
}));