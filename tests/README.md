# Tests

Single `npm test` entry point. Runs a headless Playwright happy-path against local HTML fixtures.

## Layout

- `happy-path.spec.js` — the runner (Playwright, headless chromium, no external test framework).
- `fixtures/` — minimal HTML snapshots that exercise the extension's parsers:
  - `wishlist.html` — two book wishlist items with `data-reposition-action-params` ASINs.
  - `offers-0374157359.html` — an `#all-offers-display` page with three book offers (Used $6.46, Used $9.99, New $18.50).
- `archive/` — standalone node scripts from earlier development. Not wired into `npm test`; kept for historical reference only.

## What the happy path covers

1. Load `wishlist.html`, inject `content.js`, assert `findWishlistItems` + `extractASIN` return the two expected book ASINs.
2. Load `offers-0374157359.html`, inject `offers-content.js`, invoke its `extractOffers` message handler end-to-end, assert the response surfaces $6.46 as the lowest total price and the list is sorted ascending.

The extension source is loaded verbatim into the page — the URL guard in `content.js` (`/hz/wishlist/*`) and the IIFE in `offers-content.js` mean pure helpers become global while side effects stay quiet. A stubbed `chrome.runtime` captures the offer-content listener so the real `waitForOffersToLoad` → `parseOffersFromDiv` pipeline runs.

## Running

```bash
npm install
npm test
```

Exits 0 on pass, 1 on any assertion or runtime failure.
