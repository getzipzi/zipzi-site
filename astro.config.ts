import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import astrowind from './vendor/integration';

export default defineConfig({
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'never' },
  integrations: [
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/404') }),
    astrowind({ config: './src/config.yaml' }),
  ],
  vite: { plugins: [tailwindcss()], resolve: { alias: { '~': new URL('./src', import.meta.url).pathname } } },
});
