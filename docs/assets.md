# Product asset provenance

Repository: `getzipzi/zipzi-2d` (public). Reviewed default-branch commit: **`1b4e9f66903c9d83b82f51838408146fad06c643`**. Assets are reused for the website at the owner's explicit request. No product source, packaging configuration or GitHub organization avatar is changed.

## Editor screenshot

- Source: [`docs/editor-screenshot.png`](https://github.com/getzipzi/zipzi-2d/blob/1b4e9f66903c9d83b82f51838408146fad06c643/docs/editor-screenshot.png), the image referenced by the root README.
- Git blob: `73ce599ffb04a878cd5368c7c3324f11b3e87443`.
- Original: 2204 × 1486 PNG; SHA256 `c053ba12bbb4af898836a318d3f8fddd85d07862637289ccb6b470db677cbee8`.
- Exact original retained at `src/assets/images/editor-screenshot.png`.
- The actual pixels show the Cat model, ear mesh, layers and parameter/property panels. This is a real editor capture, not the previous geometric test scene or a recreated UI.
- Astro generates WebP variants at 640, 960, 1440 and 2204 pixels, quality 90, without cropping. `public/media/editor-screenshot.jpg` preserves the full resolution at JPEG quality 92 for the full-size link and Open Graph/Twitter metadata. No artwork or UI content is altered.

## App icon

- Selected source: [`crates/zipzi-editor/assets/app-icons/zipzi-editor-icon-v3.png`](https://github.com/getzipzi/zipzi-2d/blob/1b4e9f66903c9d83b82f51838408146fad06c643/crates/zipzi-editor/assets/app-icons/zipzi-editor-icon-v3.png).
- Git blob: `0fd45929bf1450dde4cb75b1f527a4902a4fafc1`.
- Original: 1024 × 1024 PNG; SHA256 `2e9cc75c2fd938755f056e69d0d05621126fd1dbe2736d422aabcc5315f3add9`.
- Exact original retained at `src/assets/images/app-icon.png`; the header uses an optimized WebP. The 96-pixel favicon and 180-pixel Apple touch icon are resized from this same source.
- Both v3 and SVG/vector candidates were visually inspected. The SVG/vector artwork matches the old website icon; v3 supplies the full app-tile composition selected for this requested website refresh. The product's macOS packaging script still references `zipzi-editor-icon-vector.icns`, and Windows resources reference `zipzi-editor.ico`. We do not claim that v3 is the current default packaging icon or alter either product configuration.

The screenshot and app icon retain their source artwork and ownership. The website's MIT template license does not grant independent rights to model artwork or trademarks shown in product images. No upstream template stock images or third-party font files are included.
