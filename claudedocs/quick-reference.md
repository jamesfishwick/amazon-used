# Quick Reference - Amazon Offers API

## The Working Solution (As of 2025-10-17)

### API Endpoint
```
https://www.amazon.com/gp/product/ajax/aodAjaxMain/ref=auto_load_aod?asin={ASIN}&pc=dp
```

### Complete Working Code Pattern

```javascript
const { chromium } = require('playwright');

const ASIN = '1988964490';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  // 1. Fetch API endpoint
  const apiUrl = `https://www.amazon.com/gp/product/ajax/aodAjaxMain/ref=auto_load_aod?asin=${ASIN}&pc=dp`;
  await page.goto(apiUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Important! Wait for dynamic content

  // 2. Find all price elements (this is your anchor point)
  const priceElements = await page.$$('span.a-price span[aria-hidden="true"]');

  const offers = [];

  // 3. For each price, work backwards to find its container
  for (const priceEl of priceElements) {
    // Parse price
    const priceText = await priceEl.textContent();
    const itemPrice = parseFloat(priceText.replace(/[$,]/g, ''));

    if (isNaN(itemPrice) || itemPrice === 0) continue;

    // Find container
    const container = await priceEl.evaluateHandle(node => {
      let current = node;
      while (current.parentElement) {
        current = current.parentElement;
        const id = current.getAttribute('id');

        if (id && id.match(/^(aod-offer|pinned-offer)/)) {
          return current;
        }

        const text = current.textContent;
        if (text.length > 100 && text.length < 3000 &&
            (text.includes('Sold by') || text.includes('Ships from'))) {
          return current;
        }
      }
      return current;
    });

    // Get text (use innerText, not textContent!)
    const fullText = await container.asElement().evaluate(el => el.innerText);

    // Extract shipping
    let shippingCost = 0;
    const shippingMatch = fullText.match(/\$\s*([\d,]+\.?\d*)\s+(?:shipping|delivery)/i);
    if (shippingMatch) {
      shippingCost = parseFloat(shippingMatch[1].replace(',', ''));
    } else if (fullText.toLowerCase().includes('free shipping')) {
      shippingCost = 0;
    }

    const totalPrice = itemPrice + shippingCost;

    offers.push({ itemPrice, shippingCost, totalPrice });
  }

  // 4. Sort by total price (this is what users see!)
  offers.sort((a, b) => a.totalPrice - b.totalPrice);

  console.log(`Lowest total price: $${offers[0].totalPrice.toFixed(2)}`);

  await browser.close();
}
```

## Critical Success Factors

### ✅ DO
- Use API endpoint, not main product page
- Start from price elements, work backwards to containers
- Use `innerText` to exclude CSS/scripts
- Calculate total price (item + shipping)
- Sort by total price, not item price
- Wait 2+ seconds after page load
- Use selector: `span.a-price span[aria-hidden="true"]`
- Save screenshots for verification

### ❌ DON'T
- Scrape main product page HTML
- Use `textContent` (includes CSS/JS)
- Trust selectors without validation
- Only look at item prices (shipping matters!)
- Skip the 2-second wait
- Assume containers have predictable IDs
- Trust first working result without verification

## The Three Working Selectors

```javascript
// Best for price extraction
const prices = await page.$$('span.a-price span[aria-hidden="true"]');

// Alternative (works but has whitespace issues)
const pricesAlt = await page.$$('.a-price .a-offscreen');

// For shipping detection in text
const shippingMatch = text.match(/\$\s*([\d,]+\.?\d*)\s+(?:shipping|delivery)/i);
```

## Expected Results for ASIN 1988964490

```
Total offers: 12
Price range: $19.98 - $34.06
Lowest: $19.98 ($15.99 item + $3.99 shipping)

Common shipping costs: FREE, $3.99, $0.44
Common conditions: New, Used - Good, Used - Like New
```

## Verification Checklist

- [ ] Found 12 prices
- [ ] Lowest total is $19.98
- [ ] Screenshot matches extracted prices
- [ ] Shipping costs look reasonable (FREE or $3-4)
- [ ] Total = Item + Shipping for all offers
- [ ] No CSS/JS noise in text output

## Files to Run

```bash
# Current working script
node parse-api-simple.js

# Output files
final-offers.json           # Structured data
final-offers-summary.txt    # Human readable
screenshots/api-offers-simple.png  # Visual verification
```

## Still TODO (Known Issues)

1. **Seller extraction** - Currently all showing "Unknown"
   - Need to find correct `[id*="soldBy"]` element selector

2. **Condition extraction** - Only finding some conditions
   - Likely in `#aod-offer-heading` element

3. **Deduplication** - Some pinned offers appear twice
   - Filter by unique (price + shipping + seller + condition)

## Common Debugging Commands

```javascript
// Count elements
console.log(`Found ${elements.length} elements`);

// Show text snippet
console.log(`Text: ${text.substring(0, 200)}`);

// Compare selectors
const a = await page.$$('.selector-a');
const b = await page.$$('.selector-b');
console.log(`A: ${a.length}, B: ${b.length}`);

// Save for inspection
await page.screenshot({ path: 'debug.png', fullPage: true });
fs.writeFileSync('debug.html', await page.content());
```

## Integration Path

When ready to integrate into extension:

1. Replace `offers-content.js` scraping logic
2. Keep format detection (Kindle, etc.)
3. Use same API endpoint approach
4. Cache responses to avoid repeated requests
5. Test with music, video, apparel ASINs

## Key Insight

**Total Price > Item Price**

The lowest item price ($15.99) is NOT the lowest total price ($19.98 with shipping).
Always calculate and compare totals!
