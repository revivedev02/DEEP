import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
  build: {
    // Disable source maps in production for smaller bundle
    sourcemap: false,
    // Target modern browsers for smaller output
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy vendor libs in their own chunks — cached separately
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-socket':  ['socket.io-client'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
    // Warn above 500KB
    chunkSizeWarningLimit: 500,
    // Use terser for better minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Strip console.log in production
        drop_debugger: true,
        passes: 2,
      },
    },
  },
});
