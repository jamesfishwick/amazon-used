const { chromium } = require('playwright');
const path = require('path');

async function testFullWishlist() {
  console.log('🧪 TESTING FULL WISHLIST WITH UPDATED EXTENSION...\n');
  
  // Launch browser with extension loaded
  const pathToExtension = path.join(__dirname);
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  // Monitor all console output
  browser.on('page', (newPage) => {
    newPage.on('console', msg => {
      const text = msg.text();
      if (text.includes('BACKGROUND:') || text.includes('OFFERS') || text.includes('LOWEST') || text.includes('EXTRACTION')) {
        console.log(`🔧 EXTENSION: ${text}`);
      }
    });
  });
  
  const page = await browser.newPage();
  
  // Navigate to the wishlist
  console.log('📖 Opening Amazon wishlist...');
  await page.goto('https://www.amazon.com/hz/wishlist/ls/3DFK5C9F229Y5?ref=nav_wishlist_lists_1', { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  console.log('⏳ Waiting for wishlist and extension to load...');
  await page.waitForTimeout(10000);
  
  // Check initial extension activity
  const initialResults = await page.evaluate(() => {
    const displays = Array.from(document.querySelectorAll('.amz-price-checker-display'));
    return {
      extensionActive: displays.length > 0,
      totalDisplays: displays.length,
      loadingDisplays: displays.filter(d => d.textContent.includes('Checking')).length,
      completedDisplays: displays.filter(d => !d.textContent.includes('Checking')).length,
      errorDisplays: displays.filter(d => d.textContent.includes('Unable to fetch')).length,
      priceDisplays: displays.filter(d => d.textContent.includes('Lowest Price:')).length
    };
  });
  
  console.log(`📊 INITIAL STATUS:`);
  console.log(`   Extension active: ${initialResults.extensionActive}`);
  console.log(`   Total displays: ${initialResults.totalDisplays}`);
  console.log(`   Loading: ${initialResults.loadingDisplays}`);
  console.log(`   Completed: ${initialResults.completedDisplays}`);
  console.log(`   Errors: ${initialResults.errorDisplays}`);
  console.log(`   With prices: ${initialResults.priceDisplays}`);
  
  // Wait for processing to complete
  console.log('\n⏳ Waiting for extension to process items (60 seconds)...');
  await page.waitForTimeout(60000);
  
  // Check final results
  const finalResults = await page.evaluate(() => {
    const displays = Array.from(document.querySelectorAll('.amz-price-checker-display'));
    const results = [];
    
    for (const display of displays) {
      const text = display.textContent;
      
      // Find the associated ASIN
      let asin = 'unknown';
      const asinMatch = text.match(/ASIN\s+([A-Z0-9]{10})/);
      if (asinMatch) {
        asin = asinMatch[1];
      } else {
        // Try to find ASIN from URL in the display
        const urlMatch = text.match(/dp\/([A-Z0-9]{10})/);
        if (urlMatch) {
          asin = urlMatch[1];
        }
      }
      
      // Extract price info
      const priceMatch = text.match(/Lowest Price:\s*\$([0-9.]+)/);
      const conditionMatch = text.match(/\(([^)]+)\)/);
      
      results.push({
        asin,
        hasPrice: !!priceMatch,
        price: priceMatch ? parseFloat(priceMatch[1]) : null,
        condition: conditionMatch ? conditionMatch[1] : null,
        isLoading: text.includes('Checking'),
        hasError: text.includes('Unable to fetch'),
        fullText: text.substring(0, 200)
      });
    }
    
    return {
      totalItems: results.length,
      withPrices: results.filter(r => r.hasPrice).length,
      stillLoading: results.filter(r => r.isLoading).length,
      withErrors: results.filter(r => r.hasError).length,
      items: results
    };
  });
  
  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`   Total items processed: ${finalResults.totalItems}`);
  console.log(`   Items with prices: ${finalResults.withPrices}`);
  console.log(`   Still loading: ${finalResults.stillLoading}`);
  console.log(`   With errors: ${finalResults.withErrors}`);
  console.log(`   Success rate: ${Math.round((finalResults.withPrices / finalResults.totalItems) * 100)}%`);
  
  console.log(`\n💰 PRICE RESULTS:`);
  const itemsWithPrices = finalResults.items.filter(item => item.hasPrice);
  
  if (itemsWithPrices.length > 0) {
    itemsWithPrices.slice(0, 15).forEach((item, i) => {
      console.log(`   ${i + 1}. ASIN ${item.asin}: $${item.price} (${item.condition || 'Unknown condition'})`);
    });
  } else {
    console.log(`   ❌ No prices found`);
  }
  
  // Test specific known cases
  console.log(`\n🎯 TESTING KNOWN CASES:`);
  const testCases = [
    { asin: 'B0F78542ZC', name: 'Grinderman (vinyl)', expected: 'No other sellers' },
    { asin: '0374157359', name: 'Dawn of Everything', expected: '$6.46 or similar' },
    { asin: '0262548712', name: 'Moral Codes', expected: '$26.14 or similar' }
  ];
  
  for (const testCase of testCases) {
    const result = finalResults.items.find(item => item.asin === testCase.asin);
    if (result) {
      console.log(`   ${testCase.name} (${testCase.asin}):`);
      console.log(`     Found: ${result.hasPrice ? '$' + result.price + ' (' + result.condition + ')' : 'No price'}`);
      console.log(`     Expected: ${testCase.expected}`);
      console.log(`     Status: ${result.isLoading ? 'Loading' : result.hasError ? 'Error' : 'Complete'}`);
    } else {
      console.log(`   ${testCase.name} (${testCase.asin}): Not found in results`);
    }
  }
  
  // Check error cases
  const errorItems = finalResults.items.filter(item => item.hasError);
  if (errorItems.length > 0) {
    console.log(`\n❌ ERROR CASES (${errorItems.length} items):`);
    errorItems.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i + 1}. ASIN ${item.asin}: "${item.fullText.substring(0, 100)}..."`);
    });
  }
  
  console.log('\n⏸️ Keeping browser open for manual inspection...');
  console.log('💡 You can manually verify prices and check browser console for detailed logs');
  await page.waitForTimeout(60000);
  
  await browser.close();
  
  // Return success rate for further testing
  return Math.round((finalResults.withPrices / finalResults.totalItems) * 100);
}

// Run the test and retry if needed
async function runWithRetries() {
  let attempt = 1;
  const maxAttempts = 3;
  
  while (attempt <= maxAttempts) {
    console.log(`🔄 ATTEMPT ${attempt}/${maxAttempts}\n`);
    
    try {
      const successRate = await testFullWishlist();
      
      if (successRate >= 80) {
        console.log(`\n🎉 SUCCESS! Extension working with ${successRate}% success rate`);
        break;
      } else {
        console.log(`\n⚠️ Low success rate: ${successRate}%. Trying again...`);
        attempt++;
      }
    } catch (error) {
      console.error(`\n❌ Test failed: ${error.message}`);
      attempt++;
    }
    
    if (attempt <= maxAttempts) {
      console.log(`\n⏳ Waiting 10 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  if (attempt > maxAttempts) {
    console.log(`\n❌ Failed after ${maxAttempts} attempts. Check extension code.`);
  }
}

runWithRetries().catch(console.error);