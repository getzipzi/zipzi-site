import fs from 'node:fs';

import type { AstroConfig, AstroIntegration } from 'astro';

import configBuilder, { type Config } from './utils/configBuilder';
import loadConfig from './utils/loadConfig';

export default ({ config: _themeConfig = 'src/config.yaml' } = {}): AstroIntegration => {
  let cfg: AstroConfig;
  return {
    name: 'astrowind-integration',

    hooks: {
      'astro:config:setup': async ({
        // command,
        config,
        // injectRoute,
        // isRestart,
        logger,
        updateConfig,
        addWatchFile,
      }) => {
        const buildLogger = logger.fork('astrowind');

        const virtualModuleId = 'astrowind:config';
        const resolvedVirtualModuleId = '\0' + virtualModuleId;

        const rawJsonConfig = (await loadConfig(_themeConfig)) as Config;
        const { SITE, I18N, METADATA, APP_BLOG, UI, ANALYTICS } = configBuilder(rawJsonConfig);

        updateConfig({
          site: SITE.site,
          base: SITE.base,

          trailingSlash: SITE.trailingSlash ? 'always' : 'never',

          vite: {
            plugins: [
              {
                name: 'vite-plugin-astrowind-config',
                resolveId(id) {
                  if (id === virtualModuleId) {
                    return resolvedVirtualModuleId;
                  }
                },
                load(id) {
                  if (id === resolvedVirtualModuleId) {
                    return `
                    export const SITE = ${JSON.stringify(SITE)};
                    export const I18N = ${JSON.stringify(I18N)};
                    export const METADATA = ${JSON.stringify(METADATA)};
                    export const APP_BLOG = ${JSON.stringify(APP_BLOG)};
                    export const UI = ${JSON.stringify(UI)};
                    export const ANALYTICS = ${JSON.stringify(ANALYTICS)};
                    `;
                  }
                },
              },
            ],
          },
        });

        if (typeof _themeConfig === 'string') {
          addWatchFile(new URL(_themeConfig, config.root));

          buildLogger.info(`Astrowind \`${_themeConfig}\` has been loaded.`);
        } else {
          buildLogger.info(`Astrowind config has been loaded.`);
        }
      },
      'astro:config:done': async ({ config }) => {
        cfg = config;
      },

      'astro:build:done': async ({ logger }) => {
        // Fail closed: the public sitemap and robots must be real build artifacts.
        const sitemapFile = new URL('sitemap-0.xml', cfg.outDir);
        if (!cfg.site || !fs.existsSync(sitemapFile)) throw new Error('Sitemap integration did not produce a sitemap');
        const sitemap = fs.readFileSync(sitemapFile, 'utf8');
        if (!sitemap.includes('<urlset') || !sitemap.includes(new URL('/', cfg.site).href))
          throw new Error('Invalid sitemap output');
        fs.writeFileSync(new URL('sitemap.xml', cfg.outDir), sitemap);
        fs.writeFileSync(
          new URL('robots.txt', cfg.outDir),
          [
            'User-agent: *',
            'Allow: /',
            'Disallow: /jobs',
            'Disallow: /api/',
            'Disallow: /404.html',
            '',
            `Sitemap: ${new URL('sitemap.xml', cfg.site).href}`,
            '',
          ].join('\n')
        );
        logger.info('Verified sitemap.xml and generated robots.txt');
      },
    },
  };
};
