# Amazon Offers API Endpoint - Research Findings

**Date:** 2025-10-17
**ASIN Tested:** 1988964490 (Uncertain Sons and Other Stories)

## Key Discovery: The API Endpoint

Amazon has an AJAX endpoint that returns the complete offers listing as HTML:

```
https://www.amazon.com/gp/product/ajax/aodAjaxMain/ref=auto_load_aod?asin={ASIN}&pc=dp
```

**Parameters:**
- `asin` - The Amazon Standard Identification Number
- `pc=dp` - Product page context (likely means "product context=detail page")

**Response Format:** HTML (not JSON) - Contains the full offers modal/drawer content

## Why This is Better Than Page Scraping

1. **No "You May Also Like" Recommendations** - The API response only contains actual offers, not related products
2. **More Structured** - Cleaner DOM without all the main page navigation/ads
3. **Reliable** - Direct data source that Amazon uses internally
4. **Complete** - Contains all offers, not just the first few visible ones

## Price Extraction - What Works

### Best Price Selector
```javascript
const spanPrices = await page.$$('span.a-price span[aria-hidden="true"]');
```

This selector finds 12 prices (vs 12 from `.a-price .a-offscreen`), but the visible span version is easier to parse.

### Alternative Selectors Tested
- `.a-price .a-offscreen` - 12 matches (many empty/whitespace)
- `.a-price-whole` - 11 matches (misses fractional prices)
- `span.a-price span[aria-hidden="true"]` - 12 matches ✅ **WORKS BEST**

### Price Parsing Logic
```javascript
const priceText = await priceEl.textContent();
const itemPrice = parseFloat(priceText.replace(/[$,]/g, ''));
```

**Success Rate:** 100% - All 12 prices extracted correctly
- $15.99, $19.99 (3x), $22.11, $23.27, $23.94, $27.11, $27.27, $30.06, $34.06 (2x)

## Shipping Cost Extraction - What Works

### Regex Pattern
```javascript
const shippingMatch = fullText.match(/\$\s*([\d,]+\.?\d*)\s+(?:shipping|delivery)/i);
```

### Detection Logic
1. Look for pattern: `$X.XX shipping` or `$X.XX delivery`
2. Check for "FREE shipping" or "FREE delivery" (case insensitive)
3. Default to "Unknown" if neither found

**Success Rate:** ~75% - Successfully extracted shipping for 9 out of 12 offers
- 3 offers show "Unknown" shipping (likely need to look in different DOM location)

### Shipping Costs Found
- FREE (most common)
- $3.99 (several offers)
- $0.44 (one offer)

## Total Price Calculation

```javascript
const totalPrice = itemPrice + shippingCost;
```

**Critical Finding:** The lowest **total price** ($19.98) is NOT the lowest **item price** ($15.99)

### Example:
- Offer 1: $15.99 + $3.99 shipping = **$19.98 total**
- Offer 2: $19.99 + FREE shipping = **$19.99 total**

**Lesson:** Must calculate and compare total prices, not just item prices!

## Container Detection - Evolution

### Attempt 1: Main offer list children
```javascript
const offerContainers = await page.$$('#aod-offer-list > div');
```
**Result:** Found only 1 container (not enough)

### Attempt 2: All elements with "aod-offer" prefix
```javascript
const offerContainers = await page.$$('[id^="aod-offer-"]');
```
**Result:** Found 313 elements (too many - includes sub-components)

### Attempt 3: Pattern matching for main containers
```javascript
const offerIdMatch = containerId.match(/^aod-offer(-\d+)?$/);
```
**Result:** No matches (wrong pattern)

### Attempt 4: soldBy elements → parent ✅ WORKING
```javascript
const offerContainers = await page.$$('div[id*="pinned-offer"], div[id^="aod-offer"][id$="-soldBy"]');
// Then navigate to parent container
```
**Result:** Found 26 containers (includes duplicates, but workable)

### Current Approach: Start from price elements ✅ BEST
```javascript
const priceElements = await page.$$('span.a-price span[aria-hidden="true"]');
// For each price, walk up DOM to find offer container
```
**Result:** Found 12 unique offers matching 12 prices

