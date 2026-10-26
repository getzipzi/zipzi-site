# Deployment and rollback

## Boundaries

Production is the existing `clwai.cn` virtual host. It shares a server with an authenticated jobs application, an API, and OpenClaw. Its document root is an existing directory, not an isolated disposable website. Preserve its assets, routes, authentication, services, TLS, and ICP footer. Do not replace the entire directory, run `rsync --delete`, restart unrelated services, or change DNS, firewall rules, certificates, or the new domain's filing.

There are no repository-level deployment secrets or GitHub environments configured for this website as of October 26, 2026. Organization-level secret metadata could not be read with the existing account permissions. The CI workflow does not use organization secrets. Current deployment uses the operator's existing authorized SSH connection; credentials stay outside this repository and GitHub Actions.

## Build and select a release

1. Select a reviewed website commit and confirm its **Website CI** run succeeded on that exact SHA.
2. Download the `zipzi-site-COMMIT_SHA` artifact from that run, or check out that exact commit and run `npm run lint`, `npm run build`, `npm test`, and `npm run package` with Node 24.12.0.
3. Validate `artifact/SHA256SUMS` from inside `artifact/` using `sha256sum --check SHA256SUMS` (Linux) or `shasum -a 256 --check SHA256SUMS` (macOS).
4. Apply the existing environment-specific entry adapter. On this shared host, `/jobs` must continue loading the original jobs application behind its existing Nginx authentication, while other paths load the website. The private adapter refers to already-deployed legacy assets and does not include authentication data. Never deploy the standalone artifact directly over that entry point.
5. Produce a final deployment manifest and checksum file covering the adapted HTML and content-addressed assets. Verify it before uploading. The artifact contains no product release binaries.

## Server transaction

The operator's environment-specific script must enforce the following sequence:

1. Verify the expected hostname, resolved document root, Nginx root configuration, and current `index.html` SHA256. Acquire an exclusive `flock` for the entire transaction. Stop on a changed target or concurrent deployment.
2. Capture strict HTTPS route baselines for both `clwai.cn` and `www.clwai.cn`: homepage 200, unauthenticated `/jobs` 401, unauthenticated `/api/admin/jobs` 401, and `/api/health` 200. Record service state and existing listening ports.
3. Create a unique mode-700 backup directory **outside all public roots**. Copy the current static directory and relevant Nginx configuration, record authentication/configuration checksums, and archive the backup. Extract the archive into a private restore-check directory and compare it with the original backup before modifying production. Do not fetch certificate private keys or authentication files to the developer machine.
4. Extract the uploaded package into a new staging directory. Reject symlinks, unexpected paths, missing/extra files, and checksum mismatches before writing production files.
5. Copy only new content-addressed assets; require identical bytes if a filename already exists. Retain every legacy asset and previous website asset.
6. Install the new homepage into a temporary file in the same document root, then atomically rename it to `index.html`. Never serve a partially written entry point. Static content changes do not require Nginx reload.
7. Verify the deployed file checksums, unchanged configurations/authentication checksums, `nginx -t`, service state, and preserved listening ports/legacy assets. On failure after switching the homepage, atomically restore the previous entry point from the verified backup.
8. Verify every new public file through strict HTTPS, including its content hash. Repeat the route baselines. Confirm both hostnames have trusted chains, matching names, and valid dates. Do not use `curl -k`, disable browser certificate checks, or treat authenticated GitHub access as proof of public downloads.

Record the commit, CI run URL, previous/new homepage hashes, private backup location, and verification results in the operator's deployment record. Those environment records remain outside Git.

## Rollback

Use the backup's rollback script or atomically restore its `site/index.html` after checking that the current hash matches the release being rolled back. Acquire the same deployment lock. All previous assets remain in place, so no asset deletion is needed. Verify the restored homepage hash, strict HTTPS, jobs/admin authentication, API health, service state, and configuration checksums again. Do not restore unrelated system files when only the homepage changed. Keep backups outside the web root.

## Optional automatic production deployment

Automatic production access is deliberately not provisioned by this change. Before enabling it, approve a dedicated, least-privilege deployment identity and server-side command restricted to this website's allowed files, with no interactive shell, port forwarding, unrelated service access, or broad sudo. Pin the SSH host key. Store only that dedicated credential in a protected GitHub production environment; never upload an existing personal/root SSH key. Use a production concurrency group with cancellation disabled, verify the build SHA and checksums, and retain the transaction/rollback checks above.

Do not install a general-purpose self-hosted Actions runner on the production server. A deployment failure must leave the previous website serving. Creating the identity, its persistent authorization, GitHub secrets, and environment protections requires separate approval.
