import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import astrowind from './vendor/integration';

export default defineConfig({
  output: 'static',
  build: { format: 'preserve', inlineStylesheets: 'never' },
  integrations: [
    sitemap({ filter: (page) => !/(?:^|\/)404(?:\.html|\/|$)/.test(new URL(page).pathname) }),
    astrowind({ config: './src/config.yaml' }),
  ],
  vite: { plugins: [tailwindcss()], resolve: { alias: { '~': new URL('./src', import.meta.url).pathname } } },
});
