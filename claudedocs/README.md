# claudedocs — deep technical reference

Deep technical notes on how Cheapest Read actually pulls offer data from Amazon. This folder is **reference-only**: selectors, DOM quirks, API observations, and a benchmark run. It is not the product roadmap.

> The canonical roadmap, milestones, and scope decisions live in the `FIS-23` plan. If anything in this folder contradicts that plan, the plan wins.

## What's in here

- **[api-endpoint-findings.md](api-endpoint-findings.md)** — technical reference for the `aodAjaxMain` offers endpoint. URL shape, parameters, full DOM structure analysis, selector variations tried, container detection strategies, text-extraction techniques, known issues, and validation methods. Use this when you need the mechanics of how extraction works.
- **[debugging-journey.md](debugging-journey.md)** — narrative of how the current extraction recipe was found. Problems hit, iterations, user feedback that redirected the approach, and mistakes worth not repeating. Use this when you want the *why* behind a selector choice.
- **[quick-reference.md](quick-reference.md)** — concise working code patterns. Endpoint URL, the three selectors that work, do/don't lists, verification checklist. Use this when you just need to get moving.
- **[test-results-1988964490.md](test-results-1988964490.md)** — 2025-10-17 benchmark data from "Uncertain Sons and Other Stories" (ASIN `1988964490`). Pre-parity baseline; the current extractor produces 10 unique offers (not 12) because the pinned/sticky duplicates now collapse. Useful as a historical regression reference.

## Key learnings (still valid)

1. **Total price ≠ item price.** A $15.99 item with $3.99 shipping is more expensive than a $19.99 item with free shipping. Sort on total, not item.
2. **API beats HTML scraping.** The `aodAjaxMain` endpoint is cleaner and more stable than scraping the offer-listing page — no ads, no recommendations, no nav chrome.
3. **Work up from prices, not down from containers.** Finding containers first is brittle; finding price nodes first and walking up the DOM is reliable.
4. **Use `innerText`, not `textContent`.** `textContent` pulls hidden CSS/JS text; `innerText` returns only visible text.
5. **Always verify visually.** Screenshot the offer listing and compare to extracted data before trusting a change.

## Extraction parity metrics

Milestone B (FIS-38) landed 2026-04-18. Measured live against 5 ASINs (new + used,
paperback + hardcover + mass market), 49 offers total:

| ASIN       | Offers | Seller | Condition | Duplicates |
|------------|-------:|-------:|----------:|-----------:|
| 1988964490 | 10     | 100%   | 100%      | 0          |
| 0374157359 | 10     | 100%   | 100%      | 0          |
| 0262548712 | 10     | 100%   | 100%      | 0          |
| 0143127799 | 10     | 100%   | 100%      | 0          |
| 0553386794 | 9      | 100%   | 100%      | 0          |

Seller comes from `[id="aod-offer-soldBy"] [aria-label]` (with `"Ships from and sold by X"`
legacy fallback). Condition comes from `[id="aod-offer-heading"]` and is normalized to
`New | Used - Like New | Used - Very Good | Used - Good | Used - Acceptable | Refurbished`.
Dedup collapses offers with identical `(itemPrice, shippingCost, seller, condition)`
tuples, which in practice merges the AOD pinned offer with its duplicate row.

## How to validate changes

1. Run `npm test` — the happy-path spec covers wishlist ASIN extraction, the
   existing offer parser, and the parity fixture (seller + condition + dedup).
2. For live validation, load the extension in dev mode and scan a wishlist
   containing `1988964490`. Confirm the console shows 10 unique offers with every
   `seller` and `condition` field populated (no "Unknown" values) and a lowest
   total in the $18-20 range.
3. Capture a fresh screenshot if selectors changed.

## Historical scripts

The ad-hoc Node scripts that produced this benchmark (`parse-api-simple.js`, `fetch-api-offers.js`, `check-api-calls.js`, and the various `debug-*` / `test-*` helpers) now live in [`../archive/`](../archive/) as reference only. The shipping extension no longer depends on them. Loose debug output (`*.json`, `*.txt`, `*.html` dumps) was removed as part of [FIS-36](/FIS/issues/FIS-36).

---

**Last Updated:** 2026-04-18
**Scope:** books only, amazon.com only
**Roadmap:** deferred to the `FIS-23` plan
