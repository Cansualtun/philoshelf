import {defineConfig} from 'vite';
export default defineConfig({
  base: '/admin/',
  server: {proxy: {'/api': 'http://127.0.0.1:3001'}},
  build: {outDir: 'dist'},
});
