import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.chorasnap',
  appName: 'ChoraSnap',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: "body",
      style: "light",
      resizeOnFullScreen: true,
    },
    Geolocation: {
      // iOS: NSLocationWhenInUseUsageDescription 등은 Info.plist에서 설정
      // Android: AndroidManifest.xml에서 ACCESS_FINE_LOCATION 권한 필요
    },
  },
};

export default config;
