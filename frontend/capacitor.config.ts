import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendx.app',
  appName: 'AttendX',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
