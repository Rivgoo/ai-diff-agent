import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'out/webview',
    emptyOutDir: true,
    assetsInlineLimit: 100000, // <--- Змушуємо Vite запакувати гіфку у Base64
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