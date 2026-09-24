import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Not: Agora token'ı artık yalnızca Supabase 'agora-token' Edge Function'ında üretilir.
// Bu yüzden 'agora-token' paketi ve Node polyfill'leri (elliptic / crypto-browserify açıkları)
// istemci derlemesinden tamamen çıkarıldı.
export default defineConfig({
  server: {
    host: true, // Ağdaki cihazların (telefonun vs.) erişebilmesi için
    allowedHosts: true, // Tunnelmole gibi dış bağlantıları engellememesi için
  },
  plugins: [
    react(),
  ],
});
