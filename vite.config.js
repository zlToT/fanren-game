import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5199,
    open: false,
  },
  optimizeDeps: {
    include: ['pixi.js'],
  },
});
