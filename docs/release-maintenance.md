# Release maintenance

The product and website are separate repositories. The verified release source is the private `getzipzi/zipzi-2d` repository. Website builds read a reviewed metadata snapshot and require no cross-repository credentials.

The user explicitly chose **manual website deployment**. Do not provision a deployment account, SSH key, GitHub secret, GitHub App, or cross-repository trigger as part of routine website work.

The “all releases” link automatically shows the repository's release list to authorized visitors, but the website's version and asset links remain a reviewed snapshot. This is not automatic release synchronization. Use `npm run release:check` with the maintainer's existing `gh` session to prepare metadata for review, then commit approved changes to this repository.

A fixed `latest` URL has not been supplied. Do not derive one from versioned filenames or assume a private prerelease is a public download. Once the owner provides the exact address, verify anonymous access, the actual platform/package, redirects, and content type before updating the site. Stable links can avoid redeployment for future package updates if the website itself is unchanged.

See GitHub's official [release-link documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). Changing a website link does not change repository visibility or distribution rights.
