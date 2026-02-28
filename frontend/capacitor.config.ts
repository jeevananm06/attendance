import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendancems.app',
  appName: 'AttendanceMS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Set your production API URL here when deploying to Android
    // url: 'https://your-backend.onrender.com',
    // cleartext: true,  // only needed for HTTP (non-HTTPS) backends
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
