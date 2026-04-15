import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  "appId": "com.example.chora", // 선택사항: 패키지명도 바꾸려면 수정
  "appName": "Chora",           // 여기가 실제 앱 이름입니다
  "webDir": "www",
  "server": {
    "hostname": "localhost",
    "androidScheme": "http"
  }
}

export default config;