# Development Guide

Guide for working on Cheapest Read locally. Scope is **books on amazon.com**; music, video, and non-US marketplaces are being removed and should not be re-introduced in new code.

## Key files

- `manifest.json` — MV3 extension configuration (name, permissions, content scripts, popup).
- `popup.html` / `popup.js` — Extension popup entry point. **Currently broken** — see `FIS-33`. Do not add new features here until that ticket closes.
- `content.js` — Wishlist page scanner. Reads ASINs, triggers per-item offer fetches, renders results.
- `background.js` — Service worker. Coordinates the tab-based offer-fetch flow.
- `offers-content.js` — Runs in the offer-listing tabs, extracts offers from the `aodAjaxMain` response.

`window.html` and `window.js` are archived in `archive/` and must not be referenced from shipping code.

For the detailed file inventory see [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md). For the extraction recipe (selectors, DOM notes, API quirks) see [claudedocs/](claudedocs/README.md).

## Core flows

1. **Wishlist scan.** User clicks the extension icon on an `amazon.com/hz/wishlist/*` page. `content.js` extracts ASINs from `data-reposition-action-params` (with a product-link fallback) and hands them to `background.js`.
2. **Per-item offer fetch.** `background.js` opens a hidden tab per ASIN against `/gp/offer-listing/*`; `offers-content.js` pulls offers from the `aodAjaxMain` AJAX endpoint.
3. **Parse + filter.** Offers are parsed into `{ itemPrice, shippingCost, totalPrice, seller?, condition? }`. Digital offers (Kindle, Audible) are filtered out. Results are sorted by total price.
4. **Persistence.** Results and debug state are kept in `chrome.storage`.

## Dev workflow

1. Edit files in the repo root.
2. Reload the extension at `chrome://extensions/`.
3. Reload the target `amazon.com/hz/wishlist/*` tab.
4. Click the extension icon to trigger a scan.
5. Use the debug-mode toggle to surface per-ASIN fetch/parse output.

## Testing

The `tests/` directory contains standalone Node/Playwright scripts used for manual and ad-hoc validation. See [tests/README.md](tests/README.md) for the active vs. archived scripts. A unified `npm test` harness is on the roadmap and tracked in the FIS-23 plan.

Headless Playwright is preferred when driving the browser from scripts.

Manual test areas:

- Wishlist pages of varying length.
- Books with and without used offers.
- Out-of-stock and add-on books.
- Debug mode on and off.

## Roadmap and future work

There is one canonical roadmap for this extension: the `FIS-23` plan (Milestones A–D). It replaces the earlier "Future Improvements" list that used to live here. When you are deciding what to build next, read the plan, not this file.

Major themes on that roadmap:

- **Milestone A** — stabilize and narrow scope: fix the popup, narrow to books and `amazon.com`, delete dev artifacts at the repo root.
- **Milestone B** — extraction parity: seller, condition, and dedup to >=95% on books.
- **Milestone C** — harden for daily use: caching, retries, a real `npm test`.
- **Milestone D** — distribution: dev-mode build artifact first, Chrome Web Store listing after.
