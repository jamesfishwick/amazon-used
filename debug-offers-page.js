const { chromium } = require('playwright');
const fs = require('fs');

// ASIN for "Uncertain Sons and Other Stories"
const ASIN = '1988964490';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    const offersUrl = `https://www.amazon.com/dp/${ASIN}/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL`;
    console.log(`Navigating to: ${offersUrl}`);

    await page.goto(offersUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Take full page screenshot
    await page.screenshot({ path: `debug-full-page-${ASIN}.png`, fullPage: true });
    console.log(`✅ Full page screenshot saved: debug-full-page-${ASIN}.png`);

    // Save page HTML
    const html = await page.content();
    fs.writeFileSync(`debug-page-${ASIN}.html`, html);
    console.log(`✅ Page HTML saved: debug-page-${ASIN}.html`);

    // Extract all offer divs and their text
    const offers = await page.$$('[id^="aod-offer-"]');
    console.log(`\nFound ${offers.length} offer containers\n`);

    const offerData = [];

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const text = await offer.textContent();
      const id = await offer.getAttribute('id');

      console.log(`${'='.repeat(80)}`);
      console.log(`OFFER ${i + 1} (ID: ${id})`);
      console.log(`${'='.repeat(80)}`);
      console.log(text.substring(0, 600));
      console.log(`\n`);

      // Try to extract structured data
      const priceEl = await offer.$('.a-price .a-offscreen');
      const price = priceEl ? await priceEl.textContent() : 'Not found';

      const shippingEl = await offer.$('[data-csa-c-delivery-price]');
      const shipping = shippingEl ? await shippingEl.textContent() : 'Not found';

      const sellerEl = await offer.$('[aria-label*="seller"]');
      const seller = sellerEl ? await sellerEl.textContent() : 'Not found';

      const conditionEl = await offer.$('#aod-offer-heading h5');
      const condition = conditionEl ? await conditionEl.textContent() : 'Not found';

      offerData.push({
        offerId: id,
        price,
        shipping,
        seller: seller.trim(),
        condition: condition.trim(),
        fullText: text.substring(0, 1000)
      });
    }

    // Save structured offer data to JSON
    fs.writeFileSync(`debug-offers-${ASIN}.json`, JSON.stringify(offerData, null, 2));
    console.log(`✅ Structured offers saved: debug-offers-${ASIN}.json`);

    // Also extract the visible text from the main offer list for easy reading
    const offerList = await page.$('#aod-offer-list, #all-offers-display');
    if (offerList) {
      const listText = await offerList.textContent();
      fs.writeFileSync(`debug-offers-text-${ASIN}.txt`, listText);
      console.log(`✅ Offers text saved: debug-offers-text-${ASIN}.txt`);
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`Total offers found: ${offers.length}`);
    offerData.forEach((o, i) => {
      console.log(`  ${i + 1}. ${o.price} (${o.condition}) - Shipping: ${o.shipping}`);
    });

    console.log(`\n⏸️  Browser will remain open for 30 seconds for manual inspection...`);
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
