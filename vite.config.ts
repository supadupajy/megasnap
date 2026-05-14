import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
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
    // [Optimized] 프로덕션 빌드 시 console.log/debugger 자동 제거
    // 다만 console.error/warn은 운영 환경에서도 필요하므로 유지
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // [Optimized] 수동 청크 분리:
        // 무거운 vendor 라이브러리들을 별도 파일로 분리하여 캐싱 효율 향상.
        // 첫 로딩 시 동시 다운로드 + 라우트 변경 시 vendor 재다운로드 없음.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js', '@supabase/auth-ui-react', '@supabase/auth-ui-shared'],
          'framer': ['framer-motion'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
  // [Optimized] esbuild로 production에서 console.* 자동 제거 (error/warn 제외)
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    pure: process.env.NODE_ENV === 'production'
      ? ['console.log', 'console.debug', 'console.info', 'console.trace']
      : [],
  },
}));
