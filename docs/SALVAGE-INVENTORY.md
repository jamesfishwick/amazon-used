# Salvage Inventory — Cheapest Read → v0 Price-Comparison Engine

Discovery output for [FIS-12](/FIS/issues/FIS-12). Read-only analysis. No code changes in this doc; implementation follow-ups should be filed as separate tickets.

## Top-level recommendation

**Rewrite from scratch, borrowing specific pieces.**

The existing repo is a Chrome MV3 extension that injects per-item price boxes into `amazon.com/hz/wishlist/*`. The v0 goal ([FIS goal 02cda656](/FIS/goals/02cda656-dd0f-4b4b-b689-bc8d3a81047d)) is a multi-source price-comparison engine with a thin web UI, cache/TTL-managed snapshots, and fast-follow sources (AbeBooks, Thriftbooks, BWB).

The delivery shapes diverge at the load-bearing layer — auth (user-session cookies vs. server-side scraping), distribution (unpacked Chrome load vs. web service), data flow (DOM mutation vs. cached JSON), and multi-source fan-out (Chrome `host_permissions` per domain vs. pluggable scraper modules). Extending the extension to cover AbeBooks/Thriftbooks/BWB means shoehorning each new host into MV3 content scripts and inheriting the single-user session model, which fights every v0 requirement.

Borrow these specific pieces into the new engine repo:

1. **Parser logic in `offers-content.js`** — `parsePrice`, `parseShipping`, `parseCondition`, `parseSeller`, `normalizeCondition`, `dedupeOffers`, `getOfferContainers`. The selectors and normalization rules encode months of iteration. Port them into a server-side module that takes rendered HTML (Playwright page or fetched AOD endpoint).
2. **Wishlist parsers in `content.js`** — `extractASIN`, `findWishlistItems`, `analyzeWishlistItem`. Port under the same model.
3. **All fixtures under `tests/fixtures/`** — `wishlist.html`, `offers-0374157359.html`, `offers-parity.html`. These are the highest-leverage retained asset; representative Amazon HTML is cheap to describe but costly to reproduce.
4. **`claudedocs/*`** — the `aodAjaxMain` endpoint documentation, selector quirks, and debugging history are the scraper's institutional memory.
5. **Process + tooling** — `RELEASE-WORKFLOW.md`, `CHANGELOG.md`, `docs/VERSIONING.md`, `biome.json`, `.github/workflows/ci.yml`, `.husky/pre-commit`, `.github/PULL_REQUEST_TEMPLATE.md`. These are delivery-shape-agnostic.

Everything Chrome-specific (`manifest.json`, `background.js`, `popup.*`, `scripts/build-zip.sh`) is DROP.

## File-by-file inventory

35 tracked files (outside `node_modules/`, `dist/`, `.git/`, `.playwright-mcp/`).

