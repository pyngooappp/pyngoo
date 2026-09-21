import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.pyngoo.chat',
  appName: 'Pyngoo',
  webDir: 'dist',
  backgroundColor: '#0f0c29',
  server: {
    androidScheme: 'https'
  },
  ios: {
    scrollEnabled: true,
    contentInset: 'always',
    backgroundColor: '#0f0c29'
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-6163702675931285~1338244734'
    }
  }
};

export default config;
