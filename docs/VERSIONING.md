# Versioning

Cheapest Read follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`. This doc covers the **versioning policy** — how to pick the next number and how to update the record in the same PR. For the process side (who reviews, who merges, who cuts the release), see [`RELEASE-WORKFLOW.md`](./RELEASE-WORKFLOW.md).

## Source of truth

- **`src/manifest.json` → `version`** is authoritative. Chrome reads this; it is what users see.
- **`package.json` → `version`** is not authoritative. It exists for npm tooling and is not kept in sync. Do not rely on it.
- **Git tags** mirror `src/manifest.json`. Tag format: `vMAJOR.MINOR.PATCH` (e.g. `v1.4.0`). The tag MUST match `src/manifest.json` exactly at the commit it points to. If the working copy shows one version and the tag shows another, `src/manifest.json` wins and the tag is wrong.

## Bump rules

Apply whichever of these fires on the change you are releasing:

- **MAJOR** — breaking change to user-visible behavior or to the install/upgrade path. Example: renaming the extension, removing support for a previously supported Amazon marketplace, changing the wishlist scan trigger in a way that existing users would have to adjust to.
- **MINOR** — new functionality added in a backward-compatible way. Example: adding a new filter, adding support for a new page type, extraction parity work that changes what is displayed without breaking existing flows.
- **PATCH** — backward-compatible fixes and internal changes with no user-visible behavior change. Example: selector repairs, logging improvements, CI-only changes, doc updates that do not land in the extension bundle.

If a change could reasonably be either MINOR or PATCH, prefer PATCH. If it could reasonably be either MAJOR or MINOR, prefer MINOR — but only when the change is genuinely backward-compatible. Do not soften a MAJOR bump to avoid the number moving.

## Deciding the next version

Read the entries under `[Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md):

- Any `Removed` entry, or any `Changed` entry that is breaking → bump **MAJOR**.
- Otherwise, any `Added` entry → bump **MINOR**.
- Otherwise (only `Fixed`, `Security`, or non-breaking `Changed`) → bump **PATCH**.

The answer should be unambiguous from the changelog alone. If it isn't, the changelog entries need to be more specific before the release goes out.

Worked example: if `[Unreleased]` contains two `Added` entries (a new filter, a new doc) and one `Fixed` entry (a selector repair), the next version bumps MINOR — so `1.4.0` → `1.5.0`.

## Release checklist (per change)

Every PR that ships behavior to users should:

1. Update `src/manifest.json` `version` using the bump rules above.
2. Update [`CHANGELOG.md`](./CHANGELOG.md) in the same PR:
   - Move relevant entries out of `[Unreleased]` into a new `[MAJOR.MINOR.PATCH] - YYYY-MM-DD` section.
   - Group entries under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security` (see [Keep a Changelog](https://keepachangelog.com/en/1.1.0/#how)).
   - Add the new version to the compare/tag link list at the bottom of the file once the tag is pushed.
3. Merge the PR via the release chain in [`RELEASE-WORKFLOW.md`](./RELEASE-WORKFLOW.md).
4. After merge to `main`, tag the merge commit:
   ```
   git tag -a vMAJOR.MINOR.PATCH -m "Cheapest Read vMAJOR.MINOR.PATCH"
   git push origin vMAJOR.MINOR.PATCH
   ```
5. If a dev-mode build artifact is produced (see `scripts/build-dev.sh` from FIS-40), name it after the same version.

PRs that do not ship user-visible behavior (CI-only changes, non-shipping docs, internal refactors with no runtime delta) do not need a version bump. Add an entry to `[Unreleased]` so the next real release picks it up.

## Current state — pre-Web-Store

The repo has never had a public release. `src/manifest.json` was imported carrying `1.3` (no tag), then bumped to `1.4.0` (tag `v1.4.0`) when FIS-40's dev-mode build script landed. Until [FIS-58](https://github.com/jamesfishwick/amazon-used/issues/58) (Chrome Web Store listing) ships, users install the unpacked build themselves and the only consumers of the `version` field are dev-mode reviewers.

Practical effect: **the cost of a MAJOR bump is low**, because nothing external depends on the current major. Do not soften the bump rules to avoid a MAJOR; if the change is breaking, bump MAJOR and write it down. When the Web Store listing ships, whatever version is live at that moment becomes the stable baseline.

### Scope note — FIS-66 v0.x language

The FIS-66 ticket scope was written expecting the repo to be on v0.x, with the specific rule "while on v0.x: breaking changes bump MINOR, fixes bump PATCH." The repo is not on v0.x — the import seed was `1.3` and the first tag was `v1.4.0`. Rather than retroactively renumber the tag that was already pushed, we apply standard SemVer at 1.x and accept the pre-Web-Store caveat above. The intent of the v0.x rule (permissive breaking-change cost before public release) is preserved by the "cost of a MAJOR bump is low" guidance, not by MINOR-escalating breaking changes.
