import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'monaco-editor': ['@monaco-editor/react'],
          'mermaid-charts': ['mermaid'],
          'yaml-parser': ['js-yaml'],
          'markdown-renderer': ['react-markdown', 'remark-gfm'],
          // Utilities
          'json-editor': ['vanilla-jsoneditor'],
        },
      },
    },
    // Increase chunk size warning limit for large chunks
    chunkSizeWarningLimit: 1000,
    // Enable source maps for better debugging
    sourcemap: false,
    // Minify for production
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
