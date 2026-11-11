# Zipzi 2D website

A multilingual product website with an English main homepage for Zipzi 2D, a 2D modeling and animation tool with a desktop editor, a Rust SDK, and a Python SDK. macOS and a Windows development prototype are available; the Python client supports programmatic work and collaboration with AI agents. This is the website repository, separate from the product implementation.

The site is a static Astro project adapted from [AstroWind](https://github.com/arthelokyo/astrowind) **v1.0.0-beta.65**, pinned to `8d0090f933b71439c02956f7e8d30d41de804832`. See [NOTICE.md](NOTICE.md) for provenance and modifications, and [LICENSE.md](LICENSE.md) for the original MIT license.

## Local development

Use **Node 24.16.0** and npm. This version satisfies the pinned Astro and ESLint dependencies; Node 24.12.0 is too old for the template's Astro lint plugins. The complete dependency graph is committed in `package-lock.json`. Security fixes update the inherited baseline to Astro 7.4.3, js-yaml 4.3.2, Sharp 0.35.5, and compatible transitive versions; provenance remains recorded in NOTICE. Install only from the official npm registry; dependency lifecycle scripts are not required by this build.

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run dev
```

The dev server binds to localhost. For a production build and verification:

```sh
npm run check
npm run lint
npm run build
npm test
npm run test:deploy
npx playwright install chromium
npm run test:browser
npm run package
npm run audit:publication
```

On a Linux CI runner, `npx playwright install --with-deps chromium` installs the browser's OS dependencies. Local browser tests use a fresh headless Chromium context and a localhost artifact server; they do not control an existing desktop browser. Set `PLAYWRIGHT_BROWSERS_PATH` to a private temporary directory to keep downloaded browser binaries out of your normal browser installation.

`npm run preview` previews Astro's static build. The browser regression suite instead starts `tooling/serve.mjs`, which deliberately returns genuine 404 responses rather than an SPA fallback. This test server is not deployed to production.

## Configuration and product information

`src/config.yaml` owns the production origin, site metadata, language, and crawl policy. The current canonical origin is **https://zipzi2d.com**. The metadata component derives canonical, Open Graph, and Twitter URLs from that configuration. The sitemap integration writes canonical public URLs; the adapted build hook requires a valid sitemap and emits `sitemap.xml` and `robots.txt`. A missing sitemap fails the build. The 404 page has explicit `noindex`.

Homepage browser titles explain the product: **Zipzi 2D — 开源二维建模与动画 | Live2D Cubism Editor 替代品** in Simplified Chinese and **Zipzi 2D — Open Source Live2D Cubism Editor Alternative** in English, with Japanese, Traditional Chinese and Korean equivalents. Custom public page titles include Zipzi 2D through the shared title template, and Open Graph/Twitter titles match the browser title. The product brand and `site.name` remain Zipzi 2D.

Each language has a homepage and an error page. There are no example blog, legal, pricing, customer, or CMS pages. Structured data describes the verified software, source repository, component licensing and website without ratings, offers, or fabricated metrics. The platform description explicitly identifies Windows as a development prototype.

The homepage uses the real Cat-model editor screenshot linked by the product README. Its full 2204 × 1486 frame is preserved, with responsive WebP images and a high-quality JPEG for the full-size link and social previews. Navigation and footer use the current `zipzi-logo.svg` artwork from the editor branding assets as a shared inline SVG; favicon and Apple touch icon are rendered from that same source. See [asset provenance](docs/assets.md) for exact source paths, hashes, selection notes and optimization details. No stock photography, remote fonts, analytics, external scripts or runtime API calls are shipped. System fonts are used.

## Product and release maintenance

Product copy and assets were reviewed at default-branch [commit `1b4e9f66903c9d83b82f51838408146fad06c643`](https://github.com/getzipzi/zipzi-2d/tree/1b4e9f66903c9d83b82f51838408146fad06c643), including the root README and editor/Python SDK guides. Both the product and website repositories are public by the owner's choice.

Every download call to action goes directly to **https://github.com/getzipzi/zipzi-2d/releases**. The GitHub text link sits with the navigation on the right and links to the product repository; mobile users find it in the navigation menu. Product binaries are neither copied nor rehosted.

The website intentionally contains no release snapshot, fixed release version, publication date, package inventory or `softwareVersion` structured-data field. Alpha maturity and the Windows development-prototype caveat remain useful product context. Release selection, downloads, exact platform requirements and release notes belong on GitHub, so publishing a new build does not require a website edit.

There is no release API fetch, synchronization command, cross-repository trigger or GitHub App. Update the website only when its product information, branding or design changes. Successful pushes to this website's main branch deploy the verified static artifact through the approved production environment. Product releases do not trigger website deployment. See [release maintenance](docs/release-maintenance.md).

## What the checks cover

- Astro/TypeScript diagnostics, ESLint, and Prettier.
- Parsed generated HTML metadata, canonical URLs, unique IDs, every local link and responsive image, product maturity, stable download destinations, absence of pinned release metadata, and structured data.
- XML-parsed sitemaps, actual robots content, error-page output, integrity manifests, and resource budgets.
- Headless Chromium at 1440, 390, and 320 pixels: real HTTP statuses and MIME types, runtime errors, missing images, horizontal overflow, keyboard navigation, Escape, mobile menu, native FAQ, reduced motion, and no-JavaScript fallback.
- Axe WCAG A/AA checks on the homepage, expanded mobile navigation, and 404. Automated accessibility checks complement manual review; they do not prove complete accessibility compliance.
- Publication scanning of source and output for credential signatures, symlinks, and private operational paths. Matches report filenames and categories, never secret values.
- Offline deployment tests with real temporary files: archive validation, path and symlink rejection, protected legacy files, permission checks, concurrent transactions, interrupted writes and health-failure rollback. CI repeats these tests as root inside its disposable runner; no production connection is involved.

CI executes these checks against the generated site and verifies repeatable builds. Only a successful run publishes the checksum-verified site artifact. Browser evidence is a separate short-lived CI artifact. Production deployment requires a successful verification job, a push to this repository's `main` branch and explicit enablement. PRs, forks, manual CI runs and product releases cannot use the deployment job. A skipped job means nothing was deployed.

## Output and deployment

`dist/` contains only public static files. `qa/build-manifest.json` records every output file's size and SHA256. `artifact/` contains the site, manifest, checksums, and source revision metadata. A dirty local build is identified as such.

Production shares a server with an authenticated jobs application and an API. The static website must not replace the whole document root. The approved routing isolates the legacy jobs entry outside the public root while preserving authentication. The CI receiver verifies this configuration and never changes Nginx, services or credentials. Further routing or access changes are separate operator work. See [deployment and rollback](docs/deployment.md).

The approved production domain is `zipzi2d.com`, with ICP filing 浙ICP备2026015551号-2. The `www` host and legacy website URLs redirect to the apex while legacy jobs/API services remain on `clwai.cn`. Search Console access and search-engine indexing are separate from this website build.

Generic deployment source and offline tests are reviewed in Git. Credentials, environment-specific configuration, operator scripts, logs, backups, screenshots, browser profiles and generated archives stay outside Git and the public build. The repository uses an allowlist `.gitignore`; publish source archives from an audited Git revision rather than zipping the working directory.

## Promotion and SEO

All five languages share the open-source Live2D Cubism Editor alternative positioning, with localized titles, descriptions, H1s and social metadata. Homepage canonical URLs, reciprocal hreflang, sitemap and noindex error pages remain generated from the production origin. Each sitemap entry also declares all five language alternatives, using the same language registry as the page metadata. Open Graph declares the four other supported locales. Software/source-code structured data links to the actual repository and component licensing rather than assigning one license to the whole project; each localized WebPage links to its website and software entities.

The hero explains 2D modeling, deformation and keyframe animation and displays the editor/SDK licenses next to the download action. The open-source section explains how the GPL-3.0-only editor and MIT SDK let creators inspect, modify and integrate their tools. The FAQ clarifies that using Zipzi itself does not require purchasing Cubism Editor, while preserving Alpha maturity, component license obligations and the limits of Cubism migration claims. It does not promise feature parity, file/runtime compatibility, or unrestricted third-party assets. Navigation and footer pair the existing app icon with the official product SVG wordmark; see the asset provenance record.

## Visual design

The site uses a white and soft gray palette with violet accents, a centered functional headline and a full-frame editor showcase. The editor showcase leads into open-source licensing, AI collaboration, Alpha downloads and an accessible FAQ. The five locales share the same responsive layout and light theme, including navigation, collaboration examples and error pages.

The AI collaboration section explains a creator-led workflow (describe, review, keep or undo) with a mesh-naming example. Setup requirements are summarized in plain language; detailed SDK and runtime instructions belong in the product documentation. Downloads and FAQs focus on independent open-source creation, applicable licensing and Alpha readiness. The hero and browser title lead with Zipzi 2D.

English is the main site at `/`. Simplified Chinese uses `/zh-cn/`; Japanese, Traditional Chinese and Korean retain their existing paths. `/en/` redirects to `/`, preserving query and fragment when JavaScript is available. The sitemap excludes this legacy redirect; all five languages use English as the x-default. The deployment protocol accepts the new Chinese pages while keeping earlier localized releases valid for rollback.
