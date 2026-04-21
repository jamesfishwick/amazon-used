# Installation Guide

Cheapest Read ships as a dev-mode Chrome extension during early access. You do **not** need to clone the repository, install Node, or run any command line tools. The steps below walk through downloading the packaged build and loading it into Chrome.

**Scope:** `amazon.com` only. Cheapest Read does not ship for `amazon.ca` or `amazon.co.uk`.

## Non-developer install (Load Unpacked in Dev Mode)

You will download a zip, unpack it into a folder, and point Chrome at that folder. Chrome will remember the folder between restarts, so keep it somewhere stable (for example, `~/Applications/cheapest-read-1.4.0`).

### 1. Download the extension zip

Download the latest release zip. Pick whichever source applies to you:

- **Early-access testers (D1):** the zip is attached to the Paperclip tracking ticket [FIS-40](/FIS/issues/FIS-40) as `cheapest-read-1.4.0.zip`.
- **Public release (once cut):** [cheapest-read-1.4.0.zip on GitHub releases](https://github.com/jamesfishwick/amazon-used/releases/tag/v1.4.0). This link becomes active after the `v1.4.0` tag is published; before then, use the Paperclip attachment.

### 2. Unzip the download

- **macOS:** double-click `cheapest-read-1.4.0.zip` in Finder. It will unpack to a folder named `cheapest-read-1.4.0` in the same location.
- **Windows:** right-click the zip → **Extract All...** → choose a destination.
- **Linux:** `unzip cheapest-read-1.4.0.zip -d cheapest-read-1.4.0`.

Move the unpacked folder somewhere you won't accidentally delete it. If you throw away this folder, Chrome will disable the extension.

### 3. Open Chrome's extensions page

1. Open Chrome.
2. In the address bar, type `chrome://extensions/` and press **Enter**.

### 4. Turn on Developer mode

In the top-right of the extensions page, flip the **Developer mode** toggle to **on**. A new row of buttons will appear: **Load unpacked**, **Pack extension**, **Update**.

### 5. Load the extension

1. Click **Load unpacked**.
2. In the file picker, select the **unpacked folder** (the one containing `manifest.json`), not the zip file and not a parent folder.
3. Click **Select** / **Open**.

Chrome will add a card labeled **Cheapest Read** version **1.4.0** to the extensions page. If you do not see the extension icon in the toolbar, click the puzzle-piece icon and pin **Cheapest Read**.

### 6. First scan

1. Sign in to `amazon.com` and open your wishlist (`https://www.amazon.com/hz/wishlist/...`).
2. Click the **Cheapest Read** icon in the Chrome toolbar.
3. The popup confirms you are on a wishlist and offers a **Rescan wishlist** button. Prices also auto-load inline as the page scrolls.
4. Review results sorted by total price (item + shipping).

## Updating to a newer version

1. Download the new zip from the releases page.
2. Unpack it into the same parent folder (you will get `cheapest-read-<new-version>`).
3. In `chrome://extensions/`, remove the old **Cheapest Read** card.
4. Click **Load unpacked** and select the new folder.

Chrome will carry over your stored debug-mode preference because the extension ID depends on the load path — keeping the install directory consistent avoids resetting state.

## Troubleshooting

**Chrome says "Manifest file is missing or unreadable".**
You picked a parent folder or the zip itself. Re-run step 5 and pick the folder that directly contains `manifest.json`.

**Extension installs but the icon does not appear on wishlist pages.**
Pin the extension from Chrome's puzzle-piece menu, then reload the wishlist tab.

**Clicking the icon shows "Open Amazon wishlist" instead of Rescan.**
You are not on a wishlist URL. Navigate to `amazon.com/hz/wishlist/...` and re-open the popup.

**A scan returns no prices.**
1. Confirm you are on `amazon.com/hz/wishlist/...`. Other hosts are out of scope.
2. Toggle **Debug Mode** from the extension UI and re-scan.
3. Review the debug log for per-ASIN fetch and parse output.
4. Reload the wishlist page and try again.

**Chrome disabled the extension after a restart.**
The unpacked folder moved or was deleted. Re-download the zip, unpack it, and run **Load unpacked** again against the new location.

## Developer mode install (from source)

Contributors working from a clone can skip the zip:

1. Clone the repository.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the `src/` directory (the one that contains `manifest.json`). Do not select the repository root.

To build a fresh zip locally, run `npm run build:zip`. The artifact is written to `dist/cheapest-read-<version>.zip` and contains only the runtime files from `src/` (`manifest.json`, `background.js`, `content.js`, `offers-content.js`, `popup.html`, `popup.js`, and `icons/`).