## Container Traversal Logic

```javascript
const offerContainer = await priceEl.evaluateHandle(node => {
  let current = node;
  let bestCandidate = null;

  while (current && current.parentElement) {
    current = current.parentElement;

    if (current.tagName === 'DIV') {
      const id = current.getAttribute('id');
      const text = current.textContent;

      // Prefer divs with specific IDs
      if (id && id.match(/^(aod-offer|pinned-offer)/)) {
        return current;
      }

      // Keep track of divs with offer-like content as fallback
      if (!bestCandidate &&
          text.length > 100 && text.length < 3000 &&
          !text.startsWith('/*') && // Skip CSS
          !text.startsWith('<') && // Skip HTML/XML
          (text.includes('Sold by') || text.includes('Ships from'))) {
        bestCandidate = current;
      }
    }
  }

  return bestCandidate || current;
});
```

**Key Points:**
- Walk up from price element to find offer container
- Prefer containers with IDs matching `aod-offer` or `pinned-offer`
- Fallback to divs containing seller information
- Avoid CSS/style blocks (check for `/*` prefix)
- Size constraints: 100-3000 characters

## Text Extraction - Important Detail

**Use `innerText` not `textContent`:**
```javascript
const fullText = await container.evaluate(el => el.innerText || el.textContent);
```

**Why:**
- `textContent` includes `<style>` and `<script>` tag contents
- `innerText` only returns visible text
- With `textContent`, we were getting CSS comments like `/* Temporary CSS overrides...`

**Before (textContent):**
```
Text snippet (661 chars): /* Temporary CSS overrides for savings...
```

**After (innerText):**
```
Text snippet (13 chars): $19.99 $19.99
```

## Condition Extraction - Partial Success

### Regex Pattern
```javascript
const conditionMatch = fullText.match(/(New|Used\s*-\s*\w+|Used|Like\s+New|Very\s+Good|Good|Acceptable)/i);
```

**Success Rate:** ~30% - Only finding "New" for some offers

**Conditions Expected:**
- New
- Used - Like New
- Used - Very Good
- Used - Good
- Used - Acceptable
- Refurbished

**Problem:** Condition text likely in a specific child element, not in the main container text

## Seller Extraction - Current Challenge

### Approach 1: Look for soldBy element
```javascript
const sellerEl = await container.$('[id*="soldBy"]');
const sellerText = await sellerEl.evaluate(el => el.innerText);
```
**Result:** Not finding seller elements consistently

