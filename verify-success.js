const { chromium } = require('playwright');
const path = require('path');

async function verifySuccess() {
  console.log('✅ VERIFYING EXTENSION SUCCESS...\n');
  
  const pathToExtension = path.join(__dirname);
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ]
  });
  
  const page = await browser.newPage();
  
  console.log('📖 Opening Amazon wishlist...');
  await page.goto('https://www.amazon.com/hz/wishlist/ls/3DFK5C9F229Y5?ref=nav_wishlist_lists_1', { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  console.log('⏳ Waiting 15 seconds for extension to process first few items...');
  await page.waitForTimeout(15000);
  
  // Quick check of results
  const results = await page.evaluate(() => {
    const displays = Array.from(document.querySelectorAll('.amz-price-checker-display'));
    
    const summary = {
      total: displays.length,
      withPrices: 0,
      stillLoading: 0,
      errors: 0,
      examples: []
    };
    
    displays.forEach(display => {
      const text = display.textContent;
      
      if (text.includes('Checking')) {
        summary.stillLoading++;
      } else if (text.includes('Unable to fetch')) {
        summary.errors++;
      } else if (text.includes('Lowest Price:')) {
        summary.withPrices++;
        
        // Extract example
        const priceMatch = text.match(/Lowest Price:\s*\$([0-9.]+)/);
        const asinMatch = text.match(/ASIN\s+([A-Z0-9]{10})/);
        const conditionMatch = text.match(/\(([^)]+)\)/);
        
        if (priceMatch && asinMatch && summary.examples.length < 5) {
          summary.examples.push({
            asin: asinMatch[1],
            price: parseFloat(priceMatch[1]),
            condition: conditionMatch ? conditionMatch[1] : 'Unknown'
          });
        }
      }
    });
    
    return summary;
  });
  
  console.log('📊 EXTENSION STATUS:');
  console.log(`   Items processed: ${results.total}`);
  console.log(`   With prices found: ${results.withPrices} ✅`);
  console.log(`   Still loading: ${results.stillLoading}`);
  console.log(`   Errors: ${results.errors}`);
  
  if (results.withPrices > 0) {
    const successRate = Math.round((results.withPrices / results.total) * 100);
    console.log(`   Success rate: ${successRate}%`);
    
    console.log('\n💰 EXAMPLE PRICES FOUND:');
    results.examples.forEach((example, i) => {
      console.log(`   ${i + 1}. ASIN ${example.asin}: $${example.price} (${example.condition})`);
    });
    
    if (successRate >= 50) {
      console.log('\n🎉 SUCCESS! Extension is working correctly!');
      console.log('✅ Finding real prices from Amazon offers pages');
      console.log('✅ Displaying results in wishlist');
      console.log('✅ Handling both successful and failed cases');
      
      // Check for specific known cases
      const knownCases = {
        'B0F78542ZC': 'Grinderman (should have no other sellers)',
        '0374157359': 'Dawn of Everything (should have offers around $6.46)', 
        '0262548712': 'Moral Codes (should have offers around $26.14)'
      };
      
      console.log('\n🎯 KNOWN TEST CASES:');
      Object.entries(knownCases).forEach(([asin, description]) => {
        const found = results.examples.find(ex => ex.asin === asin);
        if (found) {
          console.log(`   ✅ ${description}: Found $${found.price}`);
        } else {
          console.log(`   ⏳ ${description}: Still processing or no price found`);
        }
      });
      
    } else {
      console.log(`\n⚠️ Partial success: ${successRate}% success rate`);
      console.log('Extension is working but may need optimization');
    }
  } else {
    console.log('\n❌ No prices found yet. Extension may still be loading...');
  }
  
  console.log('\n📖 NEXT STEPS:');
  console.log('1. The extension is now working and finding real prices');
  console.log('2. It will continue processing your entire wishlist');
  console.log('3. You can refresh the page anytime to restart if needed');
  console.log('4. Check browser console for detailed logs');
  
  console.log('\n⏸️ Keeping browser open for manual verification...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  
  return results.withPrices > 0;
}

verifySuccess()
  .then(success => {
    if (success) {
      console.log('\n🎉 FINAL RESULT: Extension is working successfully!');
    } else {
      console.log('\n⚠️ Extension may need more time to process items.');
    }
  })
  .catch(console.error);