# Zipzi 2D website

A Simplified Chinese product website for Zipzi 2D, a 2D modeling and animation tool with a desktop editor, a Rust SDK, and a Python SDK. macOS and a Windows development prototype are available; the Python client supports programmatic work and collaboration with AI agents. This is the website repository, separate from the product implementation.

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
npx playwright install chromium
npm run test:browser
npm run package
npm run audit:publication
```

On a Linux CI runner, `npx playwright install --with-deps chromium` installs the browser's OS dependencies. Local browser tests use a fresh headless Chromium context and a localhost artifact server; they do not control an existing desktop browser. Set `PLAYWRIGHT_BROWSERS_PATH` to a private temporary directory to keep downloaded browser binaries out of your normal browser installation.

`npm run preview` previews Astro's static build. The browser regression suite instead starts `tooling/serve.mjs`, which deliberately returns genuine 404 responses rather than an SPA fallback. This test server is not deployed to production.

## Configuration and product information

`src/config.yaml` owns the production origin, site metadata, language, and crawl policy. The current canonical origin is **https://clwai.cn**. The metadata component derives canonical, Open Graph, and Twitter URLs from that configuration. The sitemap integration writes canonical public URLs; the adapted build hook requires a valid sitemap and emits `sitemap.xml` and `robots.txt`. A missing sitemap fails the build. The 404 page has explicit `noindex`.

The site contains only a homepage and an error page. There are no example blog, legal, pricing, customer, or CMS pages. Structured data describes the verified software and website without ratings, offers, or fabricated metrics. The platform description explicitly identifies Windows as a development prototype.

The screenshot is a real development editor showing a built-in geometric test scene. It is clearly labeled and retains historical `.kasane` naming where visible. The app icon is the original asset supplied from the Zipzi project. No upstream stock photography, remote fonts, analytics, external scripts, or runtime API calls are shipped. System fonts are used.

## Release links

Product copy was reviewed against the default-branch [README at commit `1b4e9f66903c9d83b82f51838408146fad06c643`](https://github.com/getzipzi/zipzi-2d/blob/1b4e9f66903c9d83b82f51838408146fad06c643/README.md), plus its editor and Python SDK guides. The reviewed release snapshot in `src/data/release.json` is **v0.1.0-alpha.2**, published October 28, 2026. The product repository is now public; anonymous requests to its project, Releases, and release-tag pages returned HTTP 200 on October 29, 2026. This website repository remains private.

The release provides macOS Apple Silicon and Windows x86_64 editor packages, Python packages, source archives, and checksums. Windows remains a development prototype with desktop validation in progress. There is no stable release, and APIs and file formats may change. The website does not promise Intel Mac builds, platform parity, signing/notarization, or PyPI availability that has not been independently verified.

Every download call to action goes directly to **https://github.com/getzipzi/zipzi-2d/releases**. No button links to a version-specific binary or guessed `latest` asset. The accessible GitHub icon next to the upper-left brand links to the product repository. Product binaries are neither copied nor rehosted.

A maintainer can inspect newer metadata through an existing GitHub CLI session:

```sh
npm run release:check
npm run release:check -- v0.1.0-alpha.2
```

This only writes `qa/release-candidate.json`. Review README provenance, release notes, assets, platform limitations, and anonymous access before updating the committed snapshot and copy. The stable Releases URL exposes new releases without a website redeployment; version-specific website copy remains a manually reviewed snapshot. There is no cross-repository trigger, GitHub App, new deployment key, or automatic production deployment. See [release maintenance](docs/release-maintenance.md).

## What the checks cover

- Astro/TypeScript diagnostics, ESLint, and Prettier.
- Parsed generated HTML metadata, canonical URLs, unique IDs, every local link and responsive image, release/platform disclosures, download destinations, and structured data.
- XML-parsed sitemaps, actual robots content, error-page output, integrity manifests, and resource budgets.
- Headless Chromium at 1440, 390, and 320 pixels: real HTTP statuses and MIME types, runtime errors, missing images, horizontal overflow, keyboard navigation, Escape, mobile menu, native FAQ, reduced motion, and no-JavaScript fallback.
- Axe WCAG A/AA checks on the homepage, expanded mobile navigation, and 404. Automated accessibility checks complement manual review; they do not prove complete accessibility compliance.
- Publication scanning of source and output for credential signatures, symlinks, and private operational paths. Matches report filenames and categories, never secret values.

CI executes these checks against the generated site and verifies repeatable builds. Only a successful run publishes the checksum-verified site artifact. Browser evidence is a separate short-lived CI artifact.

## Output and deployment

`dist/` contains only public static files. `qa/build-manifest.json` records every output file's size and SHA256. `artifact/` contains the site, manifest, checksums, and source revision metadata. A dirty local build is identified as such.

Production shares a server with an authenticated jobs application, an API, and OpenClaw. The static website must not replace the whole document root. The reviewed deployment must preserve those applications and install precise Nginx routing for public files, canonical redirects, and real 404s. See [deployment and rollback](docs/deployment.md).

The existing ICP footer applies to `clwai.cn`, not `zipzi2d.com`. A future domain switch requires the new domain's filing, DNS, and valid HTTPS to be ready. Search Console access and search-engine indexing are separate from this website build.

Credentials, environment-specific configuration, deployment scripts, logs, backups, screenshots, browser profiles, and generated archives stay outside Git and the public build. The repository uses an allowlist `.gitignore`; publish source archives from an audited Git revision rather than zipping the working directory.
