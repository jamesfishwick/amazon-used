const { chromium } = require('playwright');
const fs = require('fs');

const ASIN = '1988964490';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  const url = `https://www.amazon.com/dp/${ASIN}/ref=olp-opf-redir?aod=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Target the specific divs that contain offer prices
  // These have patterns like: aod-offer, aod-offer-1, aod-offer-2, etc
  const offerDivs = await page.$$('div[id^="aod-offer-"][id$="-soldBy"]');

  console.log(`\nFound ${offerDivs.length} actual offer containers\n`);

  const prices = [];

  for (const offerDiv of offerDivs) {
    // Get the parent container
    const parent = await offerDiv.evaluateHandle(el => {
      // Go up to find the main offer container
      let container = el;
      while (container && !container.getAttribute('id')?.match(/^aod-offer-\d+$/)) {
        container = container.parentElement;
        if (!container || container.tagName === 'BODY') break;
      }
      return container || el.closest('[class*="offer"]');
    });

    const containerText = await parent.evaluate(el => el ? el.textContent : '');

    // Find price within this container
    const priceEl = await parent.$('.a-price .a-offscreen');
    const price = priceEl ? await priceEl.textContent() : null;

    // Find shipping
    const shippingMatch = containerText.match(/\$?([\d.]+)\s+shipping/i) ||
                         containerText.match(/FREE\s+(?:shipping|delivery)/i);
    const shipping = shippingMatch ?
      (shippingMatch[0].includes('FREE') ? 'FREE' : `$${shippingMatch[1]}`) :
      'Unknown';

    // Find seller
    const sellerMatch = containerText.match(/Sold by\s+([\w\s.-]+)/i);
    const seller = sellerMatch ? sellerMatch[1].trim() : 'Unknown';

    // Find condition
    const conditionMatch = containerText.match(/(New|Used|Refurbished)/i);
    const condition = conditionMatch ? conditionMatch[1] : 'Unknown';

    if (price) {
      console.log(`Price: ${price} | Shipping: ${shipping} | Seller: ${seller} | Condition: ${condition}`);
      prices.push({ price, shipping, seller, condition });
    }
  }

  // Alternative approach: Find all price divs directly
  console.log(`\n--- Alternative: Direct price div approach ---\n`);

  // Look for the main offer list container
  const offerListContainer = await page.$('#aod-offer-list');

  if (offerListContainer) {
    // Find all divs that look like main offer containers (not sub-components)
    const offerCards = await offerListContainer.$$('div[id^="aod-offer-"]:not([id*="heading"]):not([id*="price"]):not([id*="qty"])');

    console.log(`Found ${offerCards.length} offer cards\n`);

    for (let i = 0; i < Math.min(offerCards.length, 10); i++) {
      const card = offerCards[i];
      const text = await card.textContent();

      // Only process if it looks like a full offer (has price and seller info)
      if (text.includes('$') && (text.includes('Sold by') || text.includes('Ships from'))) {
        const priceEl = await card.$('.a-price .a-offscreen');
        const price = priceEl ? await priceEl.textContent() : null;

        if (price) {
          const shippingMatch = text.match(/\$?([\d.]+)\s+shipping/i);
          const shipping = shippingMatch ? `$${shippingMatch[1]}` :
                          (text.toLowerCase().includes('free') ? 'FREE' : 'Unknown');

          console.log(`Offer ${i + 1}: ${price} (Shipping: ${shipping})`);
        }
      }
    }
  }

  // Save screenshot
  await page.screenshot({ path: 'screenshots/price-extraction-debug.png', fullPage: true });
  console.log(`\n📸 Screenshot saved`);

  await page.waitForTimeout(30000);
  await browser.close();
}

main();
