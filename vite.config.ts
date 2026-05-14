import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    // GitHub Pages의 다양한 경로 대응을 위해 상대 경로 사용
    base: "./",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [dyadComponentTagger(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "react": path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      },
    },
    build: {
      outDir: "dist",
      chunkSizeWarningLimit: 1000,
      minify: "esbuild",
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
          // [Optimized] 수동 청크 분리:
          // 무거운 vendor 라이브러리들을 별도 파일로 분리하여 캐싱 효율 향상.
          // 첫 로딩 시 동시 다운로드 + 라우트 변경 시 vendor 재다운로드 없음.
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "supabase": [
              "@supabase/supabase-js",
              "@supabase/auth-ui-react",
              "@supabase/auth-ui-shared",
            ],
            "framer": ["framer-motion"],
            "radix": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
            ],
            "query": ["@tanstack/react-query"],
          },
        },
      },
    },
    // [Optimized] esbuild로 production 빌드 시 console.log/debug/info/trace 자동 제거.
    // console.error, console.warn은 운영 모니터링용으로 유지.
    // 개발 모드(mode !== 'production')에서는 그대로 보존.
    esbuild: {
      drop: isProd ? ["debugger"] : [],
      pure: isProd
        ? ["console.log", "console.debug", "console.info", "console.trace"]
        : [],
    },
  };
});
