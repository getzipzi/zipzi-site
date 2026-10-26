# Product release maintenance

## Current approach

The website and product are separate repositories. The verified release source is the private `getzipzi/zipzi-2d` repository. Website CI reads the committed metadata snapshot; it never needs cross-repository credentials. A maintainer uses `npm run release:check` with their existing `gh` session to prepare a candidate, reviews it, and commits the update. Publishing a product release does not silently change production content.

The “all releases” link requires no synchronization and includes new releases as GitHub publishes them. The version-specific asset links remain reproducible and accurate. They are still private; changing the website cannot make those files public.

## Why not use a latest download URL now?

[GitHub's release links](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases) support `/releases/latest` and `/releases/latest/download/ASSET_NAME`. The latest-release endpoint selects a non-draft, non-prerelease release. The verified release is an Alpha prerelease, and its asset names contain the tag. A fixed asset shortcut would therefore not provide a reliable Alpha update channel.

If the owner later chooses a public distribution repository and stable asset names, the website can link to that channel without a token, dispatch workflow, or copied binaries. Neither repository visibility nor product packaging is changed by this website work.

## Optional future event-driven synchronization

A `release` workflow with `types: [published]` belongs in the repository publishing the product release. A website workflow does not receive another repository's release events automatically. `repository_dispatch` or `workflow_dispatch` can start a website workflow, but authentication must have access to the target repository.

The default `GITHUB_TOKEN` is scoped to the workflow's repository and cannot read another private repository or dispatch into it merely because both repositories share an organization. Most events created by that token do not start another workflow; `repository_dispatch` and `workflow_dispatch` are documented exceptions. These exceptions do not grant cross-repository access.

If fully automatic metadata synchronization is required, first approve a specific permission design. A repository-scoped GitHub App with short-lived installation tokens is preferable to uploading a personal token: product metadata read access, website content/PR access if proposing a change, and Actions write only if dispatch is needed. The website should receive a reviewed metadata change through a PR and its own CI. Product packaging and publishing should not depend on the success of the website update.

No app, token, secret, dispatch subscription, or product workflow has been created here. Changes to the product release pipeline need separate review and approval.

## Official references

- [Release workflow events and dispatch events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GITHUB_TOKEN scope and permissions](https://docs.github.com/en/actions/concepts/security/github_token)
- [Triggering workflows and event recursion](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow)
- [Latest release REST API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)
