import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chorasnap.chorasnap',
  appName: '하이버블즈',
  webDir: 'dist',

  server: {
    hostname: 'localhost',
    iosScheme: 'http',
  },
  ios: {
    allowsLinkPreview: false,
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {

    Keyboard: {
      resize: "none",
      style: "light",
      resizeOnFullScreen: false,
    },

    Geolocation: {
      // iOS: NSLocationWhenInUseUsageDescription 등은 Info.plist에서 설정
      // Android: AndroidManifest.xml에서 ACCESS_FINE_LOCATION 권한 필요
    },
    StatusBar: {
      // 상태바가 웹뷰 위로 겹치지 않게 (헤더가 가려지지 않도록)
      overlaysWebView: false,
      // 아이콘/텍스트 색상: DARK = 어두운 색 아이콘 (밝은 배경에서 잘 보임)
      style: "DARK",
      // 상태바 배경색: 흰색 (헤더와 자연스럽게 이어짐)
      backgroundColor: "#FFFFFF",
    },
  },
};

export default config;
