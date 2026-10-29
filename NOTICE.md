# Attribution and provenance

This website is based on **AstroWind**, by onWidget and its contributors, distributed under the MIT License reproduced verbatim in `LICENSE.md`.

- Reviewed upstream: https://github.com/arthelokyo/astrowind
- Release: `v1.0.0-beta.65`
- Source commit: `8d0090f933b71439c02956f7e8d30d41de804832`
- Retrieved source archive SHA256: `a60c19dc553cccbc0da910754679a41aaac5c65f303276f6a21385e67046353d`

The upstream Astro layouts, Hero, WidgetWrapper, Headline, configuration integration, metadata component, Tailwind theme approach, and lint/format configuration are adapted for Zipzi. Changes include a smaller static-only feature set, local product assets, Chinese product copy, accessible navigation, explicit SEO configuration, build-failing sitemap validation, and generated-output/browser tests. Blog, CMS, embed, analytics, view-transition, third-party image, and remote font features are removed.

The original MIT copyright notice retains the historical onWidget name as required. No scripts or resources are loaded from the old repository namespace.

The editor screenshot and app icon are reused from the user's Zipzi project at the owner's request. The screenshot shows the Cat model from the product README; it is not the earlier geometric test scene. The website uses the editor asset directory's v3 PNG consistently for navigation and browser icons. Exact source commits, paths, hashes and derivations are recorded in `docs/assets.md`; product artwork and trademarks retain their respective rights. No upstream example photographs or illustrations are included. System fonts are used; no third-party font files are distributed. Package licenses remain governed by their respective authors and are recorded in the npm lockfile.

## Dependency security updates

The template source remains pinned to the commit above. The inherited dependency graph was audited during the October 28, 2026 rewrite. Official-registry fixes are locked in this repository: Astro 7.4.3, js-yaml 4.3.2, Sharp 0.35.5, and compatible transitive fixes. No force upgrade or dependency lifecycle script was used. The final npm audit reported zero known vulnerabilities; future advisories may change that result.
