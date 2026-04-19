const { chromium } = require('playwright');
const fs = require('fs');

const ASIN = '1988964490';

// Mirrors the wishlist UI renderer in content.js: returns labels like
// "(Used - Very Good)", "(New)", "(Refurbished)". Prefers "Used - <subgrade>"
// matches over bare subgrades so we don't echo the "Very Good" entry from
// the AOD filter sidebar instead of the actual offer condition (FIS-73).
function parseConditionLabel(text) {
  const subgradeMatch = text.match(/Used\s*-\s*(Like\s+New|Very\s+Good|Good|Acceptable)\b/i);
  if (subgradeMatch) {
    return { type: 'Used', condition: subgradeMatch[1].replace(/\s+/g, ' ').trim() };
  }
  const typeMatch = text.match(/\b(New|Refurbished|Collectible|Used)\b/);
  if (typeMatch) {
    return { type: typeMatch[1], condition: '' };
  }
  return { type: 'Unknown', condition: '' };
}

function renderConditionLabel({ type, condition }) {
  return `(${type}${condition ? ' - ' + condition : ''})`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Fetch the API response
  const apiUrl = `https://www.amazon.com/gp/product/ajax/aodAjaxMain/ref=auto_load_aod?asin=${ASIN}&pc=dp`;
  console.log(`\n📡 Fetching API: ${apiUrl}\n`);

  await page.goto(apiUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Save HTML for inspection
  const html = await page.content();
  fs.writeFileSync('api-response-rendered.html', html);
  console.log(`📄 Saved rendered HTML to api-response-rendered.html`);

  // Take screenshot for verification
  await page.screenshot({ path: 'screenshots/api-offers-simple.png', fullPage: true });

  // Try different price selectors
  console.log(`\n🔍 Checking different price selectors:\n`);

  const offscreenPrices = await page.$$('.a-price .a-offscreen');
  console.log(`   .a-price .a-offscreen: ${offscreenPrices.length}`);

  const wholePrices = await page.$$('.a-price-whole');
  console.log(`   .a-price-whole: ${wholePrices.length}`);

  const spanPrices = await page.$$('span.a-price span[aria-hidden="true"]');
  console.log(`   span.a-price span[aria-hidden="true"]: ${spanPrices.length}`);

  // Use the aria-hidden selector which shows the visible price
  const priceElements = spanPrices.length > 0 ? spanPrices : offscreenPrices;
  console.log(`\n   Using: ${priceElements.length} price elements\n`);

  const offers = [];

  for (let i = 0; i < priceElements.length; i++) {
    const priceEl = priceElements[i];
    const priceText = await priceEl.textContent();
    const itemPrice = parseFloat(priceText.replace(/[$,]/g, ''));

    console.log(`Price ${i + 1}: "${priceText}" -> ${itemPrice}`);

    if (isNaN(itemPrice) || itemPrice === 0) {
      console.log(`   ⏭️  Skipped (NaN or zero)`);
      continue;
    }

    // Get the parent container for this price
    // Find the closest div with ID that includes "aod-offer" or similar pattern
    const offerContainer = await priceEl.evaluateHandle(node => {
      let current = node;
      let bestCandidate = null;

      // Go up the DOM tree
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

    const container = offerContainer.asElement();
    // Use innerText instead of textContent to exclude <style> and <script> tags
    const fullText = await container.evaluate(el => el.innerText || el.textContent);

    // Extract shipping cost
    let shippingCost = 0;
    let shippingText = 'Unknown';

    const shippingMatch = fullText.match(/\$\s*([\d,]+\.?\d*)\s+(?:shipping|delivery)/i);
    if (shippingMatch) {
      shippingCost = parseFloat(shippingMatch[1].replace(',', ''));
      shippingText = `$${shippingCost.toFixed(2)}`;
    } else if (fullText.toLowerCase().includes('free shipping') ||
               fullText.toLowerCase().includes('free delivery')) {
      shippingCost = 0;
      shippingText = 'FREE';
    }

    const totalPrice = itemPrice + shippingCost;

    // Extract condition as the same rendered label users see in the wishlist UI
    // (e.g. "(Used - Very Good)") rather than a bare subgrade lifted from the
    // AOD filter sidebar.
    const condition = renderConditionLabel(parseConditionLabel(fullText));

    // Extract seller - try to find soldBy element directly
    let seller = 'Unknown';
    const sellerEl = await container.$('[id*="soldBy"]');
    if (sellerEl) {
      const sellerText = await sellerEl.evaluate(el => el.innerText || el.textContent);
      const sellerMatch = sellerText.match(/(?:Sold by|Ships from and sold by)\s+(.+)/i);
      if (sellerMatch) {
        seller = sellerMatch[1]
          .trim()
          .split('\n')[0] // Take first line only
          .replace(/\s*Seller.*$/, '') // Remove "Seller rating" suffix
          .substring(0, 50);
      }
    }

    // Fallback: try parsing from fullText
    if (seller === 'Unknown') {
      const sellerMatch = fullText.match(/(?:Sold by|Ships from and sold by)\s+([^\n]+)/i);
      if (sellerMatch) {
        seller = sellerMatch[1].trim().substring(0, 50);
      }
    }

    // Debug first 3 offers to see what text we're getting
    if (i < 3) {
      console.log(`   Text snippet (${fullText.length} chars): ${fullText.substring(0, 300).replace(/\n/g, ' ').replace(/\s+/g, ' ')}`);
    }

    offers.push({
      itemPrice,
      shippingCost,
      totalPrice,
      shippingText,
      condition,
      seller
    });

    console.log(`${i + 1}. Item: $${itemPrice.toFixed(2)} + Shipping: ${shippingText} = Total: $${totalPrice.toFixed(2)}`);
    console.log(`   Condition: ${condition}`);
    console.log(`   Seller: ${seller}`);
    console.log();
  }

  // Sort by total price
  offers.sort((a, b) => a.totalPrice - b.totalPrice);

  // Display sorted results
  console.log(`${'='.repeat(80)}`);
  console.log(`FINAL RESULTS (sorted by total price)`);
  console.log(`${'='.repeat(80)}\n`);

  offers.forEach((offer, i) => {
    console.log(`${i + 1}. TOTAL: $${offer.totalPrice.toFixed(2)} = Item: $${offer.itemPrice.toFixed(2)} + Shipping: ${offer.shippingText}`);
    console.log(`   Condition: ${offer.condition} | Seller: ${offer.seller}`);
    console.log();
  });

  // Save results
  fs.writeFileSync('final-offers.json', JSON.stringify(offers, null, 2));
  console.log(`✅ Saved ${offers.length} offers to final-offers.json`);

  const summary = [
    `Amazon Offers - ASIN: ${ASIN}`,
    `Book: Uncertain Sons and Other Stories`,
    ``,
    `Total offers found: ${offers.length}`,
    ``,
    ...offers.map((offer, i) => {
      return `${i + 1}. $${offer.totalPrice.toFixed(2)} TOTAL (Item: $${offer.itemPrice.toFixed(2)} + Shipping: ${offer.shippingText})\n   ${offer.condition} - ${offer.seller}\n`;
    })
  ].join('\n');

  fs.writeFileSync('final-offers-summary.txt', summary);
  console.log(`✅ Saved summary to final-offers-summary.txt`);

  if (offers.length > 0) {
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total offers: ${offers.length}`);
    console.log(`   Lowest total price: $${offers[0].totalPrice.toFixed(2)} (${offers[0].condition})`);
    console.log(`   Highest total price: $${offers[offers.length - 1].totalPrice.toFixed(2)} (${offers[offers.length - 1].condition})`);
  }

  await browser.close();
}

main();
