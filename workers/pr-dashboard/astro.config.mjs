// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://pr.sharpemu.app',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
