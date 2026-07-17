// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: set the real domain before launch
  site: 'https://sharpemu.example',
  vite: {
    plugins: [tailwindcss()],
  },
});
