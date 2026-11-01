import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 相对路径：dist/ 放在任何子目录（如 GitHub Pages 的仓库页）都能打开
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
});
