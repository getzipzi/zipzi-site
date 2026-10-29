# Deployment and rollback

## Current status

The canonical website is `https://clwai.cn`. Its server also serves an independently authenticated jobs application and API. Website deployment must preserve jobs, API, SSH, TLS and legacy assets.

The owner requested deployment from website CI. The workflow and transaction engine are implemented, but **production deployment is disabled**. No deployment credential, environment, account, permission or server helper has been provisioned by this change. Credential access and the separate Nginx migration still require approval. A green verification job or saved artifact does not mean the website was deployed.

Do not change DNS, certificates, firewall rules, the new domain's filing, services or credentials during a static release. Never upload an existing private key without explicit approval for that destination and persistent access.

## Workflow boundary

CI verifies source, generated output, reproducibility, headless browser behavior and publication safety. Offline deployment tests run normally and as root in the disposable GitHub runner, using temporary fixtures without production connections.

The deployment job requires:

- A successful `verify` job in the same workflow run.
- Repository `getzipzi/zipzi-site`, event `push`, ref `refs/heads/main`.
- Repository variable `ZIPZI_DEPLOY_ENABLED` exactly `true`.
- Independently approved credentials, host pins, installed receiver and routing policy.

PRs, forks, manual workflow runs and product releases cannot run deployment. There is no `workflow_run`, `pull_request_target`, release trigger or cross-repository dispatch. Verification has no production secrets. Actions are pinned to full SHAs and checkout does not persist credentials.

Deployment downloads `zipzi-site-$GITHUB_SHA` from **the same `GITHUB_RUN_ID`**, using the read-only workflow token. It rechecks the clean source revision, exact inventory and all checksums without rebuilding. A GitHub API check rejects a revision that is no longer current main before any production request.

Main runs are not canceled mid-deployment. Deployment has a shared concurrency group with cancellation disabled; the receiver also holds a filesystem lock. GitHub may replace queued runs and does not guarantee their order, hence the additional revision check. See GitHub's [concurrency rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) and [artifact download documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

## One-time setup: not performed

Authentication is separate from the installer. The client accepts an explicitly approved root identity or a separately approved restricted identity. **An unrestricted root SSH key gives the workflow root access; this application's fixed command does not restrict that key.** A restricted identity would require a forced command, disabled forwarding and permission to invoke only the root-owned receiver. Neither option is automatically provisioned.

After explicit approval, an operator would need to:

1. Complete the independently reviewed routing migration below, back it up, run `nginx -t`, gracefully reload and verify actual HTTP behavior. This is outside the CI deployer.
2. Install reviewed `protocol.py`, `receiver.py` and `ssh_gate.py` in `/usr/local/libexec/zipzi-site-deploy/`, root-owned and not group/world-writable. The gate must be executable. CI cannot replace these files.
3. Create private root-owned state and backup directories outside every public root. Copy `policy.example.json` to `/etc/zipzi-site-deploy/policy.json`, mode `600`, replacing placeholders with reviewed paths and SHA256 baselines. Keep `routing_approved: false` until the migration is approved and verified. Resolve configuration symlinks to their actual root-owned files for protected-file guards.
4. Configure an approved `production` environment restricted to main, preferably with a required reviewer. Store the specifically approved identity only as environment secret `ZIPZI_DEPLOY_SSH_KEY`. Configure environment variables `ZIPZI_DEPLOY_HOST=clwai.cn`, `ZIPZI_DEPLOY_USER`, and `ZIPZI_DEPLOY_KNOWN_HOSTS`. The last value is public host-key material verified through an existing trusted connection or console, never blind `ssh-keyscan` output. Private credentials must not be variables.
5. Only after validating every prerequisite, set repository variable `ZIPZI_DEPLOY_ENABLED=true`. Do not create an environment merely to make a skipped job green.

The client requires strict host verification, no agent forwarding, password fallback or interactive shell, no user's SSH config and one fixed remote command. Approved key material goes only into mode-600 temporary runner files removed when the client exits, never artifacts. Logs contain result categories and revisions, not keys or remote output.

To disable future deployment, remove or set `ZIPZI_DEPLOY_ENABLED` to `false`. Revocation also requires removing the approved secret and corresponding server access. Do not blindly delete or rotate a shared root identity used for human SSH access. Check an in-flight transaction's outcome before retrying.

## Independent routing prerequisite

The existing SPA fallback returns the homepage for robots, sitemap and unknown paths. Copying static files alone cannot fix this. The pending environment-specific Nginx review covers:

- Plain-text robots, XML sitemaps and real 404s with the generated error page.
- Public HTTPS `www` redirects to the apex, preserving path/query and jobs/API host behavior.
- Immutable `/_astro/` resources while preserving `/assets/` and legacy files.
- A server-internal legacy jobs entry outside the public root, retaining authentication and SPA navigation. Its direct route must return 404. Preserve original entry and asset hashes.
- Unchanged API proxy, admin authentication and TLS.

The receiver cannot write Nginx configuration, install the legacy entry, reload services or relax permissions. It requires protected configuration/legacy hashes and actual HTTPS routing/authentication checks to pass **before any public write**. Setting `routing_approved: true` alone is insufficient. No migration is embedded in CI or the artifact.

## Static transaction and recovery

The protocol accepts a bounded uncompressed archive of regular files. It rejects traversal, absolute paths, duplicate members/JSON keys, links, special or operational files, wrong revisions, dirty builds and checksum mismatches. It never extracts archive paths to disk. Destinations are an explicit allowlist of page/error/SEO files, current brand images and hashed Astro assets. `/jobs`, `/api`, `/assets`, authentication files and server configuration are not destinations.

The receiver loads only its fixed root-owned policy. Requests cannot supply a path, shell command or policy override. Destination ancestors must be trusted, not writable by other users and free of symlinks. Unknown existing files and immutable-name collisions are rejected. These boundaries apply even when the receiver runs as root.

Under an exclusive lock, it verifies current managed files, protected configuration/legacy hashes, jobs/admin 401 authentication, API body, private internal route, canonical redirect and real 404. It creates a unique mode-700 backup outside public roots, copies managed files and verifies their bytes. A checksummed recovery journal precedes writes. Assets and supporting files are atomically replaced before `index.html`, which switches last. This is atomic per file, not an atomic replacement of the shared root.

Post-switch strict HTTPS checks require exact managed bytes, appropriate SEO MIME types and the generated error body with status 404. Protected routes and files are checked again. Only then is the revision committed and a matching receipt returned. On error, validated previous files are restored and health checks repeat. Hashed assets are retained for cached HTML; unrelated files and services are never removed or restored.

An interruption leaves `pending.json`; status reports `recovery_required`. The next accepted deployment recovers under the same lock before proceeding. The client sends one mutation; an uncertain result causes one status request, never a blind second deployment. Lost responses or incomplete recovery are not reported as success.

Manual rollback uses the fixed gate with a bounded request containing `protocol: 1`, `action: rollback`, the recorded transaction ID and `expected_commit`. It rejects a different revision, changed managed files or corrupt backups. Use the reviewed transport and recorded receipt. Keep private backups and old hashed assets; never run `rsync --delete` on the shared root.

Automated 401 checks verify access control, not the authenticated jobs UI. Exercise that UI separately when suitable credentials are authorized. Local tests also do not establish production readiness: the first deployment remains blocked until its independent approvals and prerequisites are satisfied.
