import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.AGRISHIELD_SENSOR_ORIGIN || env.AGRISHIELD_SENSOR_ORIGIN;
  const proxy = target ? {
    '/api/moisture': { target, changeOrigin: true, timeout: 4000, proxyTimeout: 4000 },
  } : {};
  return {
    server: { proxy },
    preview: { proxy },
    plugins: [VitePWA({
      manifest: false,
      injectRegister: null,
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,wav,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    })],
  };
});
