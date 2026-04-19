# Changelog

All notable changes to **Cheapest Read** will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [docs/VERSIONING.md](docs/VERSIONING.md) for the full versioning rules, including how we handle dev-mode releases before the Chrome Web Store listing ships.

Versions below reflect the `version` field in [`manifest.json`](manifest.json), which is the source of truth for what Chrome actually installs. Entries are only added from the git record — nothing is back-filled from memory.

## [Unreleased]

### Added

- `CHANGELOG.md` (this file) and `docs/VERSIONING.md` to give the project a single place to record release notes and a written versioning convention (FIS-66).

## [1.3] - 2026-04-18

Initial import. Not a public release — `1.3` is the version the working copy carried when it was first committed to this repo.

### Added

- Initial working copy of the Cheapest Read Chrome extension (MV3, `manifest_version: 3`, `version: "1.3"`).
- `.github/PULL_REQUEST_TEMPLATE.md` — v0 PR review template (FIS-28).

<!--
Compare/release links are omitted until the first `vMAJOR.MINOR.PATCH` tag
is pushed. Once `v1.3` (or whichever version ships first) exists, add
Keep a Changelog style link definitions here, e.g.:

    [Unreleased]: ../../compare/v1.3...HEAD
    [1.3]:        ../../releases/tag/v1.3
-->

