const { chromium } = require('playwright');

async function testUpdatedOffers() {
  console.log('🧪 TESTING UPDATED OFFERS EXTRACTION...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Test the new parsing logic on a page with offers
  const url = 'https://www.amazon.com/dp/0374157359/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL';
  console.log(`🔗 URL: ${url}`);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('⏳ Waiting for page to load...');
  await page.waitForTimeout(8000);
  
  // Test the new parsing logic
  const result = await page.evaluate(() => {
    const div = document.getElementById('all-offers-display');
    if (!div) return { error: 'div not found' };
    
    // Simulate the updated parsing logic
    const prices = [];
    const allElements = div.querySelectorAll('*');
    const elementsWithPrices = [];
    
    // First pass: find all elements containing price patterns
    for (const element of allElements) {
      const text = element.textContent || '';
      if (text.includes('$') && text.match(/\$\d+\.\d{2}/)) {
        // Check if this looks like an actual offer (has condition/seller info)
        const lowerText = text.toLowerCase();
        const hasOfferKeywords = lowerText.includes('new') || lowerText.includes('used') || 
                                lowerText.includes('condition') || lowerText.includes('seller') ||
                                lowerText.includes('ships from') || lowerText.includes('sold by');
        
        if (hasOfferKeywords || text.length < 500) { // Short text more likely to be actual offer
          elementsWithPrices.push({
            text: text.substring(0, 300),
            prices: text.match(/\$\d+\.\d{2}/g) || [],
            tagName: element.tagName,
            className: element.className
          });
        }
      }
    }
    
    // Second pass: extract price information
    const foundPrices = new Set();
    
    for (let i = 0; i < elementsWithPrices.length && prices.length < 20; i++) {
      const item = elementsWithPrices[i];
      const text = item.text;
      const lowerText = text.toLowerCase();
      
      for (const priceText of item.prices) {
        const price = parseFloat(priceText.replace('$', ''));
        const priceKey = `${price}-${lowerText.substring(0, 50)}`;
        
        if (price >= 1 && price <= 500 && !foundPrices.has(priceKey)) {
          foundPrices.add(priceKey);
          
          // Determine condition
          let condition = 'New';
          let type = 'New';
          
          if (lowerText.includes('used')) {
            type = 'Used';
            if (lowerText.includes('like new')) condition = 'Used - Like New';
            else if (lowerText.includes('very good')) condition = 'Used - Very Good';
            else if (lowerText.includes('good')) condition = 'Used - Good';
            else if (lowerText.includes('acceptable')) condition = 'Used - Acceptable';
            else condition = 'Used - Good';
          } else if (lowerText.includes('refurbished')) {
            condition = 'Refurbished';
            type = 'Refurbished';
          }
          
          prices.push({
            price,
            type,
            condition,
            context: text.substring(0, 100),
            tagName: item.tagName,
            className: item.className
          });
        }
      }
    }
    
    // Sort by price
    const sortedPrices = prices.sort((a, b) => a.price - b.price);
    
    return {
      elementsWithPricesCount: elementsWithPrices.length,
      totalPricesFound: prices.length,
      lowestPrice: sortedPrices.length > 0 ? sortedPrices[0] : null,
      allPrices: sortedPrices.slice(0, 10)
    };
  });
  
  console.log(`📦 UPDATED PARSING RESULTS:`);
  console.log(`   Elements with prices: ${result.elementsWithPricesCount}`);
  console.log(`   Total prices extracted: ${result.totalPricesFound}`);
  
  if (result.lowestPrice) {
    console.log(`   🎯 LOWEST PRICE: $${result.lowestPrice.price} (${result.lowestPrice.type} - ${result.lowestPrice.condition})`);
    console.log(`   📝 Context: "${result.lowestPrice.context}"`);
  } else {
    console.log(`   ❌ No valid prices found`);
  }
  
  if (result.allPrices && result.allPrices.length > 0) {
    console.log(`   💰 All prices found:`);
    result.allPrices.forEach((price, i) => {
      console.log(`     ${i + 1}. $${price.price} (${price.type} - ${price.condition})`);
      console.log(`        Context: "${price.context.substring(0, 80)}..."`);
    });
  }
  
  console.log('\n⏸️ Keeping browser open for manual verification...');
  await page.waitForTimeout(20000);
  
  await browser.close();
}

testUpdatedOffers().catch(console.error);