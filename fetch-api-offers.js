const { chromium } = require('playwright');
const fs = require('fs');

const ASIN = '1988964490';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let apiResponse = null;

  // Intercept the API call
  page.on('response', async response => {
    if (response.url().includes('aodAjaxMain')) {
      console.log(`\n📡 Found API call: ${response.url()}\n`);

      try {
        const text = await response.text();
        apiResponse = text;
        console.log(`✅ Response captured (${text.length} bytes)`);

        // Save to file
        fs.writeFileSync('aod-api-response.html', text);
        console.log(`✅ Saved to aod-api-response.html`);

      } catch (e) {
        console.error(`❌ Could not read response: ${e.message}`);
      }
    }
  });

  const url = `https://www.amazon.com/dp/${ASIN}`;
  console.log(`Loading: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  if (!apiResponse) {
    console.log(`\n⚠️  API call not captured automatically. Trying manual fetch...\n`);

    const apiUrl = `https://www.amazon.com/gp/product/ajax/aodAjaxMain/ref=auto_load_aod?asin=${ASIN}&pc=dp`;
    console.log(`Fetching: ${apiUrl}`);

    const response = await page.goto(apiUrl);
    apiResponse = await response.text();

    fs.writeFileSync('aod-api-response.html', apiResponse);
    console.log(`✅ Manual fetch successful, saved to aod-api-response.html`);
  }

  await browser.close();
}

main();
