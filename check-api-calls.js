const { chromium } = require('playwright');
const fs = require('fs');

const ASIN = '1988964490';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls = [];

  // Intercept all network requests
  page.on('request', request => {
    const url = request.url();
    // Look for potential API calls (JSON, AJAX, etc.)
    if (url.includes('offer') || url.includes('price') || url.includes('api') || url.includes('ajax')) {
      console.log(`📡 REQUEST: ${request.method()} ${url}`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Look for JSON responses
    if (contentType.includes('json') || url.includes('offer') || url.includes('price')) {
      console.log(`📥 RESPONSE: ${response.status()} ${url}`);
      console.log(`   Content-Type: ${contentType}`);

      try {
        if (contentType.includes('json')) {
          const body = await response.text();
          apiCalls.push({
            url,
            status: response.status(),
            contentType,
            body: body.substring(0, 1000) // First 1000 chars
          });
          console.log(`   Preview: ${body.substring(0, 200)}...`);
        }
      } catch (e) {
        console.log(`   (Could not read body)`);
      }
      console.log('');
    }
  });

  const url = `https://www.amazon.com/dp/${ASIN}/ref=olp-opf-redir?aod=1`;
  console.log(`\n🔍 Loading: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Save all API calls to file
  fs.writeFileSync('api-calls.json', JSON.stringify(apiCalls, null, 2));
  console.log(`\n✅ Saved ${apiCalls.length} API calls to api-calls.json`);

  // Take screenshot
  await page.screenshot({ path: 'screenshots/api-check.png', fullPage: true });

  await page.waitForTimeout(10000);
  await browser.close();
}

main();
