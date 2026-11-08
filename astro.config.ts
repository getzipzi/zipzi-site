import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import astrowind from './vendor/integration';
import { languages } from './src/i18n';

export default defineConfig({
  output: 'static',
  build: { format: 'preserve', inlineStylesheets: 'never' },
  integrations: [
    sitemap({
      filter: (page) => !/(?:^|\/)404(?:\.html|\/|$)/.test(new URL(page).pathname) && new URL(page).pathname !== '/en/',
      i18n: {
        defaultLocale: 'en',
        locales: Object.fromEntries(languages.map(({ code, lang }) => [code, lang])),
      },
    }),
    astrowind({ config: './src/config.yaml' }),
  ],
  vite: { plugins: [tailwindcss()], resolve: { alias: { '~': new URL('./src', import.meta.url).pathname } } },
});
