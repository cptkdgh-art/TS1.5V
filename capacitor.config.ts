import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jinpok.studio',
  appName: '진폭스튜디오',
  webDir: 'dist',

  // Android 프로젝트를 D: 드라이브에 생성
  android: {
    path: 'D:/진폭스튜디오-android'
  },

  server: {
    androidScheme: 'https'
  }
};

export default config;
