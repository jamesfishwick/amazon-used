# How-to: find the cheapest copy of a book on your Amazon wishlist

Cheapest Read is a Chrome extension that reads your Amazon wishlist and, for every book on it, pulls the lowest available price across new and used offers so you do not have to click into each book's offer listing yourself. It runs only on `amazon.com` wishlist pages and only on physical books — Kindle and Audible editions are ignored.

This guide covers everyday usage **after** the extension is installed. If you have not installed it yet, start with [INSTALLATION.md](INSTALLATION.md).

## Before you start

You will need:

- Google Chrome, with Cheapest Read loaded (see [INSTALLATION.md](INSTALLATION.md)).
- An Amazon account on `amazon.com`, signed in in that same Chrome profile.
- At least one Amazon wishlist with physical books on it.

Non-book items (Kindle, Audible, music, video) and non-US Amazon storefronts (`amazon.ca`, `amazon.co.uk`) are out of scope. The extension will simply skip them.

## Walkthrough

1. **Open your wishlist.** In Chrome, go to `https://www.amazon.com/hz/wishlist/` and pick the wishlist you want to price-check. The URL should look like `https://www.amazon.com/hz/wishlist/ls/XXXXXXXXXX`.
2. **Wait for the page to finish loading.** Amazon loads wishlist rows lazily as you scroll — that is normal.
3. **Let the extension work.** As soon as the wishlist page is ready, Cheapest Read starts scanning in the background. You will briefly see a dark pill in the lower-right corner of the page that reads *"Price Checker Active"*; it fades out after a few seconds.
4. **Watch results appear inline, book by book.** For each book, a small result box is inserted directly underneath that book's existing price line, right on the wishlist row. While the book is being checked, a grey placeholder box shows *"Checking all prices..."*. Once the lookup finishes, that box turns yellow and displays the lowest-price summary described below.
5. **Scroll to load more.** As you scroll further down the wishlist, Amazon reveals more books and Cheapest Read picks those up automatically — you do not need to re-trigger it.
6. **Rescan if you want fresh numbers.** Click the Cheapest Read icon in the Chrome toolbar. When you are on a wishlist page, the popup shows *"On your Amazon wishlist. Prices auto-load as items appear."* and a **Rescan wishlist** button. Click it to re-check every visible book; the popup confirms *"Scanned N item(s)."* when it is done.

If you click the extension icon while you are **not** on a wishlist page, the popup instead shows *"Open your Amazon wishlist to see the lowest total prices."* and an **Open Amazon wishlist** button that takes you to `https://www.amazon.com/hz/wishlist/`.

While a scan is in progress, Cheapest Read briefly opens a background tab for each book to read that book's offer page. Those tabs appear in your tab strip and close themselves automatically once prices are captured — this is expected, not a bug. Do not close them manually, and do not interact with them; just let them finish.

## How to read the output

Each result box, shown inline under a wishlist item, contains:

- **Lowest price headline** — for example, *"Lowest Price: $7.42 (Used - Very Good)"*. The first value is the lowest price Cheapest Read found. The value in parentheses is the offer type (**New**, **Used**, or **Refurbished**) followed by, for used copies, the condition Amazon reports (*Like New*, *Very Good*, *Good*, or *Acceptable*). New and refurbished offers render without a trailing condition, e.g. *(New)* or *(Refurbished)*.
- **A link to Amazon's full offer listing** — labeled *"View all offers: ASIN XXXXXXXXXX"*. Click it to open Amazon's own "All offers" page for that book in a new tab, where you can pick which offer to buy.
- **The raw offer-listing URL**, shown in small grey text. This is the same destination as the link above; it is there so you can copy or share it.
- **Savings vs. the price Amazon currently shows on the wishlist** — for example, *"Save $3.56 vs current price ($10.98)"*. This line only appears when Cheapest Read actually found something cheaper than the price already listed on the wishlist row.
- **A `View all N prices` disclosure** — click it to expand a small table of every qualifying offer Cheapest Read found for that book, sorted cheapest first. Each row has three cells: the offer type (New / Used / Refurbished), the price, and the condition if Amazon reported one.

Two things to note about the table:

- **No seller name.** Cheapest Read does not surface the seller (for example, "Amazon Warehouse" or a specific third-party bookseller) next to each offer. To see who is actually selling a given offer, click **View all offers** and read it on Amazon's own page.
- **No "as of" timestamp.** Prices are live as of the most recent scan of that book. If you want to be sure a price is fresh, open the popup and click **Rescan wishlist** before buying.

If Cheapest Read could not pull any offers for a given book, that book's box will read *"Unable to fetch additional prices"*. That is usually a retryable failure — see the troubleshooting section.

## Troubleshooting

### I do not see any yellow result boxes on my wishlist

Check, in order:

1. **Is the URL correct?** The page has to be on `https://www.amazon.com/hz/wishlist/...`. Other Amazon sections (cart, home, search results) are out of scope, and `amazon.ca` / `amazon.co.uk` are out of scope entirely.
2. **Is the wishlist empty?** Cheapest Read only processes items that are actually on the page. An empty wishlist has nothing to price-check.
3. **Are you signed in to Amazon?** The extension reads offer pages by opening them in your own browser session. If you are signed out, Amazon may redirect those background tabs to a sign-in page and no prices will come back. Sign in, then reload the wishlist tab.
4. **Is Cheapest Read enabled?** Open `chrome://extensions/` and confirm the toggle for Cheapest Read is on. If you just enabled it, reload the wishlist tab.
5. **Reload the wishlist tab** and give the page a few seconds to finish loading before scrolling.

### The popup says *"Could not reach the page. Refresh the wishlist tab and try again."*

This usually means the wishlist tab was not fully loaded, or was reloaded after the extension was updated, so the extension's page-side script is no longer live on it. Refresh the wishlist tab in Chrome and click **Rescan wishlist** again.

### A small red banner appeared on the wishlist page that says "Extension Reloaded"

That means Chrome updated or reloaded Cheapest Read while you were on the wishlist tab. Refresh the wishlist tab to get a clean page-side script; the banner clears itself after about ten seconds.

### A book's result box says *"Unable to fetch additional prices"*

This can happen for a few reasons:

- **Amazon showed a "type the characters you see" challenge.** Amazon occasionally serves a captcha on offer-listing pages. If you see a background tab that is showing such a challenge, switch to it, solve it, close it, and click **Rescan wishlist** in the popup. This is specific to that book — other books in the list are unaffected.
- **There genuinely are no other sellers.** Amazon will say *"Currently, there are no other sellers"* on some offer pages, which Cheapest Read treats as zero usable offers.
- **The page took too long to load.** Cheapest Read waits up to 20 seconds per book for offers to appear, then gives up on that book. Click **Rescan wishlist** to retry.

### I see wishlist items without a result box at all

Cheapest Read is books-only. Non-book items (for example, Kindle editions, Audible titles, DVDs, vinyl) are skipped on purpose. If a physical book is being skipped, it may be because the wishlist row does not advertise a book format (*Hardcover*, *Paperback*, *Mass Market*) in its visible text; open the item on Amazon directly to check what format Amazon has it filed under.

### The scan is slower than I expected

Cheapest Read opens one background tab per book and waits for that book's offer page to finish loading. Long wishlists take longer. It also paces itself between books (roughly one and a half seconds between batches) to avoid being rate-limited by Amazon. This is expected; there is no way to speed it up from the UI.

## Related docs

- [INSTALLATION.md](INSTALLATION.md) — installing and updating the extension in dev mode.
- [README.md](README.md) — product scope and current limitations.
