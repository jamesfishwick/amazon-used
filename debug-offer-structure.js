const { chromium } = require('playwright');

async function debugOfferStructure() {
  console.log('🔧 DEBUGGING OFFER STRUCTURE...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Test only the case that should have offers
  const url = 'https://www.amazon.com/dp/0374157359/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL';
  console.log(`🔗 URL: ${url}`);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('⏳ Waiting for page to load...');
  await page.waitForTimeout(8000);
  
  // Deep dive into the all-offers-display structure
  const analysis = await page.evaluate(() => {
    const div = document.getElementById('all-offers-display');
    if (!div) return { error: 'div not found' };
    
    // Look for all elements that might contain prices
    const allElements = div.querySelectorAll('*');
    const elementsWithPrices = [];
    
    for (const element of allElements) {
      const text = element.textContent || '';
      if (text.includes('$') && text.match(/\$\d+\.\d{2}/)) {
        elementsWithPrices.push({
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          text: text.substring(0, 200),
          innerHTML: element.innerHTML.substring(0, 300),
          parentTag: element.parentElement?.tagName,
          parentClass: element.parentElement?.className
        });
      }
    }
    
    // Look for common offer container patterns
    const possibleOfferContainers = [
      'div[data-aod-id]',
      '.olpOffer',
      '[class*="offer"]',
      '[class*="aod"]', 
      '[id*="offer"]',
      '[data-price]'
    ];
    
    const containerAnalysis = {};
    for (const selector of possibleOfferContainers) {
      const elements = div.querySelectorAll(selector);
      containerAnalysis[selector] = {
        count: elements.length,
        samples: Array.from(elements).slice(0, 2).map(el => ({
          text: el.textContent.substring(0, 100),
          className: el.className,
          id: el.id
        }))
      };
    }
    
    // Look for price patterns in text
    const textContent = div.textContent;
    const priceMatches = textContent.match(/\$\d+\.\d{2}/g) || [];
    
    return {
      elementsWithPrices: elementsWithPrices.slice(0, 10),
      containerAnalysis,
      priceMatches: priceMatches.slice(0, 20),
      totalTextLength: textContent.length,
      sampleText: textContent.substring(0, 500)
    };
  });
  
  console.log(`📦 STRUCTURE ANALYSIS:`);
  console.log(`   Elements with prices: ${analysis.elementsWithPrices.length}`);
  
  if (analysis.elementsWithPrices.length > 0) {
    console.log(`   💰 Price-containing elements:`);
    analysis.elementsWithPrices.forEach((el, i) => {
      console.log(`     ${i + 1}. <${el.tagName}> class="${el.className}" parent=<${el.parentTag}>`);
      console.log(`        Text: "${el.text}"`);
      console.log(`        HTML: "${el.innerHTML}"`);
      console.log('');
    });
  }
  
  console.log(`   🔍 Container patterns:`);
  Object.entries(analysis.containerAnalysis).forEach(([selector, data]) => {
    if (data.count > 0) {
      console.log(`     ${selector}: ${data.count} elements`);
      data.samples.forEach((sample, i) => {
        console.log(`       ${i + 1}. "${sample.text.substring(0, 60)}..."`);
      });
    }
  });
  
  console.log(`   💰 Price matches in text: ${analysis.priceMatches.length}`);
  if (analysis.priceMatches.length > 0) {
    console.log(`     Prices found: ${analysis.priceMatches.join(', ')}`);
  }
  
  console.log(`   📝 Sample text (first 500 chars):`);
  console.log(`     "${analysis.sampleText}"`);
  
  console.log('\n⏸️ Keeping browser open for manual inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

debugOfferStructure().catch(console.error);