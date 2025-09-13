// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: "/", // Netlify에서는 절대 경로 사용
  server: {
    port: 3000,
    open: true,
    usePolling: true,  // 파일 변경 감지를 위한 폴링 활성화
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
    
  build: {
    outDir: 'build', // 빌드 결과물을 폴더에 저장
    rollupOptions: {
      external: ['stats.js'],
      output: {
        manualChunks: undefined, // 단일 번들로 강제
        inlineDynamicImports: true // 동적 import 인라인 처리
      }
    },
    sourcemap: false, // 소스맵 비활성화
    minify: 'esbuild', // esbuild 사용 (더 빠르고 안정적)
    target: 'es2015' // 호환성 향상
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr']
});

