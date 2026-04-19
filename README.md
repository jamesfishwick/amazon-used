# Cheapest Read

Chrome extension that scans your Amazon wishlist and surfaces the **lowest total price** (item + shipping) across new and used offers for every book on the list.

## Scope

- **Books only.** Physical books on `amazon.com`. Kindle and Audible offers are filtered out. Music (vinyl/CD/cassette) and video (DVD/Blu-ray) are out of scope; any remaining code paths for those formats are being removed.
- **amazon.com only.** `.ca` and `.co.uk` are being dropped from the manifest until we have real test coverage for them.
- **Wishlist page only.** The scan entry point is the extension icon on `amazon.com/hz/wishlist/*`.

## What it does today

- Reads ASINs from the wishlist page.
- Fetches offers per book against the `aodAjaxMain` AJAX endpoint.
- Parses item price, shipping cost, and total price; sorts by total.
- Filters out digital (Kindle/Audible) offers.
- Persists scan results via `chrome.storage`; supports a debug mode toggle.

## Known issues

- **The popup is currently broken.** Clicking the extension icon hits an archived page. Tracked as `FIS-33` (popup P0). See [INSTALLATION.md](INSTALLATION.md) for the temporary workaround.
- Seller extraction, condition extraction, and duplicate-offer dedup are partial. Tracked in the FIS-23 roadmap.

## Install

See [INSTALLATION.md](INSTALLATION.md).

## Use

See [HOWTO-CHEAPEST-COPY.md](HOWTO-CHEAPEST-COPY.md) for the end-user walkthrough: opening your wishlist, reading the inline result boxes, and troubleshooting common failure modes.

## Develop

See [DEVELOPMENT.md](DEVELOPMENT.md) for the dev workflow and project layout. Deep technical notes on the offers endpoint, DOM selectors, and extraction recipe live in [claudedocs/](claudedocs/README.md).

## Contributing / Release

See [RELEASE-WORKFLOW.md](RELEASE-WORKFLOW.md) for the canonical chain from PR to verified release (owners, prereqs, and skip-paths for hotfixes / non-release / doc-only PRs).

## Roadmap

The canonical roadmap is the `FIS-23` plan (Milestones A–D: stabilize + narrow scope, extraction parity, harden for daily use, distribution). This README does not duplicate it — if the plan and this doc disagree, the plan wins.
