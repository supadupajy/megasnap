import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  "appId": "com.example.chora",
  "appName": "Chora",
  "webDir": "dist", // Vite의 기본 빌드 폴더인 dist로 수정
  "server": {
    "hostname": "localhost",
    "androidScheme": "http"
  }
}

export default config;