| File | Status | Reason |
| --- | --- | --- |
| `.github/PULL_REQUEST_TEMPLATE.md` | KEEP | Review template is delivery-shape-agnostic. |
| `.github/workflows/ci.yml` | REWORK | Biome + shellcheck + Playwright install steps port directly; the `npm test` step swaps to the new harness. |
| `.gitignore` | KEEP | Ignores still apply (`node_modules/`, `dist/`, secrets). |
| `.husky/pre-commit` | KEEP | Two-line hook that runs lint-staged; reusable as-is. |
| `CHANGELOG.md` | KEEP | Carry forward; open a new major section for the engine rewrite. |
| `CLAUDE.md` | KEEP | Two Claude working rules (Playwright over webfetch, headless). Engine-agnostic. |
| `DEVELOPMENT.md` | REWORK | Structure is useful; content describes the extension dev loop (`chrome://extensions/`, reload tab) — rewrite for engine workflow. |
| `HOWTO-CHEAPEST-COPY.md` | DROP | End-user walkthrough for the extension UI (result boxes, popup, troubleshooting). Engine UI is different. |
| `INSTALLATION.md` | DROP | Chrome "Load unpacked" instructions. Not applicable to a web service. |
| `PROJECT-STRUCTURE.md` | DROP | Stale; references a `src/`-less MV3 layout and an `archive/` folder that FIS-36 already removed. Would mislead any engineer who reads it. |
| `README.md` | REWORK | Keep the shape (scope, what-it-does, known issues, roadmap links). Rewrite the content around the engine, not the extension. |
| `RELEASE-WORKFLOW.md` | KEEP | Roles and skip-paths (hotfix / non-release / doc-only) are independent of delivery shape. |
| `background.js` | DROP | Chrome service worker; uses `chrome.tabs.create` and `chrome.runtime.onMessage`. The *strategy* (per-ASIN fetch against the offer-listing URL) is documented in `claudedocs/` — the code is not reusable. |
| `biome.json` | KEEP | Formatter/linter config carries over; widen globs if the engine adds new dirs. |
| `claudedocs/README.md` | KEEP | Index of scraper knowledge. |
| `claudedocs/api-endpoint-findings.md` | KEEP | Documents the `aodAjaxMain` endpoint, URL shape, response format, and selector short-list. Single most valuable reference in the repo. |
| `claudedocs/debugging-journey.md` | KEEP | Anti-patterns ("don't scrape the recommendations block") worth not re-learning. |
| `claudedocs/quick-reference.md` | KEEP | Working Playwright pattern for fetching AOD. |
| `claudedocs/test-results-1988964490.md` | KEEP | Historical benchmark; useful as a regression baseline after parser port. |
| `content.js` | REWORK | Extract `extractASIN` (three-method fallback), `findWishlistItems`, `analyzeWishlistItem` (book-format detector with Kindle/Audible filter). Drop `displayPriceInfo`, the MutationObserver, and the DOM banner. |
| `docs/VERSIONING.md` | KEEP | SemVer bump rules and release checklist. Engine-agnostic. |
| `docs/privacy.html` | REWORK | Chrome-Web-Store-shaped privacy policy. Layout/wording template carries; content must be rewritten for server-side data flows (the extension stores nothing remotely; the engine will). |
| `manifest.json` | DROP | MV3 manifest (`content_scripts`, `host_permissions`, service-worker entry). No analogue in a web service. |
| `offers-content.js` | REWORK | Crown jewel. Port every helper (`parsePrice`, `parseShipping`, `parseCondition`, `parseSeller`, `normalizeCondition`, `dedupeOffers`, `getOfferContainers`, `SUBCOMPONENT_ID` regex) into a server-side module. Drop the IIFE + `chrome.runtime.onMessage` listener. |
| `package-lock.json` | DROP | Regenerate against the new dependency set. |
| `package.json` | REWORK | Keep `type: commonjs`, Biome/husky/lint-staged/Playwright deps. Rewrite `scripts` around the engine; drop `build:zip`. |
| `popup.html` | DROP | Extension popup shell. No analogue. |
| `popup.js` | DROP | Popup controller; references `chrome.tabs`. No analogue. |
| `scripts/build-zip.sh` | DROP | Packages the runtime files into `dist/cheapest-read-<version>.zip` for Chrome load-unpacked. Not applicable. |
| `tests/README.md` | REWORK | Retain the "single `npm test` entry point" discipline; rewrite around the new harness. |
| `tests/fixtures/offers-0374157359.html` | KEEP | Golden input for the offer parser. Three-offer happy-path fixture. |
| `tests/fixtures/offers-parity.html` | KEEP | Rich multi-case fixture: pinned/sticky dedup, Kindle filtering, seller variations, unknown-shipping path. |
| `tests/fixtures/wishlist.html` | KEEP | Golden input for the wishlist ASIN extractor. |
| `tests/happy-path.spec.js` | REWORK | Assertion patterns (per-step reporters, fixture-driven Playwright) port cleanly. Rewrite the glue around the new module layout. |
| `tests/render-label.spec.js` | DROP | Tests the extension's inline `(Used - Very Good)` headline rendering. Engine UI is out-of-repo / different component. |

