import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
// @ts-ignore
import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

function agoraTokenPlugin(env: Record<string, string>) {
  return {
    name: 'agora-token-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/token', (req: any, res: any) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const channelName = url.searchParams.get('channel');
          const appId = env.VITE_AGORA_APP_ID;
          const appCertificate = env.VITE_AGORA_APP_CERTIFICATE;

          if (!appId || !appCertificate || !channelName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing parameters' }));
            return;
          }

          const uid = Math.floor(Math.random() * 10000);
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const privilegeExpiredTs = currentTimestamp + 3600;

          // @ts-ignore
          const token = RtcTokenBuilder.buildTokenWithUid(
            appId, 
            appCertificate, 
            channelName, 
            uid, 
            RtcRole.PUBLISHER, 
            privilegeExpiredTs
          );

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ token, uid }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      host: true, // Ağdaki cihazların (telefonun vs.) erişebilmesi için
      allowedHosts: true, // Tunnelmole gibi dış bağlantıları engellememesi için
    },
    plugins: [
      nodePolyfills(),
      react(),
      agoraTokenPlugin(env),
    ],
  };
});
