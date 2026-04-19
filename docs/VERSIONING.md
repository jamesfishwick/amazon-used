# Versioning

Cheapest Read follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`.

## Bump rules

Apply whichever of these fires on the change you are releasing:

- **MAJOR** — breaking change to user-visible behavior or to the install/upgrade path. Example: renaming the extension, removing a previously supported Amazon marketplace, changing the wishlist scan trigger.
- **MINOR** — new functionality added in a backward-compatible way. Example: adding a new filter, adding support for a new page type, extraction parity work that changes what is displayed without breaking existing flows.
- **PATCH** — backward-compatible fixes and internal changes with no user-visible behavior change. Example: selector repairs, logging improvements, CI-only changes, doc updates.

If a change could reasonably be either MINOR or PATCH, prefer PATCH and note the change in the `Added`/`Changed` section of `CHANGELOG.md`.

## Current state

- The working copy was first committed at `1.3` as an import seed, not as the result of a considered `1.0.0` cut. See `CHANGELOG.md` for the full record.
- The extension ships dev-mode only until the Chrome Web Store listing in milestone D2 (tracked via [FIS-58](/FIS/issues/FIS-58)). Until that point, users install the unpacked build themselves and the public compatibility surface is narrow.
- Because there is no Web Store listing yet, the cost of a MAJOR bump is low. Don't soften the bump rules to avoid one — if the change is breaking, bump MAJOR and write it down.

## Where the version lives

- **`manifest.json` → `version`** is the source of truth. Chrome reads this and it is what users see.
- **`package.json` → `version`** is not authoritative. It exists for npm tooling and is not kept in sync with `manifest.json`. Do not rely on it.
- **Git tags** mirror the `manifest.json` version. Tag format: `vMAJOR.MINOR.PATCH` (e.g. `v1.4.0`). The tag MUST match `manifest.json` exactly at the commit it points to.

## Release checklist (per change)

Every PR that ships behavior to users should:

1. Update `manifest.json` `version` using the bump rules above.
2. Update `CHANGELOG.md` in the same PR:
   - Move relevant entries out of `[Unreleased]` into a new `[MAJOR.MINOR.PATCH] - YYYY-MM-DD` section.
   - Group entries under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security` as appropriate (see [Keep a Changelog](https://keepachangelog.com/en/1.1.0/#how)).
3. After the PR merges to `main`, tag the merge commit:
   ```
   git tag -a vMAJOR.MINOR.PATCH -m "Cheapest Read vMAJOR.MINOR.PATCH"
   git push origin vMAJOR.MINOR.PATCH
   ```
4. If a dev-mode build artifact is produced (see `RELEASE-WORKFLOW.md` when [FIS-62](/FIS/issues/FIS-62) lands), name it after the same version.

PRs that don't ship user-visible behavior (CI config, internal refactors with no runtime delta, non-shipping docs) don't need a version bump. Add an entry to `[Unreleased]` so the next real release picks it up.

## Deciding the next version

Read the entries under `[Unreleased]` in `CHANGELOG.md`:

- Any `Removed` or breaking `Changed` entry → bump MAJOR.
- Otherwise, any `Added` entry → bump MINOR.
- Otherwise → bump PATCH.

The answer should be unambiguous from the changelog alone. If it isn't, the changelog entries need to be more specific before the release goes out.
