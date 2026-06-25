import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'out/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/index.tsx'),
      output: {
        entryFileNames: 'webview.js',
        chunkFileNames: '[name].js',
        assetFileNames: 'webview.[ext]'
      }
    }
  }
});
