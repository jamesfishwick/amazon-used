# Changelog

All notable changes to **Cheapest Read** will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). See [`docs/VERSIONING.md`](docs/VERSIONING.md) for the bump rules, source-of-truth version field, and how to decide what the next version number should be.

Entries are only added from the git record — nothing is back-filled from memory. Versions below match the `version` field in [`manifest.json`](manifest.json), which is what Chrome actually installs.

## [Unreleased]

### Added

- `CHANGELOG.md` (this file) and `docs/VERSIONING.md` — single source for release notes plus a written SemVer bump convention (FIS-66).
- `RELEASE-WORKFLOW.md` — canonical feature-PR to release chain, ratified on FIS-61, drafted in FIS-62 (#5).

## [1.4.0] - 2026-04-18

First tagged release. Released as git tag `v1.4.0`. Everything listed here accumulated on `main` between the initial import and the `1.4.0` bump — PRs #6, #7, #9, and #14 merged while `manifest.json` was still `1.3`, and were first shipped under the `v1.4.0` tag when PR #4 bumped the manifest. No intermediate tag was cut.

### Added

- Dev-mode build script (`scripts/build-dev.sh`) and non-dev install guide. Produces a reproducible unpacked build for reviewers without requiring a Chrome Web Store listing (FIS-40, #4).
- User how-to `HOWTO-CHEAPEST-COPY.md` documenting the five render shapes for the cheapest-copy flow (FIS-65, #7).
- Extraction parity for seller, condition, and offer dedup, plus a CI gate to keep parity from regressing (FIS-38, #6).
- `.github/PULL_REQUEST_TEMPLATE.md` — v0 PR review template (FIS-28).

### Fixed

- Offer label now splits offer type from condition so the rendered string reads e.g. `Used - Very Good` instead of a combined blob (FIS-71, #9).
- Dropped the `All Offers Display` debug column from the all-prices table; it was a leftover from development and confused reviewers (FIS-72, #14).

## [1.3] - 2026-04-18

Initial repo import. Not a public release. `1.3` is the version the working copy was carrying when it was first committed (`4b32dbf chore: initialize repo`), not a considered release cut. No git tag was ever pushed for `1.3`.

### Added

- Initial working copy of the Cheapest Read Chrome extension (MV3, `manifest_version: 3`, `version: "1.3"`).

<!--
Compare/release links. Only tags that actually exist go here. Add new lines
as new tags are pushed; do not reference tags that have not been cut.

    [Unreleased]: https://github.com/jamesfishwick/amazon-used/compare/v1.4.0...HEAD
    [1.4.0]:      https://github.com/jamesfishwick/amazon-used/releases/tag/v1.4.0
-->

[Unreleased]: https://github.com/jamesfishwick/amazon-used/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/jamesfishwick/amazon-used/releases/tag/v1.4.0
