import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 57130,
    strictPort: true, // 지정된 포트가 사용 중이면 서버 실행을 중단하여 포트 변경 방지
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1000,
  }
}));