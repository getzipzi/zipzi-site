# Release maintenance

The product and website are separate public repositories: `getzipzi/zipzi-2d` and `getzipzi/zipzi-site`.

All three download buttons link to `https://github.com/getzipzi/zipzi-2d/releases`. That page owns version selection, package availability, platform requirements, checksums and release notes. A new product release requires no website update.

Keep the website independent of release cadence: do not add a pinned tag, release date, package list, binary URL, release snapshot or `softwareVersion` to public HTML or structured data. Generated-artifact regression tests reject these patterns. Alpha maturity and the Windows development-prototype caveat are retained as product context, not as a claim about a specific release.

Website deployment follows successful website `main` pushes through its approved production environment. Product releases do not trigger website builds or deployments, and website builds require no access to product releases. Do not provision accounts, keys, secrets, permissions or cross-repository triggers as part of routine content changes. See [deployment configuration and recovery](deployment.md).

When product positioning, capabilities, maturity or branding changes, review the current default-branch README and linked editor/SDK guides at a recorded commit. Verify source assets and anonymous access before updating copy or images. Record asset provenance in `docs/assets.md`; do not imply complete platform parity or unverified signing, notarization or package availability.

See GitHub's official [release-link documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). Updating a website link does not change repository visibility or distribution rights.
