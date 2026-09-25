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
    contentInset: 'automatic',
    backgroundColor: '#0f0c29'
  },
  plugins: {
    // Uygulama açıkken gelen bildirimler de iOS'ta üstte gösterilsin
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    AdMob: {
      appId: 'ca-app-pub-6163702675031285~1338244734'
    }
  }
};

export default config;
