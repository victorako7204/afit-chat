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
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'framer-motion'],
          chat: ['socket.io-client', 'axios'],
          pdf: ['react-pdf'],
          chess: ['react-chessboard', 'chess.js'],
          math: ['react-markdown', 'remark-math', 'rehype-katex', 'katex'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:10000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
