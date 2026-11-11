# Product asset provenance

Repository: `getzipzi/zipzi-2d` (public). Reviewed default-branch commit: **`1b4e9f66903c9d83b82f51838408146fad06c643`**. Assets are reused for the website at the owner's explicit request. No product source or packaging configuration is changed.

## Editor screenshot

- Source: [`docs/editor-screenshot.png`](https://github.com/getzipzi/zipzi-2d/blob/1b4e9f66903c9d83b82f51838408146fad06c643/docs/editor-screenshot.png), the image referenced by the root README.
- Git blob: `73ce599ffb04a878cd5368c7c3324f11b3e87443`.
- Original: 2204 × 1486 PNG; SHA256 `c053ba12bbb4af898836a318d3f8fddd85d07862637289ccb6b470db677cbee8`.
- Exact original retained at `src/assets/images/editor-screenshot.png`.
- The actual pixels show the Cat model, ear mesh, layers and parameter/property panels. This is a real editor capture, not the previous geometric test scene or a recreated UI.
- Astro generates WebP variants at 640, 960, 1440 and 2204 pixels, quality 90, without cropping. `public/media/editor-screenshot.jpg` preserves the full resolution at JPEG quality 92 for the full-size link and Open Graph/Twitter metadata. No artwork or UI content is altered.

## Brand SVG and browser icons

- Source: `crates/zipzi-editor/assets/branding/zipzi-logo.svg` in the local `zipzi-2d` working tree based on commit `2a836ef534cdcec8e4db5035a4e832e5d7b176d7`. The source included uncommitted logo refinements at the time of synchronization; SHA256 `62922fc28d329a1b922474e17f034bb035cd6b752981022d66d394054654e27c`.
- Website source: `src/assets/images/app-icon.svg`, SHA256 `62a7878bdf71802084d2eb4a042f57f07980d9268970fd92a3ef50228c434cf2`. The XML prolog and external DTD are removed, and dimensions are made explicit for rasterization; the viewBox and artwork are preserved.
- Navigation and footer share the SVG as `#zipzi-brand-artwork`. `public/favicon.png` (96 pixels) and `public/apple-touch-icon.png` (180 pixels) are rendered from the same SVG with Sharp. Regression checks verify the artwork and raster outputs.

The screenshot and logo retain their source artwork and ownership. The website's MIT template license does not grant independent rights to model artwork or trademarks shown in product images. No upstream template stock images or third-party font files are included.

## Official wordmark

- Source: [`crates/zipzi-editor/assets/branding/zipzi-wordmark.svg`](https://github.com/getzipzi/zipzi-2d/blob/2595b0d1e0ff49873a5181dfbf3bb7475bd03d89/crates/zipzi-editor/assets/branding/zipzi-wordmark.svg).
- Exact product source retained at `src/assets/images/wordmark.svg`, SHA256 `0e15e34777200c395fcb08bf0f1a63f3b3484863e69e84514b903a0fb73dd446`.
- Navigation and footer use its original paths and `0 0 720 310` viewBox through `BrandWordmark.astro`. Only black ink becomes `currentColor` for the dark theme; letter shapes and spacing are preserved. The accessible link name remains Zipzi 2D.
- This artwork belongs to the GPL-3.0-only editor assets; its inclusion is authorized by the product owner. The website template's MIT license does not relicense the wordmark.
