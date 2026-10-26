# Zipzi 2D website

The Simplified Chinese product website for Zipzi 2D, a 2D modeling and animation tool with a native editor, a Rust core, and a Python SDK. This repository contains the website, not the editor source.

The site uses a dark blue and purple palette, a real editor screenshot, and a small dependency-free static build. All styles, scripts, and images are served locally, with system font fallbacks and no analytics or external runtime services.

## Current release

The verified product release is **Zipzi Editor v0.1.0-alpha.1**, published on October 26, 2026 in [`getzipzi/zipzi-2d`](https://github.com/getzipzi/zipzi-2d/releases/tag/v0.1.0-alpha.1). It includes macOS Apple Silicon DMG and ZIP packages, a source archive, and SHA256 checksums. The app is ad hoc signed and is not Apple-notarized. This is an early testing release; APIs and project formats may change.

**The product repository is private.** Release links require repository access and return 404 for ordinary visitors. This website makes that restriction explicit. It does not rehost binaries, imply a public download, or claim Intel Mac or Windows packages. The proposed `getzipzi/zipzi` repository could not be verified with the existing account; it is not used as a download destination.

## Development

Use Node.js **24.12.0**. Python 3 is only needed for the optional preview server. There are no npm dependencies to install.

```sh
npm run lint
npm run build
npm test
npm run package
npm run preview
```

Preview: `http://127.0.0.1:4173`. The build writes content-addressed files to `dist/` and checksums to `qa/build-manifest.json`. Packaging creates `artifact/`, containing the static site, manifest, checksums, and deployment notice. Build output is deterministic for the same source and Node version.

## Updating release information

The page is built from the reviewed snapshot in `src/release.json`. It does not call GitHub from visitors' browsers or require a GitHub token at build time.

Using a maintainer's existing GitHub CLI login:

```sh
npm run release:check
# Or inspect a particular published version:
npm run release:check -- v0.1.0-alpha.1
```

This writes **only** `qa/release-candidate.json`. Compare it with the actual release notes, review visibility, platform and signing, then update `src/release.json` explicitly. A new candidate has no review approval and cannot be rendered unchanged. Update page wording and presentation if a later release changes platform support, maturity, signing, or access. Run the checks above, review the diff, and commit to this website repository.

The “all releases” link always points to the product repository's release list, including future prereleases. Current download links are pinned to a verified tag. A `/releases/latest/download/...` shortcut is unsuitable here: this is a prerelease and the asset filenames contain the version. See [release maintenance](docs/release-maintenance.md) for the automation options.

## CI and deployment

[Website CI](.github/workflows/ci.yml) runs on pushes to `main`, pull requests, and manual dispatch. It lints, builds, tests, checks reproducibility, and uploads a checksum-verified artifact named for the source commit. Official actions are pinned to commit SHAs, the job has read-only repository permissions, and stale runs for the same ref are cancelled. A failed check prevents artifact publication.

**CI currently builds and validates; it does not have production credentials.** Production updates use the existing authorized SSH deployment process after CI passes. The server also hosts other applications, so `dist/` must never be copied over the entire document root. Read [deployment and rollback](docs/deployment.md) before deploying.

The current website is [https://clwai.cn/](https://clwai.cn/). Its ICP record applies to `clwai.cn`, not to `zipzi2d.com`. Moving domains requires the new domain's filing, DNS, and valid HTTPS to be ready.

## Source layout

- `src/index.html`: Chinese copy, navigation, product sections, FAQ, and release placeholder.
- `src/release.json`: reviewed product release metadata and asset checksums.
- `src/assets/`: responsive styles, mobile navigation, favicon, and authentic editor screenshot.
- `scripts/`: dependency-free build, validation, release metadata check, packaging, and tests.
- `.github/workflows/ci.yml`: GitHub Actions checks and artifact generation.
- `docs/`: production deployment and release maintenance instructions.

The screenshot shows an internal geometric test scene in the real editor, with no third-party character model. It is labeled as a development build and retains the older `.kasane` filename. The Python example is an excerpt from the product SDK documentation, with runtime/session initialization omitted. No customer counts, testimonials, or unsupported platforms are claimed.

Deployment credentials, environment-specific adapters, private backups, logs, local QA evidence, and generated artifacts are excluded from Git. Do not add them to this repository.
