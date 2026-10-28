# Deployment and rollback

## Scope

The current canonical website is `https://clwai.cn`. The existing host also serves an authenticated jobs application and API and runs OpenClaw. This is a static website deployment, not a server replacement. Do not change DNS, certificates, firewall rules, credentials, service permissions, or the new domain's filing.

Deployment remains manual through the existing authorized SSH connection. No production credential is stored in this repository or its GitHub Actions configuration. The user declined full deployment automation.

## Release prerequisites

1. Confirm the intended commit is in the private `getzipzi/zipzi-site` repository and its exact-commit CI run succeeds.
2. Use its CI artifact, or reproduce it with the pinned Node version and `npm ci --ignore-scripts`. Run all source, generated-output, and browser checks.
3. Verify the manifest, `SHA256SUMS`, source revision, and publication audit. The build may contain only public site assets, not deployment configuration, logs, backups, source files, or credentials.
4. Independently review desktop/mobile screenshots and the proposed environment-specific Nginx diff. Local test-server behavior is not proof of production Nginx behavior.

## Required production routing

The prior public location used an SPA fallback. Consequently robots, sitemap, and nonexistent pages returned the homepage with status 200. The replacement must:

- Serve `/robots.txt` as plain text and the generated sitemap files as XML, with no homepage fallback.
- Resolve public static files/directories and return a real 404 with the custom error page otherwise.
- Redirect public HTTPS `www` page requests to the canonical apex while preserving path/query. Keep API and authenticated jobs host behavior unchanged.
- Serve Astro's hashed `/_astro/` assets as static immutable resources. Retain the original `/assets/` location and all legacy files.
- Preserve `/jobs` authentication and its SPA routing with a separate, server-internal legacy entry document outside the public website root. The internal entry must use the same authentication directives and reject direct public requests. It must not load the new site's JavaScript. Verify the original entry and legacy asset hashes before using them.
- Leave API proxy, admin authentication, TLS and OpenClaw unchanged.

The exact server paths, configuration diff, legacy entry, and deployment transaction are operator records excluded from Git. Review and test the full configuration with `nginx -t` before applying it.

## Transaction and rollback

Acquire an exclusive deployment lock and verify the expected hostname, document root, current homepage hash, and relevant configuration hashes. Record HTTP/authentication/API/service/listener baselines.

Create a unique private backup outside every public root. Copy the current site and relevant configuration, archive them, extract the archive into a private restore-check directory, and compare before changing production. Never transmit existing private keys or authentication files to the developer machine.

Validate archive paths, file types and checksums. Stage new files and the protected legacy entry. Retain existing assets, and require matching bytes if a content-addressed name already exists. Install metadata/error files and assets before switching the homepage. Apply only the reviewed Nginx diff, test it, then perform a graceful reload. Atomically rename the homepage within its directory. A failure after a switch must restore the saved homepage and configuration, verify them, and gracefully reload if needed.

After deployment, use strict HTTPS to check both hostnames, canonical redirects, every manifest file, robots/sitemap MIME and contents, genuine 404 statuses, rejected direct access to the internal jobs entry, unchanged jobs/admin authentication, API health, and service/listener state. Validate certificate trust, names, and dates without bypassing errors. If authorized credentials are available, also exercise the jobs app; never claim that a 401 check proves its authenticated UI works.

The rollback procedure uses the same lock and expected-current-version checks, atomically restores the previous entry/configuration, and repeats those regressions. Keep old assets and private backups; do not clean the shared root with `rsync --delete` or remove unrelated services. Do not restore unrelated system files for a website-only rollback.
