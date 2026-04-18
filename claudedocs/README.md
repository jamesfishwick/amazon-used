# claudedocs — deep technical reference

Deep technical notes on how Cheapest Read actually pulls offer data from Amazon. This folder is **reference-only**: selectors, DOM quirks, API observations, and a benchmark run. It is not the product roadmap.

> The canonical roadmap, milestones, and scope decisions live in the `FIS-23` plan. If anything in this folder contradicts that plan, the plan wins.

## What's in here

- **[api-endpoint-findings.md](api-endpoint-findings.md)** — technical reference for the `aodAjaxMain` offers endpoint. URL shape, parameters, full DOM structure analysis, selector variations tried, container detection strategies, text-extraction techniques, known issues, and validation methods. Use this when you need the mechanics of how extraction works.
- **[debugging-journey.md](debugging-journey.md)** — narrative of how the current extraction recipe was found. Problems hit, iterations, user feedback that redirected the approach, and mistakes worth not repeating. Use this when you want the *why* behind a selector choice.
- **[quick-reference.md](quick-reference.md)** — concise working code patterns. Endpoint URL, the three selectors that work, do/don't lists, verification checklist. Use this when you just need to get moving.
- **[test-results-1988964490.md](test-results-1988964490.md)** — benchmark data from "Uncertain Sons and Other Stories" (ASIN `1988964490`). Twelve extracted offers with prices, shipping, and totals; useful as a regression baseline.

## Key learnings (still valid)

1. **Total price ≠ item price.** A $15.99 item with $3.99 shipping is more expensive than a $19.99 item with free shipping. Sort on total, not item.
2. **API beats HTML scraping.** The `aodAjaxMain` endpoint is cleaner and more stable than scraping the offer-listing page — no ads, no recommendations, no nav chrome.
3. **Work up from prices, not down from containers.** Finding containers first is brittle; finding price nodes first and walking up the DOM is reliable.
4. **Use `innerText`, not `textContent`.** `textContent` pulls hidden CSS/JS text; `innerText` returns only visible text.
5. **Always verify visually.** Screenshot the offer listing and compare to extracted data before trusting a change.

## Known gaps

Extraction quality that is still partial, tracked against the FIS-23 roadmap rather than duplicated here:

- Seller extraction — needs `[id*="soldBy"]` resolution inside the offer container.
- Condition extraction — needs `#aod-offer-heading` extraction.
- Duplicate offers — needs dedup by (itemPrice, shippingCost, seller, condition).

These are Milestone B ("extraction parity, books only") in the FIS-23 plan.

## How to validate changes

1. Run the current offer-extraction script against the benchmark ASIN.
2. Confirm console output still shows 12 offers and a lowest total of $19.98.
3. Compare the rendered screenshot against `final-offers.json`.
4. Diff the new output against `test-results-1988964490.md` and flag any regressions.

---

**Last Updated:** 2026-04-18
**Scope:** books only, amazon.com only
**Roadmap:** deferred to the `FIS-23` plan