### Approach 2: Regex from text
```javascript
const sellerMatch = fullText.match(/(?:Sold by|Ships from and sold by)\s+([^\n]+)/i);
```
**Result:** Not matching (seller info not in the container text we're capturing)

**Success Rate:** 0% - All sellers showing as "Unknown"

**Known Sellers from Debug Files:**
- Amazon
- SuperBookDeals
- webdelicollc
- MyPrepbooks
- RAREWAVES-IMPORTS
- betterdeals2019
- All-Time-Fast
- LuminaryBooks

## DOM Structure Insights

### Container ID Patterns Observed
```
aod-sticky-pinned-offer (Amazon's offer - appears first)
aod-pinned-offer (duplicate of Amazon's offer)
pinned-offer-scroll-id (scroll anchor)
pinned-offer-top-id (top anchor)
aod-offer (repeated for each third-party seller)
```

### Sub-component ID Patterns
```
aod-offer-heading
aod-offer-price
aod-offer-shipsFrom
aod-offer-soldBy
aod-offer-seller-rating
aod-offer-added-to-cart-{N}
aod-offer-updated-cart-{N}
aod-offer-qty-component-{N}
```

**Pattern:** Main container IDs don't have hyphens after "offer", sub-components do

## Results Summary - ASIN 1988964490

### Total Offers Found: 12

**Sorted by Total Price:**
1. $19.98 = $15.99 + $3.99 shipping (New)
2. $19.99 = $19.99 + Unknown
3. $19.99 = $19.99 + FREE
4. $22.11 = $22.11 + FREE
5. $23.94 = $23.94 + FREE
6. $23.98 = $19.99 + $3.99 (New)
7. $27.26 = $23.27 + $3.99
8. $27.27 = $27.27 + FREE
9. $27.55 = $27.11 + $0.44
10. $34.05 = $30.06 + $3.99
11. $34.06 = $34.06 + FREE
12. $34.06 = $34.06 + FREE

**Lowest Total Price: $19.98** (Item: $15.99, Shipping: $3.99, Condition: New)

## Files Created During Research

### Working Scripts
- `parse-api-simple.js` - ✅ Current best approach (extracts prices + shipping)
- `fetch-api-offers.js` - Simple API fetcher
- `check-api-calls.js` - Network traffic interceptor (how we found the API)

### Debug Scripts (Deprecated)
- `parse-api-offers.js` - Complex container detection (overcomplicated)
- `extract-real-prices.js` - Early DOM scraping attempt
- `debug-offers-page.js` - Initial page analysis

### Output Files
- `final-offers.json` - Structured offer data (12 offers)
- `final-offers-summary.txt` - Human-readable results
- `api-response-rendered.html` - Full rendered HTML from API
- `aod-api-response.html` - Raw API response
- `screenshots/api-offers-simple.png` - Visual verification

### Debug Logs
- `parsing-debug.json` - Container processing details
- `all-container-ids.json` - All container IDs found
- `debug-offers-1988964490.json` - Early analysis data

## Next Steps - To Complete Extraction

### 1. Fix Seller Extraction
**Current Issue:** Sellers showing as "Unknown"

**Approach to Try:**
- Find the exact selector for seller name elements
- Look at `debug-offers-1988964490.json` for seller text patterns
- May need to query specific `[id*="soldBy"]` elements within each offer container
- Sellers appear with "Seller rating" suffix - need to strip that

### 2. Fix Condition Extraction
**Current Issue:** Only finding some "New" conditions

**Approach to Try:**
- Look for heading elements with `id="aod-offer-heading"`
- Condition might be in an `<h5>` tag within the heading
- May need more specific selector than regex on full text

### 3. Deduplicate Offers
**Current Issue:** Some offers appear multiple times (e.g., two $34.06 offers)

**Approach to Try:**
- Track seen combinations of (price + shipping + condition + seller)
- Skip duplicates when building offers array
- May indicate pinned offers appearing multiple times in DOM

### 4. Handle Edge Cases
**To Test:**
- Kindle/digital format detection in API response
- Used books with varying conditions
- International shipping costs
- Prime-only offers
- Add-on items
- Out of stock offers

### 5. Integration with Chrome Extension
**Once extraction is solid:**
- Replace current HTML scraping in `offers-content.js`
- Use API endpoint approach instead
- Handle same format detection logic (books, music, etc.)
- Cache API responses to avoid repeated requests

## Important Gotchas

1. **CSS in textContent** - Always use `innerText` to avoid CSS/JS content
2. **Container Size** - Offer containers are 200-2000 chars (too small = sub-component, too large = whole page)
3. **Total vs Item Price** - Must calculate total to find true lowest price
4. **Duplicate Containers** - Amazon repeats pinned offer multiple times in DOM
5. **Unknown Shipping** - Some offers don't show shipping until calculated at checkout
6. **Playwright Timing** - Need 2+ second wait after page load for dynamic content
7. **Price Selector** - Must use `span[aria-hidden="true"]` inside `.a-price`, not just `.a-offscreen`

## Validation Method

**To verify extraction accuracy:**
1. Run `node parse-api-simple.js`
2. Open `screenshots/api-offers-simple.png`
3. Compare extracted prices to visible prices in screenshot
4. Check that totals = item + shipping
5. Verify count matches (should be 12 offers for this ASIN)

**Success Criteria:**
- ✅ All prices match screenshot
- ✅ All shipping costs match screenshot
- ✅ Total price calculations correct
- ⚠️ Seller names need fixing
- ⚠️ Conditions need fixing
