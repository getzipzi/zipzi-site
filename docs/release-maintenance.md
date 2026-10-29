# Release maintenance

The product and website are separate repositories. The product source is **public** `getzipzi/zipzi-2d`; this website repository remains private.

All three download buttons link to `https://github.com/getzipzi/zipzi-2d/releases`. That page owns version selection, package availability, platform requirements, checksums and release notes. A new product release requires no website update.

Keep the website independent of release cadence: do not add a pinned tag, release date, package list, binary URL, release snapshot or `softwareVersion` to public HTML or structured data. Generated-artifact regression tests reject these patterns. Alpha maturity and the Windows development-prototype caveat are retained as product context, not as a claim about a specific release.

The user explicitly chose **manual website deployment**. Do not provision a deployment account, SSH key, GitHub secret, GitHub App, release polling or cross-repository trigger as part of routine website work. Website builds require no access to product releases.

When product positioning, capabilities, maturity or branding changes, review the current default-branch README and linked editor/SDK guides at a recorded commit. Verify source assets and anonymous access before updating copy or images. Record asset provenance in `docs/assets.md`; do not imply complete platform parity or unverified signing, notarization or package availability.

See GitHub's official [release-link documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). Updating a website link does not change repository visibility or distribution rights.