## Risk callouts

Ordered by likelihood of biting the implementing engineer first.

### 1. Amazon DOM drift + no extension escape-hatch

Selectors in `offers-content.js` — `#aod-offer-heading`, `[id="aod-offer-soldBy"]`, `span.a-price span[aria-hidden="true"]`, the `SUBCOMPONENT_ID` exclusion regex — are current as of the 2026-04-18 parity work ([FIS-38](/FIS/issues/FIS-38)) against five live ASINs. Amazon rotates these without notice. In the extension, DOM drift was a "reload the tab, update the extension" cycle. In a server engine, drift shows up as silent blanks for every user until a fresh scrape is pushed and deployed. **Mitigation:** port the fixtures first, wire them to snapshot assertions on every CI run, and schedule a live-diff job against a small ASIN cohort so drift surfaces as a failing check rather than as user reports.

### 2. Server-side auth / anti-bot posture

The extension inherits the signed-in user's Amazon cookies transparently — every `aodAjaxMain` fetch looks like a human clicking. A server doing the same does not. Amazon actively fingerprints headless Playwright, and the AOD endpoint is cookie-sensitive (sign-in redirects are documented in `HOWTO-CHEAPEST-COPY.md` troubleshooting). Scaling from one user's browser to "N concurrent users' wishlists from one IP" changes the threat surface completely. **Mitigation:** before committing to a server-side scrape architecture, run a timeboxed spike that hits `aodAjaxMain` from a CI runner and measures captcha/429 rates against real ASINs. If Amazon walls it off hard, the answer may be "keep the extension shape, add AbeBooks/Thriftbooks/BWB via separate server-side scrapers" rather than pulling Amazon server-side.

### 3. Rate limiting + cache/TTL design is foundational, not a polish pass

Current extension paces at `BATCH_SIZE = 3`, `DELAY_BETWEEN_ITEMS = 1500ms`, per-ASIN tab timeout of 30s. A 50-book wishlist is ~25s wall-clock for one user. A server serving many users naïvely multiplies this against one shared upstream rate budget. The CEO brief calls out *"snapshots with TTLs; never display stale prices without a timestamp"* — that requirement exists because server-side caching is load-bearing for both cost and politeness, not an afterthought. **Mitigation:** pick a canonical offer row + snapshot schema before the second scraper lands; make "last scraped at" a required field in the API from day one; dedupe incoming wishlist requests against a fresh-enough cache before hitting Amazon.

### 4. Multi-source normalization is harder than one-source parity

The repo spent its parity milestone ([FIS-38](/FIS/issues/FIS-38)) converging on one normalized offer shape for Amazon: `{ type, condition, price, shippingCost, totalPrice, seller }`. AbeBooks, Thriftbooks, and BWB each have their own condition vocabularies (three sources' "Good" are three different things), shipping models (flat-rate vs. per-item, international surcharges), and identifier mappings (ASIN only maps cleanly to Amazon; the others key on ISBN-13/ISBN-10, and not every ASIN has an ISBN). **Mitigation:** lift Amazon as the reference implementation, not the template — write the v0 canonical offer schema as its own spec before the second scraper, and treat any per-source mapping asymmetries as explicit translators.

### 5. Scope guards encode correctness, not arbitrary limitation

`README.md` and the parsers short-circuit on: (a) books-only (Kindle/Audible/audiobook/ebook filters in both `content.js:analyzeWishlistItem` and `offers-content.js:isDigitalContext`); (b) `amazon.com`-only (no `.ca`/`.co.uk`); (c) USD currency parsing (the regexes assume `$`); (d) 10-character ASIN format. These aren't bugs — they're the guards that make the current extractors correct. A v0 engine that quietly expands scope (e.g. "let AbeBooks international sellers through") must re-apply them or the cheapest-copy comparisons silently fold in audiobook pack prices and `£`/`$` confusions. **Mitigation:** port the guards as explicit predicates in the normalized offer pipeline, not as inline string checks; fail loud on out-of-scope rows rather than coercing them.
