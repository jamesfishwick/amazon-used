# Cheapest Read — Project Structure

Target repo layout after FIS-11. Extension source is isolated under `src/`; project docs consolidate under `docs/`. Only `README.md` and `CLAUDE.md` stay at the repo root.

## Tree

```
.
├── README.md                    # Entry point; product scope and doc pointers
├── CLAUDE.md                    # Tool-specific instructions read by Claude Code
├── package.json                 # npm scripts, dev dependencies, lint-staged config
├── package-lock.json
├── biome.json                   # Biome formatter/linter config
├── .gitignore
├── .github/                     # CI workflows, PR template
├── .husky/                      # Git hooks (pre-commit runs lint-staged)
├── src/                         # Extension runtime (Chrome's extension root)
│   ├── manifest.json            # MV3 config; paths below are relative to this file
│   ├── background.js            # Service worker; coordinates offer-fetch tabs
│   ├── content.js               # Wishlist page scanner; renders inline results
│   ├── offers-content.js        # Offer-listing parser (aodAjaxMain endpoint)
│   ├── popup.html               # Toolbar popup markup
│   ├── popup.js                 # Popup logic
│   └── icons/                   # 16/32/48/128 PNGs + source SVG + CWS listing icon
├── docs/                        # All project docs except README.md and CLAUDE.md
│   ├── PROJECT-STRUCTURE.md     # This file
│   ├── DEVELOPMENT.md           # Local dev workflow, linting, tests
│   ├── INSTALLATION.md          # End-user install guide (dev-mode Load Unpacked)
│   ├── HOWTO-CHEAPEST-COPY.md   # End-user usage walkthrough
│   ├── RELEASE-WORKFLOW.md      # Canonical PR-to-release chain (FIS-62)
│   ├── VERSIONING.md            # SemVer bump policy (FIS-66)
│   ├── CHANGELOG.md             # Keep-a-Changelog record, tracks src/manifest.json
│   ├── privacy.html             # Hosted privacy policy for the CWS listing
│   └── claudedocs/              # Deep technical reference (selectors, DOM notes)
├── scripts/
│   └── build-zip.sh             # Packages src/ into dist/cheapest-read-<version>.zip
├── tests/                       # Playwright happy-path + render-label specs
│   ├── happy-path.spec.js
│   ├── render-label.spec.js
│   ├── fixtures/                # Static HTML fixtures served to the test browser
│   └── README.md
├── dist/                        # Build output (gitignored); CWS zip artifact
├── archive/                     # Historical / orphaned scripts (gitignored)
└── screenshots/                 # Verification screenshots (gitignored)
```

## File dependencies

### `src/manifest.json` references (all paths relative to `src/`)

- `background.js` — service worker
- `content.js` — wishlist content script
- `offers-content.js` — offers content script
- `popup.html` — toolbar popup
- `icons/icon-{16,32,48,128}.png` — action/toolbar icons

### `src/popup.html` references

- `popup.js` (same directory)

### `scripts/build-zip.sh` packaging

Reads the version from `src/manifest.json`, then zips the runtime files from inside `src/` so the zip root matches the extension root Chrome expects. Excludes `icons/*.svg` and the CWS-only `icons/icon-128-store.png` from the runtime package.

## Extension architecture

1. User opens an `amazon.com/hz/wishlist/*` page; `content.js` loads per the manifest match pattern.
2. `content.js` extracts ASINs and messages `background.js`.
3. `background.js` opens a hidden tab per ASIN against `/gp/offer-listing/*`.
4. `offers-content.js` runs in each hidden tab and extracts offers from the `aodAjaxMain` AJAX endpoint.
5. Offers flow back to `content.js`, which renders the inline result box.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the dev workflow and [claudedocs/](claudedocs/README.md) for the extraction recipe.
