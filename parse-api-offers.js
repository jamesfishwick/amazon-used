const { chromium } = require('playwright');
const fs = require('fs');

const ASIN = '1988964490';

function isDigitalFormat(text) {
  const lowerText = text.toLowerCase();
  return lowerText.includes('kindle') ||
         lowerText.includes('ebook') ||
         lowerText.includes('e-book') ||
         lowerText.includes('audiobook') ||
         lowerText.includes('audible') ||
         lowerText.includes('mp3 cd') ||
         lowerText.includes('digital');
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

  // Take screenshot for verification
  await page.screenshot({ path: 'screenshots/api-offers-full.png', fullPage: true });
  console.log(`📸 Screenshot saved to screenshots/api-offers-full.png`);

  // Try to find offer containers by looking for divs with IDs that contain "pinned-offer" or numbered patterns
  // Amazon uses patterns like: aod-offer, aod-offer-1, aod-offer-2, etc OR pinned-offer divs
  const offerContainers = await page.$$('div[id*="pinned-offer"], div[id^="aod-offer"][id$="-soldBy"]').then(async (elements) => {
    // For soldBy elements, get their parent containers
    const parents = [];
    for (const el of elements) {
      const parent = await el.evaluateHandle(node => {
        // Go up to find the main offer container
        let current = node;
        while (current && current.parentElement) {
          const id = current.getAttribute('id');
          // Look for container with pattern like div with significant content
          if (id && (id.match(/^aod-offer-\d+$/) || id === 'aod-offer' || id.includes('pinned-offer'))) {
            return current;
          }
          // Or find a div that contains both price and seller info
          const hasPrice = current.querySelector('.a-price');
          const hasSeller = current.querySelector('[id*="soldBy"]');
          if (hasPrice && hasSeller && current.textContent.length > 200) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      });
      const parentEl = parent.asElement();
      if (parentEl) parents.push(parentEl);
    }
    return parents;
  });

  console.log(`\n🔍 Found ${offerContainers.length} offer containers\n`);

  const offers = [];
  const detailedLog = [];
  const allContainerIds = [];

  for (let i = 0; i < offerContainers.length; i++) {
    const container = offerContainers[i];
    const containerId = await container.getAttribute('id');
    allContainerIds.push(containerId || `no-id-${i}`);

    const fullText = await container.textContent();

    // Skip if this container doesn't have meaningful content
    if (!fullText || fullText.trim().length < 50) {
      detailedLog.push({
        index: i,
        containerId: containerId || 'no-id',
        skipped: true,
        reason: 'Too little text content',
        textLength: fullText ? fullText.length : 0
      });
      continue;
    }

    // Skip if this looks like a digital format
    if (isDigitalFormat(fullText)) {
      detailedLog.push({
        index: i,
        containerId: containerId || 'no-id',
        skipped: true,
        reason: 'Digital format detected',
        snippet: fullText.substring(0, 100)
      });
      continue;
    }

    // Extract price
    const priceEl = await container.$('.a-price .a-offscreen');
    if (!priceEl) {
      detailedLog.push({
        index: i,
        containerId: containerId || 'no-id',
        skipped: true,
        reason: 'No price element found',
        snippet: fullText.substring(0, 100)
      });
      continue;
    }

    const priceText = await priceEl.textContent();
    const itemPrice = parseFloat(priceText.replace(/[$,]/g, ''));

    // Extract shipping cost
    let shippingCost = 0;
    let shippingText = 'Unknown';

    const shippingMatch = fullText.match(/\+\s*\$?([\d,]+\.?\d*)\s+(?:shipping|delivery)/i);
    if (shippingMatch) {
      shippingCost = parseFloat(shippingMatch[1].replace(',', ''));
      shippingText = `$${shippingCost.toFixed(2)}`;
    } else if (fullText.toLowerCase().includes('free shipping') ||
               fullText.toLowerCase().includes('free delivery')) {
      shippingCost = 0;
      shippingText = 'FREE';
    }

    const totalPrice = itemPrice + shippingCost;

    // Extract condition
    let condition = 'Unknown';
    const conditionMatch = fullText.match(/(New|Used\s*-\s*\w+|Used|Like\s+New|Very\s+Good|Good|Acceptable|Refurbished)/i);
    if (conditionMatch) {
      condition = conditionMatch[1].trim();
    }

    // Extract seller
    let seller = 'Unknown';
    const sellerMatch = fullText.match(/(?:Sold\s+by|Ships\s+from\s+and\s+sold\s+by)\s+([^\n]+?)(?:\n|$|\.)/i);
    if (sellerMatch) {
      seller = sellerMatch[1].trim()
        .replace(/\s+/g, ' ')
        .replace(/\.$/, '')
        .substring(0, 50); // Limit length
    }

    offers.push({
      itemPrice,
      shippingCost,
      totalPrice,
      shippingText,
      condition,
      seller,
      containerId: containerId || `no-id-${i}`,
      index: i
    });

    detailedLog.push({
      index: i,
      containerId: containerId || 'no-id',
      extracted: true,
      itemPrice: `$${itemPrice.toFixed(2)}`,
      shipping: shippingText,
      totalPrice: `$${totalPrice.toFixed(2)}`,
      condition,
      seller,
      textSnippet: fullText.substring(0, 200).replace(/\n/g, ' ')
    });
  }

  // Sort by total price
  offers.sort((a, b) => a.totalPrice - b.totalPrice);

  // Display results
  console.log(`${'='.repeat(80)}`);
  console.log(`EXTRACTED OFFERS (sorted by total price)`);
  console.log(`${'='.repeat(80)}\n`);

  offers.forEach((offer, i) => {
    console.log(`${i + 1}. Total: $${offer.totalPrice.toFixed(2)} = Item: $${offer.itemPrice.toFixed(2)} + Shipping: ${offer.shippingText}`);
    console.log(`   Condition: ${offer.condition}`);
    console.log(`   Seller: ${offer.seller}`);
    console.log(`   Container: ${offer.containerId}`);
    console.log();
  });

  if (offers.length === 0) {
    console.log(`⚠️  NO OFFERS FOUND - Check detailed log for debugging\n`);
  }

  // Save detailed logs
  fs.writeFileSync('parsed-offers.json', JSON.stringify(offers, null, 2));
  console.log(`✅ Saved structured offers to parsed-offers.json`);

  fs.writeFileSync('parsing-debug.json', JSON.stringify(detailedLog, null, 2));
  console.log(`✅ Saved detailed parsing log to parsing-debug.json`);

  fs.writeFileSync('all-container-ids.json', JSON.stringify(allContainerIds, null, 2));
  console.log(`✅ Saved all container IDs to all-container-ids.json`);

  // Create human-readable summary
  const summary = [
    `Amazon Offers API Parsing Results`,
    `ASIN: ${ASIN}`,
    `Book: Uncertain Sons and Other Stories`,
    ``,
    `Total offers found: ${offers.length}`,
    ``,
    `Offers (sorted by total price):`,
    ``,
    ...offers.map((offer, i) => {
      return [
        `${i + 1}. $${offer.totalPrice.toFixed(2)} TOTAL`,
        `   Item: $${offer.itemPrice.toFixed(2)}`,
        `   Shipping: ${offer.shippingText}`,
        `   Condition: ${offer.condition}`,
        `   Seller: ${offer.seller}`,
        ``
      ].join('\n');
    })
  ].join('\n');

  fs.writeFileSync('parsed-offers-summary.txt', summary);
  console.log(`✅ Saved human-readable summary to parsed-offers-summary.txt`);

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total offers extracted: ${offers.length}`);
  if (offers.length > 0) {
    console.log(`   Lowest price: $${offers[0].totalPrice.toFixed(2)} (${offers[0].condition})`);
    console.log(`   Highest price: $${offers[offers.length - 1].totalPrice.toFixed(2)} (${offers[offers.length - 1].condition})`);
  }

  await browser.close();
}

main();
