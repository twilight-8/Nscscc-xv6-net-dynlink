import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT || 4180),
    proxy: {
      '/api': 'http://localhost:4182',
      '/project-assets': 'http://localhost:4182',
      '/terminal': {
        target: 'ws://localhost:4182',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          terminal: ['@xterm/xterm', '@xterm/addon-fit'],
          flow: ['@xyflow/react'],
        },
      },
    },
  },
});
