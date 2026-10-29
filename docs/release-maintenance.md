# Release maintenance

The product and website are separate repositories. The product source is **public** `getzipzi/zipzi-2d`; this website repository remains private. Builds read a reviewed metadata snapshot and require no cross-repository credentials.

The user explicitly chose **manual website deployment**. Do not provision a deployment account, SSH key, GitHub secret, GitHub App, or cross-repository trigger as part of routine website work.

All download buttons link to `https://github.com/getzipzi/zipzi-2d/releases`, as requested. This stable page lets visitors choose the current release and platform without a website deployment each time a product release is published. Do not replace it with versioned binaries or inferred `latest/download` addresses.

The website's displayed version, capabilities and platform limitations remain a manually reviewed snapshot. Use `npm run release:check` with the maintainer's existing `gh` session to prepare metadata for review, then inspect the default-branch README and linked editor/SDK guides at a recorded commit. Verify public access without credentials, release assets, development status and platform caveats before updating the snapshot and copy. This is not automatic release synchronization.

The October 29, 2026 review used product README commit `1b4e9f66903c9d83b82f51838408146fad06c643` and release `v0.1.0-alpha.2`. macOS Apple Silicon and Windows x86_64 artifacts exist; Windows is a development prototype and no stable release is available. Do not carry older signing, notarization or distribution claims forward without new evidence.

See GitHub's official [release-link documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). Updating a website link does not change repository visibility or distribution rights.
