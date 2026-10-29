# Product asset provenance

Repository: `getzipzi/zipzi-2d` (public). Reviewed default-branch commit: **`1b4e9f66903c9d83b82f51838408146fad06c643`**. Assets are reused for the website at the owner's explicit request. No product source, packaging configuration or GitHub organization avatar is changed.

## Editor screenshot

- Source: [`docs/editor-screenshot.png`](https://github.com/getzipzi/zipzi-2d/blob/1b4e9f66903c9d83b82f51838408146fad06c643/docs/editor-screenshot.png), the image referenced by the root README.
- Git blob: `73ce599ffb04a878cd5368c7c3324f11b3e87443`.
- Original: 2204 × 1486 PNG; SHA256 `c053ba12bbb4af898836a318d3f8fddd85d07862637289ccb6b470db677cbee8`.
- Exact original retained at `src/assets/images/editor-screenshot.png`.
- The actual pixels show the Cat model, ear mesh, layers and parameter/property panels. This is a real editor capture, not the previous geometric test scene or a recreated UI.
- Astro generates WebP variants at 640, 960, 1440 and 2204 pixels, quality 90, without cropping. `public/media/editor-screenshot.jpg` preserves the full resolution at JPEG quality 92 for the full-size link and Open Graph/Twitter metadata. No artwork or UI content is altered.

## Brand SVG and browser icons

- Correct source: [`crates/zipzi-editor/assets/app-icons/zipzi-editor-icon.svg`](https://github.com/getzipzi/zipzi-2d/blob/1b4e9f66903c9d83b82f51838408146fad06c643/crates/zipzi-editor/assets/app-icons/zipzi-editor-icon.svg).
- Git blob: `f163c6a3b6ee32497a524ddefa3a57e23c5625c8`.
- Upstream SVG SHA256: `48d36d83367e706883d2bbd340542271e6edac8c60ebecff84bfbf009ebd3072`; viewBox `0 0 1024 1024`.
- The product tree contains one app-brand SVG; the other SVGs are editor toolbar controls. The macOS packaging script uses `zipzi-editor-icon-vector.icns`, consistent with this artwork. The README describes the product and links the editor screenshot; it does not select the unrelated v3 PNG as the brand source.
- The actual artwork was rendered and inspected: a teal-haired face under a pale pink form with visible mesh nodes, on a rounded blue tile. The source combines vector shapes with a self-contained embedded PNG; it is not represented as entirely vector paths.
- Website source: `src/assets/images/app-icon.svg`, SHA256 `2079d9e1927ea63d6d5a026e6bb6a264b4252cd24b7ec4b09e78be0603fa02dd`. Only the XML prolog and external SVG DTD declaration are removed. Paths, gradient, clip, embedded image and styling are preserved without redrawing.
- The SVG is included once per HTML document as `#zipzi-brand-artwork`. Navigation and footer render it using native SVG `use` references. This preserves one set of unique IDs and avoids duplicating its embedded image within a page. No external logo request or server routing change is required.
- `public/favicon.png` (96 pixels) and `public/apple-touch-icon.png` (180 pixels) are rendered directly from this SVG with the locked Sharp dependency. The incorrect `app-icon.png` source is removed. The editor screenshot and social preview remain unchanged.
- Regression checks verify the source hash, self-contained SVG references, absence of scripts/event handlers/external resources, exact symbol content, both brand instances and SVG-derived raster bytes. Older v3 artwork must not return as a logo source.

The screenshot and app icon retain their source artwork and ownership. The website's MIT template license does not grant independent rights to model artwork or trademarks shown in product images. No upstream template stock images or third-party font files are included.
