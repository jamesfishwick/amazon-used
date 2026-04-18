const { chromium } = require('playwright');

async function debugOffersContent() {
  console.log('🔧 DEBUGGING OFFERS CONTENT EXTRACTION...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const testCases = [
    {
      name: 'Grinderman (vinyl)',
      url: 'https://www.amazon.com/dp/B0F78542ZC/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL',
      productType: 'music',
      currentFormat: 'vinyl'
    },
    {
      name: 'Dawn of Everything (book)',
      url: 'https://www.amazon.com/dp/0374157359/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL',
      productType: 'book',
      currentFormat: 'hardcover'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 TESTING: ${testCase.name}`);
    console.log(`🔗 URL: ${testCase.url}`);
    
    await page.goto(testCase.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000);
    
    // Simulate what the offers-content.js script does
    const result = await page.evaluate(() => {
      const div = document.getElementById('all-offers-display');
      
      if (!div) {
        return { error: 'all-offers-display div not found' };
      }
      
      const info = {
        exists: true,
        innerHTML: div.innerHTML,
        textContent: div.textContent,
        contentLength: div.innerHTML.length,
        textLength: div.textContent.length,
        hasNoSellers: div.textContent.toLowerCase().includes('currently, there are no other sellers'),
        childElementCount: div.childElementCount,
        children: Array.from(div.children).map(child => ({
          tagName: child.tagName,
          className: child.className,
          textContent: child.textContent.substring(0, 100)
        }))
      };
      
      return info;
    });
    
    console.log(`📦 ALL-OFFERS-DISPLAY ANALYSIS:`);
    console.log(`   Exists: ${result.exists || false}`);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      continue;
    }
    
    console.log(`   Content length: ${result.contentLength} chars`);
    console.log(`   Text length: ${result.textLength} chars`);
    console.log(`   Child elements: ${result.childElementCount}`);
    console.log(`   Has \"no sellers\": ${result.hasNoSellers}`);
    
    if (result.children && result.children.length > 0) {
      console.log(`   Children:`);
      result.children.slice(0, 3).forEach((child, i) => {
        console.log(`     ${i + 1}. <${child.tagName}> class="${child.className}" text="${child.textContent}..."`);
      });
    }
    
    // Sample the content
    if (result.textContent && result.textContent.length > 0) {
      console.log(`   📝 Sample text: "${result.textContent.substring(0, 200)}..."`);
    }
    
    if (result.innerHTML && result.innerHTML.length > 0 && result.innerHTML.length < 1000) {
      console.log(`   📝 Full HTML: "${result.innerHTML}"`);
    }
    
    // Check for table rows specifically
    const tableAnalysis = await page.evaluate(() => {
      const div = document.getElementById('all-offers-display');
      if (!div) return { error: 'div not found' };
      
      const allRows = div.querySelectorAll('tr');
      const rowsWithPrices = Array.from(allRows).filter(row => row.textContent.includes('$'));
      
      return {
        totalRows: allRows.length,
        rowsWithPrices: rowsWithPrices.length,
        sampleRows: Array.from(allRows).slice(0, 3).map(row => ({
          text: row.textContent.substring(0, 100),
          hasPrices: row.textContent.includes('$')
        }))
      };
    });
    
    console.log(`   📊 TABLE ANALYSIS:`);
    console.log(`     Total rows: ${tableAnalysis.totalRows || 0}`);
    console.log(`     Rows with prices: ${tableAnalysis.rowsWithPrices || 0}`);
    
    if (tableAnalysis.sampleRows && tableAnalysis.sampleRows.length > 0) {
      tableAnalysis.sampleRows.forEach((row, i) => {
        console.log(`     Row ${i + 1}: "${row.text}..." (has $: ${row.hasPrices})`);
      });
    }
    
    // Wait and check if content changes
    console.log(`   ⏳ Waiting 10 seconds to see if content populates...`);
    await page.waitForTimeout(10000);
    
    const updatedResult = await page.evaluate(() => {
      const div = document.getElementById('all-offers-display');
      return div ? {
        contentLength: div.innerHTML.length,
        textLength: div.textContent.length,
        hasNoSellers: div.textContent.toLowerCase().includes('currently, there are no other sellers')
      } : null;
    });
    
    if (updatedResult) {
      console.log(`   📊 AFTER WAITING:`);
      console.log(`     Content length: ${updatedResult.contentLength} chars`);
      console.log(`     Text length: ${updatedResult.textLength} chars`);
      console.log(`     Has \"no sellers\": ${updatedResult.hasNoSellers}`);
    }
    
    console.log(`─────────────────────────────────────────────────────────────`);
  }
  
  await browser.close();
}

debugOffersContent().catch(console.error);