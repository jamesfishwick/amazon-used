# Installation Guide

Cheapest Read currently ships dev-mode only. A packaged dev-mode build and a non-developer walkthrough are tracked in `FIS-40` (Distribution D1). Until that ticket lands, use the developer-mode steps below.

**Scope:** `amazon.com` only. Cheapest Read does not ship for `amazon.ca` or `amazon.co.uk`.

## Developer mode install

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select **the root of this cloned repository** — the directory that contains `manifest.json`. There is no `src/` subdirectory.

Chrome will register the extension with the name declared in `manifest.json`.

## Usage

1. Sign in to `amazon.com` and open your wishlist (`https://www.amazon.com/hz/wishlist/...`).
2. Click the extension icon in the Chrome toolbar.
3. The popup confirms you are on a wishlist and offers a "Rescan wishlist" button; prices also auto-load inline as the page scrolls.
4. Review results sorted by total price (item + shipping).

## Troubleshooting

If a scan returns no results:

1. Confirm you are on `amazon.com/hz/wishlist/...` (other hosts are out of scope).
2. Toggle Debug Mode from the extension UI and re-scan.
3. Review the debug log for per-ASIN fetch and parse output.
4. Reload the wishlist page and try again.
