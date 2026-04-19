import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.chorasnap',
  appName: 'Chora',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: "body",
      style: "light",
      resizeOnFullScreen: true,
    },
  },
};

export default config;